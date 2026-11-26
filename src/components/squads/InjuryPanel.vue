<script setup lang="ts">
import { computed, nextTick, onMounted, ref, shallowRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import type { InjuryDto, InjuryHistoryEntryDto, InjuryProposalDto, PlayerInjuryHistoryDto, SquadPlayerDto } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';
import { injuryFacts, injuryWithLocation } from '@/utils/injuryAnatomy';
import { occasionIcon, occasionPlace, proposalOccasion } from '@/utils/injuryOccasion';
import { confirmDialog } from '@/composables/useConfirm';
import { useSort } from '@/composables/useSort';
import { useViewer } from '@/composables/useViewer';
import PlayerName from '@/components/players/PlayerName.vue';
import InjuryCounter from '@/components/squads/InjuryCounter.vue';
import InjuryDocuments from '@/components/squads/InjuryDocuments.vue';
import InjuryFormModal, { type InjuryFormMode, type InjuryFormPreset } from '@/components/squads/InjuryFormModal.vue';

// Control de lesionados de la plantilla: cada lesión abierta con su contador de días de baja (reales, contados desde el
// parte) y lo que falta para la vuelta prevista; el alta con su día, las recaídas, el historial y las pruebas e informes
// de cada una. Opcional para el cuerpo técnico; los jugadores vinculados ven las suyas sin poder tocarlas. Con playerId
// es el historial de un solo jugador (su perfil): todas sus lesiones en el club, también de otras temporadas, con lo que
// tardó de verdad en recuperarse de cada una frente a lo previsto al dar el parte. Las de quien causó baja en la plantilla
// (playerLeft) son historial: se consultan y se pueden borrar, nada más. Lo mismo la que pasó abierta a la temporada
// siguiente (continuedOn): allí sigue, con su parte (continuesInjuryId), y en el perfil sale una sola vez. Arriba, las
// posibles lesiones que cuentan las crónicas de los partidos, para registrarlas con un clic, enlazarlas con la lesión que
// ya tiene abierta o descartarlas. Cada lesión dice dónde fue: el partido o el entrenamiento en que se lesionó.
const props = defineProps<{ squadId: string; players: SquadPlayerDto[]; canManage: boolean; playerId?: string | null; playerLeft?: boolean }>();

const photoOf = (squadPlayerId: string) => props.players.find((p) => p.id === squadPlayerId)?.photoUrl ?? null;
const emit = defineEmits<{ changed: [] }>();

const injuries = shallowRef<InjuryDto[]>([]);
const profile = shallowRef<PlayerInjuryHistoryDto | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);

// En el perfil, el historial del jugador en el club; en la plantilla, las lesiones de esta temporada.
async function fetchList() {
  if (props.playerId) profile.value = await api.squads.playerInjuryHistory(props.squadId, props.playerId);
  else injuries.value = await api.squads.injuries(props.squadId);
}

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    await Promise.all([fetchList(), fetchProposals()]);
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
  scrollToPanel();
}
onMounted(load);
watch(() => [props.squadId, props.playerId], load);

// El aviso de una posible lesión lleva aquí (#lesiones): el panel se carga después que la página, así que se baja a él al
// tenerlo, y también si ya se estaba en la plantilla.
const route = useRoute();
function scrollToPanel() {
  if (props.playerId || route.hash !== '#lesiones') return;
  void nextTick(() => document.getElementById('lesiones')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}
watch(() => route.hash, scrollToPanel);

const entries = computed<InjuryHistoryEntryDto[]>(() =>
  props.playerId
    ? (profile.value?.injuries ?? [])
    : injuries.value.map((injury) => ({ injury, squadId: props.squadId, teamName: '', seasonLabel: '', otherSquad: false })),
);
const isOpen = (e: InjuryHistoryEntryDto) => e.injury.active && !e.injury.playerLeft && !e.otherSquad;
const active = computed(() => entries.value.filter(isOpen));
const history = computed(() => entries.value.filter((e) => !isOpen(e)));
const canRecord = computed(() => props.canManage && !props.playerLeft);
const totals = computed(() => profile.value?.totals ?? null);

// Lo que se corrige es de esta plantilla y de quien sigue en ella; lo de otra temporada (o lo que pasó a ella) se consulta.
const editable = (e: InjuryHistoryEntryDto) => props.canManage && !e.otherSquad && !e.injury.playerLeft && !e.injury.continuedOn;
const deletable = (e: InjuryHistoryEntryDto) => props.canManage && !e.otherSquad;
const hasOpen = (squadPlayerId: string) => entries.value.some((e) => isOpen(e) && e.injury.squadPlayerId === squadPlayerId);
const hasRelapse = (injury: InjuryDto) => entries.value.some((e) => e.injury.relapseOfInjuryId === injury.id);
const relapseOf = (injury: InjuryDto) => (injury.relapseOfInjuryId ? (entries.value.find((e) => e.injury.id === injury.relapseOfInjuryId)?.injury ?? null) : null);

// Las pruebas e informes los abren el club, el cuerpo técnico y el propio jugador (que solo recibe las suyas); el
// administrador ve que existen, pero no los abre.
const { isAdmin } = useViewer();
const canOpenDocuments = computed(() => props.canManage || !isAdmin.value);

// --- Posibles lesiones: lo que cuentan las crónicas de los partidos ---
// Son para quien registra las lesiones (el club y el cuerpo técnico; el administrador, solo para leer). Ninguna cuenta
// como lesión hasta que se registra; si no fue así, se descarta y no se vuelve a proponer.
const proposals = shallowRef<InjuryProposalDto[]>([]);
async function fetchProposals() {
  if (!props.canManage && !isAdmin.value) {
    proposals.value = [];
    return;
  }
  try {
    proposals.value = await api.squads.injuryProposals(props.squadId);
  } catch {
    proposals.value = [];
  }
}
const visibleProposals = computed(() => (props.playerLeft ? [] : proposals.value.filter((p) => !props.playerId || p.squadPlayerId === props.playerId)));
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const openInjuryOf = (squadPlayerId: string) => entries.value.find((e) => isOpen(e) && e.injury.squadPlayerId === squadPlayerId)?.injury ?? null;

// El formulario sale relleno con lo que cuenta la crónica (el tipo que encaja, el partido como el sitio donde se lesionó,
// su día como parte y la vuelta prevista con la duración media del tipo); se revisa y se guarda.
function openProposal(p: InjuryProposalDto) {
  const reason = `${capitalize(p.phrase)} (crónica del J${p.matchday}, ${p.homeTeam} – ${p.awayTeam})`;
  openFormWith('new', null, {
    squadPlayerId: p.squadPlayerId,
    type: p.suggestedType,
    reason: reason.length <= 300 ? reason : capitalize(p.phrase).slice(0, 300),
    startedOn: p.matchDate > today ? today : p.matchDate,
    occasion: proposalOccasion(p),
    lockOccasion: true,
    lockPlayer: true,
    proposal: p,
  });
}

// Ya tiene una lesión abierta y no puede tener dos: si es esa misma, queda como la de ese partido y la posible lesión,
// registrada con ella.
function linkProposal(p: InjuryProposalDto) {
  const open = openInjuryOf(p.squadPlayerId);
  if (open) openFormWith('edit', open, { occasion: proposalOccasion(p), lockOccasion: true, proposal: p });
}

async function dismissProposal(p: InjuryProposalDto) {
  const ok = await confirmDialog({
    title: `Descartar la posible lesión de ${p.playerName}`,
    message: 'No se volverá a proponer por este partido. Si al final resulta que sí se lesionó, regístrala como una lesión más.',
    confirmLabel: 'Descartar',
  });
  if (!ok) return;
  busy.value = true;
  error.value = null;
  try {
    proposals.value = await api.squads.dismissInjuryProposal(props.squadId, p.id);
  } catch (e) {
    error.value = errorMessage(e);
    void fetchProposals();
  } finally {
    busy.value = false;
  }
}

const busy = ref(false);
const error = ref<string | null>(null);
const busyTitle = 'Espera a que termine lo que se está guardando';

async function act(fn: () => Promise<InjuryDto[]>) {
  busy.value = true;
  error.value = null;
  try {
    const list = await fn();
    if (props.playerId) await fetchList().catch((e) => (loadError.value = errorMessage(e)));
    else injuries.value = list;
    emit('changed');
    return true;
  } catch (e) {
    error.value = errorMessage(e);
    return false;
  } finally {
    busy.value = false;
  }
}

function onDocuments(list: InjuryDto[]) {
  if (props.playerId) void fetchList().catch((e) => (loadError.value = errorMessage(e)));
  else injuries.value = list;
  emit('changed');
}

// --- Fechas ---
const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 86_400_000);
const daysLabel = (n: number) => (n === 1 ? '1 día' : `${n} días`);
const today = localDay();

// Lo que tardó frente a lo que se previó al dar el parte (de las que tienen el alta).
function forecastDiff(i: InjuryDto) {
  return i.returnedOn && i.initialExpectedDays != null ? i.daysOut - i.initialExpectedDays : null;
}
function forecastNote(i: InjuryDto) {
  const diff = forecastDiff(i);
  if (diff === null) return null;
  if (diff === 0) return `previstos ${i.initialExpectedDays} al dar el parte: justo lo previsto`;
  return `previstos ${i.initialExpectedDays} al dar el parte (${Math.abs(diff)} ${diff > 0 ? 'más' : 'menos'})`;
}

// --- Formulario: lesión nueva, corrección o recaída, con dónde se lesionó ---
// Lo último que se abrió se queda mientras se cierra, para que el formulario no cambie al irse.
const formOpen = ref(false);
const formState = shallowRef<{ mode: InjuryFormMode; target: InjuryDto | null; preset: InjuryFormPreset | null }>({ mode: 'new', target: null, preset: null });
const formPlayers = computed(() => props.players.filter((p) => p.status === 'Active'));
const injuredPlayerIds = computed(() => active.value.map((e) => e.injury.squadPlayerId));
// La recaída no puede empezar antes del alta de la lesión de la que viene (tampoco al corregirla).
const formStartMin = computed(() => {
  const { mode, target } = formState.value;
  if (!target) return undefined;
  if (mode === 'relapse') return target.returnedOn ?? undefined;
  if (mode === 'edit' && target.relapseOfInjuryId) return relapseOf(target)?.returnedOn ?? undefined;
  return undefined;
});

function openFormWith(mode: InjuryFormMode, target: InjuryDto | null, preset: InjuryFormPreset | null = null) {
  error.value = null;
  formState.value = { mode, target, preset };
  formOpen.value = true;
}
const openNew = (playerId: string | null = props.playerId ?? null) => openFormWith('new', null, { squadPlayerId: playerId, lockPlayer: !!props.playerId });
const openEdit = (injury: InjuryDto) => openFormWith('edit', injury);
const openRelapse = (injury: InjuryDto) => openFormWith('relapse', injury);

// Al guardar, la posible lesión de la crónica de ese partido queda registrada con ella (o descartada, si la lesión dice
// ahora que fue en otro sitio): se vuelven a pedir.
function onSaved(list: InjuryDto[]) {
  formOpen.value = false;
  if (props.playerId) void fetchList().catch((e) => (loadError.value = errorMessage(e)));
  else injuries.value = list;
  void fetchProposals();
  emit('changed');
}

// --- Alta: con su día (por defecto hoy), que cierra el contador. Siempre se confirma (Diego, 20-11). ---
const closing = ref<InjuryDto | null>(null);
const returnedOn = ref(today);
function openClose(injury: InjuryDto) {
  closing.value = injury;
  returnedOn.value = today;
  error.value = null;
}
const closingDays = computed(() => (closing.value && returnedOn.value ? daysBetween(closing.value.startedOn, returnedOn.value) : null));
const closeBlocked = computed(() => {
  if (busy.value) return busyTitle;
  if (!closing.value || !returnedOn.value) return 'Pon el día del alta';
  if (returnedOn.value < closing.value.startedOn) return 'El alta no puede ser anterior al parte';
  if (returnedOn.value > today) return 'El alta no puede ser posterior a hoy: mientras no la tenga, cambia la vuelta prevista';
  return undefined;
});
async function confirmClose() {
  const injury = closing.value;
  if (!injury || closeBlocked.value) return;
  if (await act(() => api.squads.closeInjury(props.squadId, injury.id, returnedOn.value))) closing.value = null;
}

// Deshacer el alta es para un alta dada por error; si ha vuelto a lesionarse, es una recaída (y la primera conserva
// lo que tardó en recuperarse).
function reopenBlocked(injury: InjuryDto) {
  if (busy.value) return busyTitle;
  if (hasOpen(injury.squadPlayerId)) return 'Ya tiene una lesión abierta: no puede tener dos a la vez';
  if (hasRelapse(injury)) return 'Tiene una recaída registrada después del alta: bórrala antes de deshacer el alta';
  return undefined;
}
function relapseBlocked(injury: InjuryDto) {
  if (busy.value) return busyTitle;
  if (hasOpen(injury.squadPlayerId)) return 'Ya tiene una lesión abierta: dale el alta antes de registrar una recaída';
  return undefined;
}

async function reopen(injury: InjuryDto) {
  const ok = await confirmDialog({
    title: `Deshacer el alta de ${injury.playerName}`,
    message:
      'Solo si el alta se dio por error: la lesión vuelve a estar abierta y sigue contando los días desde el parte. Si ha vuelto a lesionarse después de recuperarse, registra una recaída: así queda lo que tardó en recuperarse la primera vez.',
    confirmLabel: 'Deshacer el alta',
  });
  if (!ok) return;
  void act(() => api.squads.reopenInjury(props.squadId, injury.id));
}

// La que viene de la temporada anterior casi nunca se borra: si ya se recuperó, lo que toca es el alta con su día.
function removeMessage(injury: InjuryDto) {
  const parts = [
    injury.continuesInjuryId
      ? 'Viene de la temporada anterior. Si ya se recuperó, mejor dale el alta con el día en que volvió: así queda lo que tardó de verdad. Bórrala solo si no es suya o se registró por error: la de la temporada anterior se queda allí como historial y no se vuelve a pasar.'
      : 'Se registró por error y no quedará en el historial.',
  ];
  if (hasRelapse(injury)) parts.push('Su recaída se queda como una lesión más.');
  if (injury.continuedOn) parts.push('La de la temporada siguiente se queda, con su parte.');
  return parts.join(' ');
}

async function remove(injury: InjuryDto) {
  if (!(await confirmDialog({ title: `Borrar la lesión de ${injury.playerName}`, message: removeMessage(injury), confirmLabel: 'Borrar', danger: true }))) return;
  void act(() => api.squads.deleteInjury(props.squadId, injury.id));
}

// --- Historial del perfil: tabla ordenable y fila que se abre con el detalle ---
const teamNames = computed(() => new Set(history.value.map((e) => e.teamName)));
type HistoryKey = 'type' | 'season' | 'start' | 'end' | 'days' | 'forecast';
const { sorted: sortedHistory, sortBy, state } = useSort<InjuryHistoryEntryDto, HistoryKey>(
  history,
  {
    type: (e) => e.injury.typeLabel,
    season: (e) => e.seasonLabel,
    start: (e) => e.injury.startedOn,
    end: (e) => e.injury.returnedOn,
    days: (e) => e.injury.daysOut,
    forecast: (e) => e.injury.initialExpectedDays ?? null,
  },
  'start',
  { ascendingFirst: ['type'] },
);
const openRow = ref<string | null>(null);
const toggleRow = (id: string) => (openRow.value = openRow.value === id ? null : id);
</script>

<template>
  <section :id="playerId ? undefined : 'lesiones'" class="card scroll-mt-24">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <template v-if="playerId">
          <h2 class="font-semibold text-slate-900"><Icon icon="user-injured" class="mr-2 h-4 w-4 text-danger" />Lesiones</h2>
          <p class="text-xs text-slate-500">Todas las que ha tenido en el club, también en otras temporadas: del parte al alta, lo previsto y lo real. Las registra el cuerpo técnico.</p>
        </template>
        <template v-else>
          <h2 class="font-semibold text-slate-900"><Icon icon="user-injured" class="mr-2 h-4 w-4 text-danger" />Lesionados</h2>
          <p class="text-xs text-slate-500">Quién está lesionado, por qué, cuántos días de baja lleva desde el parte y cuándo se espera que vuelva.</p>
        </template>
      </div>
      <button v-if="canRecord" type="button" class="btn-secondary btn-sm" v-busy="busy" :disabled="busy || loading" :title="busy || loading ? busyTitle : undefined" @click="openNew()">
        <Icon icon="plus" class="mr-1.5 h-3 w-3" />Nueva lesión
      </button>
    </div>

    <Alert v-if="loadError" kind="error">{{ loadError }}</Alert>
    <Alert v-else-if="error && !formOpen && !closing" kind="error" class="mb-3">{{ error }}</Alert>

    <!-- Posibles lesiones: lo que cuentan las crónicas de los partidos -->
    <div v-if="visibleProposals.length > 0" class="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900" role="status">
      <p class="font-semibold">
        <Icon icon="newspaper" class="mr-1.5 h-3.5 w-3.5" />{{ visibleProposals.length === 1 ? 'Posible lesión' : 'Posibles lesiones' }}
        <span class="font-normal">· {{ visibleProposals.length }}</span>
      </p>
      <p class="mt-0.5 text-xs text-amber-800">
        Lo que cuentan las crónicas de los partidos.
        <template v-if="canManage">No es una lesión hasta que la registras; si no fue así, descártala.</template>
        <template v-else>No es una lesión hasta que el club o el cuerpo técnico la registran.</template>
      </p>
      <ul class="mt-1 divide-y divide-amber-200">
        <li v-for="p in visibleProposals" :key="p.id" class="flex flex-wrap items-start justify-between gap-2 py-2">
          <div class="min-w-0 flex-1">
            <p v-if="!playerId" class="font-medium text-slate-800"><PlayerName :name="p.playerName" :photo-url="photoOf(p.squadPlayerId)" /></p>
            <p class="text-xs text-amber-800">
              J{{ p.matchday }} · {{ p.homeTeam }} – {{ p.awayTeam }} · {{ formatDate(p.matchDate) }}<template v-if="p.minute !== null"> · dejó el campo en el {{ p.minute }}'</template>
            </p>
            <blockquote class="mt-1 border-l-2 border-amber-300 pl-2 text-xs italic">«{{ p.excerpt }}»</blockquote>
            <a :href="p.sourceUrl" target="_blank" rel="noopener noreferrer" class="mt-1 inline-block text-xs font-medium text-amber-900 underline underline-offset-2">
              Leer la crónica<Icon icon="up-right-from-square" class="ml-1 h-2.5 w-2.5" />
            </a>
            <p v-if="canManage && openInjuryOf(p.squadPlayerId)" class="mt-1 text-xs text-amber-900">
              <Icon icon="user-injured" class="mr-1 h-3 w-3" />Ya tiene una lesión abierta ({{ injuryWithLocation(openInjuryOf(p.squadPlayerId)!) }}, parte del
              {{ formatDate(openInjuryOf(p.squadPlayerId)!.startedOn) }}). Si es esta, «Es su lesión abierta» la deja como la de este partido; si no, descártala.
            </p>
          </div>
          <div v-if="canManage" class="flex shrink-0 flex-wrap justify-end gap-1">
            <button
              v-if="openInjuryOf(p.squadPlayerId)"
              type="button"
              class="btn-primary btn-sm"
              v-busy="busy"
              :disabled="busy"
              :title="busy ? busyTitle : 'Es la lesión que ya tiene registrada: queda como la de este partido y la posible lesión, registrada'"
              @click="linkProposal(p)"
            >
              <Icon icon="link" class="mr-1 h-3 w-3" />Es su lesión abierta
            </button>
            <button
              v-else
              type="button"
              class="btn-primary btn-sm"
              v-busy="busy"
              :disabled="busy"
              :title="busy ? busyTitle : 'Registrar la lesión con lo que cuenta la crónica: lo revisas antes de guardar'"
              @click="openProposal(p)"
            >
              <Icon icon="user-injured" class="mr-1 h-3 w-3" />Registrar
            </button>
            <button type="button" class="btn-ghost btn-sm px-2.5" v-busy="busy" :disabled="busy" :title="busy ? busyTitle : 'No fue una lesión: deja de proponerse'" @click="dismissProposal(p)">
              Descartar
            </button>
          </div>
        </li>
      </ul>
    </div>

    <!-- Resumen del jugador -->
    <div v-if="playerId && totals && totals.injuries > 0" class="mb-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
      <div class="rounded-xl border border-line bg-surface-2 p-2.5">
        <p class="text-lg font-bold text-slate-900">{{ totals.injuries }}</p>
        <p class="text-2xs text-slate-500">
          {{ totals.injuries === 1 ? 'lesión' : 'lesiones' }}<template v-if="totals.relapses"> · {{ totals.relapses === 1 ? '1 recaída' : `${totals.relapses} recaídas` }}</template>
        </p>
      </div>
      <div class="rounded-xl border border-line bg-surface-2 p-2.5">
        <p class="text-lg font-bold tabular-nums text-slate-900">{{ totals.daysOut }}</p>
        <p class="text-2xs text-slate-500">{{ totals.daysOut === 1 ? 'día de baja' : 'días de baja' }} en total</p>
      </div>
      <div class="rounded-xl border border-line bg-surface-2 p-2.5" title="Media de días del parte al alta de las lesiones superadas">
        <p class="text-lg font-bold tabular-nums text-slate-900">{{ totals.averageRecoveryDays === null ? '—' : `${formatNumber(totals.averageRecoveryDays, 1)} días` }}</p>
        <p class="text-2xs text-slate-500">
          <template v-if="totals.recovered">en recuperarse · {{ totals.recovered === 1 ? '1 superada' : `${totals.recovered} superadas` }}</template>
          <template v-else>ninguna superada todavía</template>
        </p>
      </div>
      <div v-if="playerLeft" class="rounded-xl border border-line bg-surface-2 p-2.5">
        <p class="text-lg font-bold text-slate-500">De baja</p>
        <p class="text-2xs text-slate-500">ya no está en la plantilla</p>
      </div>
      <div v-else class="rounded-xl border border-line bg-surface-2 p-2.5">
        <p class="text-lg font-bold" :class="active.length ? 'text-danger' : 'text-success'">{{ active.length ? 'Lesionado' : 'Disponible' }}</p>
        <p class="text-2xs text-slate-500">ahora</p>
      </div>
    </div>

    <p v-if="!loading && !loadError && playerId && entries.length === 0" class="text-sm text-slate-500">
      No tiene ninguna lesión registrada en el club.<template v-if="canRecord"> Si cae, regístrala aquí y adjunta las pruebas y los informes.</template>
    </p>
    <p v-else-if="!loading && !loadError && !playerId && active.length === 0" class="text-sm text-slate-500">
      No hay nadie lesionado ahora mismo.<template v-if="canManage"> Cuando alguien caiga, regístralo para tenerlo controlado en las convocatorias.</template>
    </p>

    <!-- Lesiones abiertas, con su contador -->
    <ul v-if="active.length > 0" class="divide-y divide-slate-100">
      <li v-for="e in active" :key="e.injury.id" class="py-3">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <p class="font-medium text-slate-800">
              <PlayerName v-if="!playerId" :name="e.injury.playerName" :photo-url="photoOf(e.injury.squadPlayerId)" />
              <Badge tone="red" :class="playerId ? '' : 'ml-2'">{{ e.injury.typeLabel }}</Badge>
              <Badge v-if="e.injury.relapseOfInjuryId" tone="amber" class="ml-1" title="Ha vuelto a lesionarse de lo mismo después del alta">Recaída</Badge>
            </p>
            <p v-if="e.injury.location || injuryFacts(e.injury)" class="mt-0.5 text-sm text-slate-700">
              <template v-if="e.injury.location"><Icon icon="location-dot" class="mr-1 h-3 w-3 text-slate-400" />{{ e.injury.location }}</template>
              <span v-if="injuryFacts(e.injury)" class="text-xs text-slate-500"><template v-if="e.injury.location"> · </template>{{ injuryFacts(e.injury) }}</span>
            </p>
            <p v-if="e.injury.reason" class="mt-0.5 text-sm text-slate-600">{{ e.injury.reason }}</p>
            <p v-if="e.injury.occasion" class="mt-0.5 text-xs text-slate-500">
              <Icon :icon="occasionIcon(e.injury.occasion)" class="mr-1 h-3 w-3" />Se lesionó {{ occasionPlace(e.injury.occasion) }}
            </p>
            <p v-if="e.injury.continuesInjuryId" class="mt-0.5 text-xs text-slate-500">
              Viene de la temporada {{ e.fromSeasonLabel ?? 'anterior' }}: es la misma lesión, que seguía abierta, y los días de baja se cuentan desde aquel parte.
            </p>
          </div>
          <div v-if="canManage" class="flex shrink-0 gap-1">
            <button type="button" class="btn-primary btn-sm" v-busy="busy" :disabled="busy" :title="busy ? busyTitle : 'Dar el alta: el día que se recupera cierra el contador'" @click="openClose(e.injury)"><Icon icon="check" class="mr-1 h-3 w-3" />Alta</button>
            <button type="button" class="btn-ghost btn-sm px-2" v-busy="busy" :disabled="busy" :title="busy ? busyTitle : 'Corregir la lesión'" aria-label="Corregir la lesión" @click="openEdit(e.injury)"><Icon icon="pen" class="h-3.5 w-3.5" /></button>
            <button type="button" class="btn-ghost-danger btn-sm px-2" v-busy="busy" :disabled="busy" :title="busy ? busyTitle : 'Borrar la lesión'" aria-label="Borrar la lesión" @click="remove(e.injury)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <InjuryCounter :injury="e.injury" />
        <InjuryDocuments :squad-id="squadId" :injury="e.injury" :can-manage="canManage" :can-open="canOpenDocuments" @updated="onDocuments" />
      </li>
    </ul>

    <!-- Perfil: lesiones superadas, ordenables -->
    <div v-if="playerId && history.length > 0" class="mt-4">
      <h3 class="mb-2 text-sm font-semibold text-slate-900">Lesiones superadas <span class="font-normal text-slate-400">· {{ history.length }}</span></h3>
      <div class="overflow-x-auto rounded-lg border border-line">
        <table class="table-sticky min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortHeader class="px-3 py-2 text-left" label="Lesión" v-bind="state('type')" @sort="sortBy('type')" />
              <SortHeader class="col-md px-3 py-2 text-left" label="Temporada" v-bind="state('season')" @sort="sortBy('season')" />
              <SortHeader class="px-3 py-2 text-left" label="Parte" title="Día del parte de lesión" v-bind="state('start')" @sort="sortBy('start')" />
              <SortHeader class="px-3 py-2 text-left" label="Alta" title="Día del alta" v-bind="state('end')" @sort="sortBy('end')" />
              <SortHeader class="px-3 py-2 text-right" label="Días" title="Días de baja reales, del parte al alta" v-bind="state('days')" @sort="sortBy('days')" />
              <SortHeader class="col-sm px-3 py-2 text-right" label="Previstos" title="Días de baja previstos al dar el parte" v-bind="state('forecast')" @sort="sortBy('forecast')" />
              <th class="px-2 py-2"><span class="sr-only">Detalle</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <template v-for="e in sortedHistory" :key="e.injury.id">
              <tr class="cursor-pointer hover:bg-surface-2" @click="toggleRow(e.injury.id)">
                <td class="px-3 py-2">
                  <span class="font-medium text-slate-800">{{ e.injury.typeLabel }}</span>
                  <Badge v-if="e.injury.relapseOfInjuryId" tone="amber" class="ml-1" title="Ha vuelto a lesionarse de lo mismo después de un alta">Recaída</Badge>
                  <span v-if="e.injury.location" class="block text-xs text-slate-500">{{ e.injury.location }}</span>
                </td>
                <td class="col-md px-3 py-2 text-slate-600">
                  <template v-if="e.fromSeasonLabel">{{ e.fromSeasonLabel }} → </template>{{ e.seasonLabel }}<span v-if="teamNames.size > 1" class="block text-xs text-slate-500">{{ e.teamName }}</span>
                </td>
                <td class="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">{{ formatDate(e.injury.startedOn) }}</td>
                <td class="whitespace-nowrap px-3 py-2 tabular-nums text-slate-600">
                  <template v-if="e.injury.returnedOn">{{ formatDate(e.injury.returnedOn) }}</template>
                  <span v-else-if="e.injury.continuedOn" class="text-amber-700" :title="`Pasó sin el alta a la temporada siguiente el ${formatDate(e.injury.continuedOn)}`">Pasó sin alta</span>
                  <span v-else class="text-amber-700">Sin alta</span>
                </td>
                <td class="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">{{ e.injury.daysOut }}</td>
                <td class="col-sm whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">
                  <template v-if="e.injury.initialExpectedDays != null">
                    {{ e.injury.initialExpectedDays }}
                    <span v-if="forecastDiff(e.injury)" class="ml-1 text-xs" :class="forecastDiff(e.injury)! > 0 ? 'text-amber-700' : 'text-emerald-600'">
                      {{ forecastDiff(e.injury)! > 0 ? '+' : '−' }}{{ Math.abs(forecastDiff(e.injury)!) }}
                    </span>
                  </template>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="px-2 py-2 text-right">
                  <button type="button" class="btn-ghost px-1.5 py-1" :aria-expanded="openRow === e.injury.id" :aria-label="openRow === e.injury.id ? 'Ocultar el detalle' : 'Ver el detalle'" @click.stop="toggleRow(e.injury.id)">
                    <Icon :icon="openRow === e.injury.id ? 'chevron-up' : 'chevron-down'" class="h-3 w-3" />
                  </button>
                </td>
              </tr>
              <tr v-if="openRow === e.injury.id">
                <td colspan="7" class="bg-surface-2 px-3 py-3 text-sm">
                  <p v-if="injuryFacts(e.injury)" class="text-xs text-slate-600">{{ injuryFacts(e.injury) }}</p>
                  <p v-if="e.injury.reason" class="text-slate-700">{{ e.injury.reason }}</p>
                  <p v-if="e.injury.occasion" class="mt-0.5 text-xs text-slate-600">
                    <Icon :icon="occasionIcon(e.injury.occasion)" class="mr-1 h-3 w-3" />Se lesionó {{ occasionPlace(e.injury.occasion) }}.
                  </p>
                  <p class="mt-0.5 text-xs text-slate-600">
                    <template v-if="e.injury.returnedOn">
                      Del parte ({{ formatDate(e.injury.startedOn) }}) al alta ({{ formatDate(e.injury.returnedOn) }}): {{ daysLabel(e.injury.daysOut) }} de baja<template v-if="forecastNote(e.injury)">; {{ forecastNote(e.injury) }}</template>.
                    </template>
                    <template v-else-if="e.injury.continuedOn">
                      Pasó sin el alta a la temporada siguiente el {{ formatDate(e.injury.continuedOn) }}: {{ daysLabel(e.injury.daysOut) }} de baja desde el parte ({{ formatDate(e.injury.startedOn) }}) hasta entonces.
                    </template>
                    <template v-else>Sin alta registrada: {{ daysLabel(e.injury.daysOut) }} desde el parte ({{ formatDate(e.injury.startedOn) }}).</template>
                  </p>
                  <p v-if="e.fromSeasonLabel" class="mt-0.5 text-xs text-slate-500">
                    El parte es de la temporada {{ e.fromSeasonLabel }}: pasó abierta a la siguiente y es la misma lesión, así que sale una sola vez (con las pruebas e informes de las dos).
                  </p>
                  <p v-if="relapseOf(e.injury)" class="mt-0.5 text-xs text-slate-500">
                    Recaída de la lesión del {{ formatDate(relapseOf(e.injury)!.startedOn) }}<template v-if="relapseOf(e.injury)!.returnedOn">, con el alta el {{ formatDate(relapseOf(e.injury)!.returnedOn!) }}</template>.
                  </p>
                  <p v-if="e.otherSquad" class="mt-0.5 text-xs text-slate-500">Es de la plantilla de {{ e.teamName }} en la temporada {{ e.seasonLabel }}: aquí se consulta; se corrige desde aquella.</p>
                  <p v-else-if="e.injury.playerLeft" class="mt-0.5 text-xs text-slate-500">Causó baja en la plantilla: solo se consulta.</p>
                  <InjuryDocuments :squad-id="e.squadId" :injury="e.injury" :can-manage="editable(e)" :can-open="canOpenDocuments" @updated="onDocuments" />
                  <div v-if="editable(e) || deletable(e)" class="mt-2 flex flex-wrap gap-1">
                    <template v-if="editable(e) && e.injury.returnedOn">
                      <button type="button" class="btn-secondary btn-sm px-2.5" :disabled="!!relapseBlocked(e.injury)" :title="relapseBlocked(e.injury) ?? 'Ha vuelto a lesionarse de lo mismo: lesión nueva enlazada a esta, que conserva su alta'" @click="openRelapse(e.injury)">Recaída</button>
                      <button type="button" class="btn-ghost btn-sm px-2.5" :disabled="!!reopenBlocked(e.injury)" :title="reopenBlocked(e.injury) ?? 'Solo si el alta se dio por error'" @click="reopen(e.injury)">Deshacer el alta</button>
                    </template>
                    <button v-if="deletable(e)" type="button" class="btn-ghost-danger btn-sm px-2" :disabled="busy" :title="busy ? busyTitle : 'Borrar la lesión (registrada por error)'" aria-label="Borrar la lesión" @click="remove(e.injury)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="mt-1.5 text-2xs text-slate-500">Días de baja contados del día del parte al del alta. «Previstos» es lo que se previó al dar el parte: así se ve lo que tardó de verdad frente a lo esperado.</p>
    </div>

    <!-- Plantilla: historial de esta temporada -->
    <details v-if="!playerId && history.length > 0" class="mt-3 text-sm">
      <summary class="cursor-pointer text-slate-500">Historial ({{ history.length }})</summary>
      <ul class="mt-2 divide-y divide-slate-100">
        <li v-for="e in history" :key="e.injury.id" class="flex flex-wrap items-start justify-between gap-2 py-2 text-slate-600">
          <span class="min-w-0 flex-1">
            <PlayerName :name="e.injury.playerName" :photo-url="photoOf(e.injury.squadPlayerId)" class="font-medium text-slate-800" /> · {{ injuryWithLocation(e.injury) }}<template v-if="e.injury.reason"> · {{ e.injury.reason }}</template>
            <Badge v-if="e.injury.relapseOfInjuryId" tone="amber" class="ml-1" title="Ha vuelto a lesionarse de lo mismo después de un alta">Recaída</Badge>
            <span class="block text-xs text-slate-500">
              <template v-if="e.injury.returnedOn">{{ formatDate(e.injury.startedOn) }} → {{ formatDate(e.injury.returnedOn) }} · {{ daysLabel(e.injury.daysOut) }} de baja<template v-if="forecastNote(e.injury)"> · {{ forecastNote(e.injury) }}</template></template>
              <template v-else-if="e.injury.continuedOn">
                Desde el {{ formatDate(e.injury.startedOn) }} · pasó sin el alta a la temporada siguiente el {{ formatDate(e.injury.continuedOn) }} ({{ daysLabel(e.injury.daysOut) }} en esta): se lleva desde allí
              </template>
              <template v-else>Desde el {{ formatDate(e.injury.startedOn) }}, sin alta · {{ daysLabel(e.injury.daysOut) }}</template>
              <template v-if="e.injury.continuesInjuryId"> · viene de la temporada anterior</template>
              <template v-if="e.injury.playerLeft"> · causó baja en la plantilla: solo se consulta</template>
            </span>
            <span v-if="e.injury.occasion" class="block text-xs text-slate-500">
              <Icon :icon="occasionIcon(e.injury.occasion)" class="mr-1 h-2.5 w-2.5" />Se lesionó {{ occasionPlace(e.injury.occasion) }}
            </span>
            <InjuryDocuments :squad-id="squadId" :injury="e.injury" :can-manage="editable(e)" :can-open="canOpenDocuments" @updated="onDocuments" />
          </span>
          <span v-if="canManage" class="flex flex-wrap gap-1">
            <template v-if="editable(e) && e.injury.returnedOn">
              <button type="button" class="btn-ghost btn-sm px-2" :disabled="!!relapseBlocked(e.injury)" :title="relapseBlocked(e.injury) ?? 'Ha vuelto a lesionarse de lo mismo: lesión nueva enlazada a esta, que conserva su alta'" @click="openRelapse(e.injury)">Recaída</button>
              <button type="button" class="btn-ghost btn-sm px-2" :disabled="!!reopenBlocked(e.injury)" :title="reopenBlocked(e.injury) ?? 'Solo si el alta se dio por error'" @click="reopen(e.injury)">Deshacer el alta</button>
            </template>
            <button type="button" class="btn-ghost-danger btn-sm px-2" v-busy="busy" :disabled="busy" :title="busy ? busyTitle : 'Borrar la lesión (registrada por error)'" aria-label="Borrar" @click="remove(e.injury)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
          </span>
        </li>
      </ul>
    </details>

    <!-- Lesión nueva, corrección o recaída, con dónde se lesionó -->
    <InjuryFormModal
      :open="formOpen"
      :squad-id="squadId"
      :mode="formState.mode"
      :target="formState.target"
      :preset="formState.preset"
      :players="formPlayers"
      :injured-player-ids="injuredPlayerIds"
      :start-min="formStartMin"
      @close="formOpen = false"
      @saved="onSaved"
    />

    <!-- Alta -->
    <Modal :open="!!closing" :title="closing ? `Dar de alta a ${closing.playerName}` : 'Dar de alta'" size="md" @close="closing = null">
      <form id="injury-close-form" class="space-y-4" @submit.prevent="confirmClose">
        <Alert v-if="error" kind="error">{{ error }}</Alert>
        <div>
          <label class="label" for="injury-returned">Día del alta</label>
          <input id="injury-returned" v-model="returnedOn" type="date" required class="input w-44" :min="closing?.startedOn" :max="today" />
        </div>
        <p v-if="closing && closingDays !== null && closingDays >= 0" class="text-sm text-slate-600">
          Del parte ({{ formatDate(closing.startedOn) }}) al alta: <strong class="text-slate-900">{{ daysLabel(closingDays) }} de baja</strong><template v-if="closing.initialExpectedDays != null">, con {{ closing.initialExpectedDays }} previstos al dar el parte</template>.
        </p>
        <p class="text-xs text-slate-500">La lesión pasa al historial y deja de salir como lesionado en la plantilla, las convocatorias y los entrenamientos.</p>
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="closing = null">Cancelar</button>
          <button type="submit" form="injury-close-form" class="btn-primary" v-busy="busy" :disabled="!!closeBlocked" :title="closeBlocked">Dar de alta</button>
        </div>
      </template>
    </Modal>
  </section>
</template>
