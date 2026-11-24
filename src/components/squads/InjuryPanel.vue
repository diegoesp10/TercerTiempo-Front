<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import type { InjuryDto, InjuryHistoryEntryDto, InjuryRequest, InjuryType, InjuryTypeDto, PlayerInjuryHistoryDto, SquadPlayerDto } from '@/types/api';
import { formatDate, formatNumber } from '@/utils/format';
import { confirmDialog } from '@/composables/useConfirm';
import { useSort } from '@/composables/useSort';
import { useViewer } from '@/composables/useViewer';
import PlayerName from '@/components/players/PlayerName.vue';
import InjuryCounter from '@/components/squads/InjuryCounter.vue';
import InjuryDocuments from '@/components/squads/InjuryDocuments.vue';

// Control de lesionados de la plantilla: cada lesión abierta con su contador de días de baja (reales, contados desde el
// parte) y lo que falta para la vuelta prevista; el alta con su día, las recaídas, el historial y las pruebas e informes
// de cada una. Opcional para el cuerpo técnico; los jugadores vinculados ven las suyas sin poder tocarlas. Con playerId
// es el historial de un solo jugador (su perfil): todas sus lesiones en el club, también de otras temporadas, con lo que
// tardó de verdad en recuperarse de cada una frente a lo previsto al dar el parte. Las de quien causó baja en la plantilla
// (playerLeft) son historial: se consultan y se pueden borrar, nada más. Lo mismo la que pasó abierta a la temporada
// siguiente (continuedOn): allí sigue, con su parte (continuesInjuryId), y en el perfil sale una sola vez.
const props = defineProps<{ squadId: string; players: SquadPlayerDto[]; canManage: boolean; playerId?: string | null; playerLeft?: boolean }>();

const photoOf = (squadPlayerId: string) => props.players.find((p) => p.id === squadPlayerId)?.photoUrl ?? null;
const emit = defineEmits<{ changed: [] }>();

const injuries = shallowRef<InjuryDto[]>([]);
const profile = shallowRef<PlayerInjuryHistoryDto | null>(null);
const types = shallowRef<InjuryTypeDto[]>([]);
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
    const [, list] = await Promise.all([fetchList(), types.value.length ? Promise.resolve(types.value) : api.squads.injuryTypes()]);
    types.value = list;
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(() => [props.squadId, props.playerId], load);

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

const busy = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const busyTitle = 'Espera a que termine lo que se está guardando';

async function act(fn: () => Promise<InjuryDto[]>) {
  busy.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    const list = await fn();
    if (props.playerId) await fetchList().catch((e) => (loadError.value = errorMessage(e)));
    else injuries.value = list;
    emit('changed');
    return true;
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
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
const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDay(date);
};
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

// --- Formulario: lesión nueva, corrección o recaída ---
type FormMode = 'new' | 'edit' | 'relapse';
const mode = ref<FormMode>('new');
const target = ref<InjuryDto | null>(null);
const formOpen = ref(false);
const form = reactive<{ squadPlayerId: string | null; type: InjuryType | null; reason: string; startedOn: string; expectedReturnOn: string }>({
  squadPlayerId: null,
  type: null,
  reason: '',
  startedOn: today,
  expectedReturnOn: '',
});

const playerOptions = computed<SelectOption[]>(() => {
  const injured = new Set(active.value.map((e) => e.injury.squadPlayerId));
  return props.players
    .filter((p) => p.status === 'Active')
    .map((p) => ({ value: p.id, label: p.fullName, disabled: injured.has(p.id) && target.value?.squadPlayerId !== p.id, photo: p.photoUrl ?? null }));
});
// Solo se ofrecen los tipos que el administrador no ha retirado; al corregir una lesión que tiene uno retirado (o al
// registrar su recaída), ese sigue disponible para ella.
const typeOptions = computed<SelectOption[]>(() => {
  const options = types.value.map((t) => ({ value: t.type, label: t.label, hint: t.averageDays ? `≈ ${t.averageDays} días` : 'sin referencia' }));
  const current = target.value;
  if (current && !types.value.some((t) => t.type === current.type))
    options.push({ value: current.type, label: current.typeLabel, hint: 'ya no se ofrece para lesiones nuevas' });
  return options;
});
const averageDays = computed(() => types.value.find((t) => t.type === form.type)?.averageDays ?? (target.value?.type === form.type ? target.value?.averageDays : null) ?? null);
// El parte es de un día ya vivido; la recaída, además, no puede empezar antes del alta de la que viene.
const startMin = computed(() => {
  const t = target.value;
  if (!t) return undefined;
  if (mode.value === 'relapse') return t.returnedOn ?? undefined;
  if (mode.value === 'edit' && t.relapseOfInjuryId) return relapseOf(t)?.returnedOn ?? undefined;
  return undefined;
});

// Al elegir tipo o cambiar el día del parte se propone la vuelta con la duración media; el técnico puede corregirla.
function proposeReturn() {
  const days = averageDays.value;
  form.expectedReturnOn = days && form.startedOn ? addDays(form.startedOn, days) : '';
}

function openForm(next: FormMode, injury: InjuryDto | null) {
  mode.value = next;
  target.value = injury;
  error.value = null;
  fieldErrors.value = {};
  formOpen.value = true;
}

function openNew(playerId: string | null = props.playerId ?? null) {
  form.squadPlayerId = playerId;
  form.type = null;
  form.reason = '';
  form.startedOn = today;
  form.expectedReturnOn = '';
  openForm('new', null);
}

function openEdit(injury: InjuryDto) {
  form.squadPlayerId = injury.squadPlayerId;
  form.type = injury.type;
  form.reason = injury.reason ?? '';
  form.startedOn = injury.startedOn;
  form.expectedReturnOn = injury.expectedReturnOn ?? '';
  openForm('edit', injury);
}

function openRelapse(injury: InjuryDto) {
  form.squadPlayerId = injury.squadPlayerId;
  form.type = injury.type;
  form.reason = '';
  form.startedOn = today;
  openForm('relapse', injury);
  proposeReturn();
}

const formTitle = computed(() => (mode.value === 'edit' ? 'Corregir la lesión' : mode.value === 'relapse' ? `Recaída de ${target.value?.playerName ?? 'la lesión'}` : 'Nueva lesión'));
const formBlocked = computed(() => {
  if (busy.value) return busyTitle;
  if (mode.value === 'new' && !form.squadPlayerId) return 'Elige al jugador';
  if (!form.type) return 'Elige el tipo de lesión';
  if (!form.startedOn) return 'Pon la fecha del parte';
  if (form.startedOn > today) return 'La fecha del parte no puede ser posterior a hoy';
  if (startMin.value && form.startedOn < startMin.value) return 'La recaída no puede empezar antes del alta de la lesión anterior';
  if (form.expectedReturnOn && form.expectedReturnOn < form.startedOn) return 'La vuelta prevista no puede ser anterior al parte';
  return undefined;
});

const request = (): InjuryRequest => ({
  squadPlayerId: form.squadPlayerId,
  type: form.type as InjuryType,
  reason: form.reason.trim() || null,
  startedOn: form.startedOn,
  expectedReturnOn: form.expectedReturnOn || null,
});

async function save() {
  if (formBlocked.value) return;
  const t = target.value;
  let ok: boolean;
  if (mode.value === 'edit' && t) ok = await act(() => api.squads.updateInjury(props.squadId, t.id, request()));
  else if (mode.value === 'relapse' && t)
    ok = await act(() => api.squads.relapseInjury(props.squadId, t.id, { startedOn: form.startedOn, expectedReturnOn: form.expectedReturnOn || null, reason: form.reason.trim() || null }));
  else ok = await act(() => api.squads.recordInjury(props.squadId, request()));
  if (ok) formOpen.value = false;
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
  <section class="card">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <template v-if="playerId">
          <h2 class="font-semibold text-slate-900"><Icon icon="user-injured" class="mr-2 h-4 w-4 text-red-500" />Lesiones</h2>
          <p class="text-xs text-slate-500">Todas las que ha tenido en el club, también en otras temporadas: del parte al alta, lo previsto y lo real. Las registra el cuerpo técnico.</p>
        </template>
        <template v-else>
          <h2 class="font-semibold text-slate-900"><Icon icon="user-injured" class="mr-2 h-4 w-4 text-red-500" />Lesionados</h2>
          <p class="text-xs text-slate-500">Quién está lesionado, por qué, cuántos días de baja lleva desde el parte y cuándo se espera que vuelva.</p>
        </template>
      </div>
      <button v-if="canRecord" type="button" class="btn-secondary px-3 py-1 text-xs" v-busy="busy" :disabled="busy || loading" :title="busy || loading ? busyTitle : undefined" @click="openNew()">
        <Icon icon="plus" class="mr-1.5 h-3 w-3" />Nueva lesión
      </button>
    </div>

    <Alert v-if="loadError" kind="error">{{ loadError }}</Alert>
    <Alert v-else-if="error && !formOpen && !closing" kind="error" class="mb-3">{{ error }}</Alert>

    <!-- Resumen del jugador -->
    <div v-if="playerId && totals && totals.injuries > 0" class="mb-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
      <div class="rounded-xl border border-line bg-surface-2 p-2.5">
        <p class="text-lg font-bold text-slate-900">{{ totals.injuries }}</p>
        <p class="text-[11px] text-slate-500">
          {{ totals.injuries === 1 ? 'lesión' : 'lesiones' }}<template v-if="totals.relapses"> · {{ totals.relapses === 1 ? '1 recaída' : `${totals.relapses} recaídas` }}</template>
        </p>
      </div>
      <div class="rounded-xl border border-line bg-surface-2 p-2.5">
        <p class="text-lg font-bold tabular-nums text-slate-900">{{ totals.daysOut }}</p>
        <p class="text-[11px] text-slate-500">{{ totals.daysOut === 1 ? 'día de baja' : 'días de baja' }} en total</p>
      </div>
      <div class="rounded-xl border border-line bg-surface-2 p-2.5" title="Media de días del parte al alta de las lesiones superadas">
        <p class="text-lg font-bold tabular-nums text-slate-900">{{ totals.averageRecoveryDays === null ? '—' : `${formatNumber(totals.averageRecoveryDays, 1)} días` }}</p>
        <p class="text-[11px] text-slate-500">
          <template v-if="totals.recovered">en recuperarse · {{ totals.recovered === 1 ? '1 superada' : `${totals.recovered} superadas` }}</template>
          <template v-else>ninguna superada todavía</template>
        </p>
      </div>
      <div v-if="playerLeft" class="rounded-xl border border-line bg-surface-2 p-2.5">
        <p class="text-lg font-bold text-slate-500">De baja</p>
        <p class="text-[11px] text-slate-500">ya no está en la plantilla</p>
      </div>
      <div v-else class="rounded-xl border border-line bg-surface-2 p-2.5">
        <p class="text-lg font-bold" :class="active.length ? 'text-red-500' : 'text-emerald-500'">{{ active.length ? 'Lesionado' : 'Disponible' }}</p>
        <p class="text-[11px] text-slate-500">ahora</p>
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
            <p v-if="e.injury.reason" class="mt-0.5 text-sm text-slate-600">{{ e.injury.reason }}</p>
            <p v-if="e.injury.continuesInjuryId" class="mt-0.5 text-xs text-slate-500">
              Viene de la temporada {{ e.fromSeasonLabel ?? 'anterior' }}: es la misma lesión, que seguía abierta, y los días de baja se cuentan desde aquel parte.
            </p>
          </div>
          <div v-if="canManage" class="flex shrink-0 gap-1">
            <button type="button" class="btn-primary px-3 py-1 text-xs" v-busy="busy" :disabled="busy" :title="busy ? busyTitle : 'Dar el alta: el día que se recupera cierra el contador'" @click="openClose(e.injury)"><Icon icon="check" class="mr-1 h-3 w-3" />Alta</button>
            <button type="button" class="btn-ghost px-2 py-1 text-xs" v-busy="busy" :disabled="busy" :title="busy ? busyTitle : 'Corregir la lesión'" aria-label="Corregir la lesión" @click="openEdit(e.injury)"><Icon icon="pen" class="h-3.5 w-3.5" /></button>
            <button type="button" class="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" v-busy="busy" :disabled="busy" :title="busy ? busyTitle : 'Borrar la lesión'" aria-label="Borrar la lesión" @click="remove(e.injury)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
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
                  <p v-if="e.injury.reason" class="text-slate-700">{{ e.injury.reason }}</p>
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
                      <button type="button" class="btn-secondary px-2.5 py-1 text-xs" :disabled="!!relapseBlocked(e.injury)" :title="relapseBlocked(e.injury) ?? 'Ha vuelto a lesionarse de lo mismo: lesión nueva enlazada a esta, que conserva su alta'" @click="openRelapse(e.injury)">Recaída</button>
                      <button type="button" class="btn-ghost px-2.5 py-1 text-xs" :disabled="!!reopenBlocked(e.injury)" :title="reopenBlocked(e.injury) ?? 'Solo si el alta se dio por error'" @click="reopen(e.injury)">Deshacer el alta</button>
                    </template>
                    <button v-if="deletable(e)" type="button" class="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" :disabled="busy" :title="busy ? busyTitle : 'Borrar la lesión (registrada por error)'" aria-label="Borrar la lesión" @click="remove(e.injury)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <p class="mt-1.5 text-[11px] text-slate-500">Días de baja contados del día del parte al del alta. «Previstos» es lo que se previó al dar el parte: así se ve lo que tardó de verdad frente a lo esperado.</p>
    </div>

    <!-- Plantilla: historial de esta temporada -->
    <details v-if="!playerId && history.length > 0" class="mt-3 text-sm">
      <summary class="cursor-pointer text-slate-500">Historial ({{ history.length }})</summary>
      <ul class="mt-2 divide-y divide-slate-100">
        <li v-for="e in history" :key="e.injury.id" class="flex flex-wrap items-start justify-between gap-2 py-2 text-slate-600">
          <span class="min-w-0 flex-1">
            <PlayerName :name="e.injury.playerName" :photo-url="photoOf(e.injury.squadPlayerId)" class="font-medium text-slate-800" /> · {{ e.injury.typeLabel }}<template v-if="e.injury.reason"> · {{ e.injury.reason }}</template>
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
            <InjuryDocuments :squad-id="squadId" :injury="e.injury" :can-manage="editable(e)" :can-open="canOpenDocuments" @updated="onDocuments" />
          </span>
          <span v-if="canManage" class="flex flex-wrap gap-1">
            <template v-if="editable(e) && e.injury.returnedOn">
              <button type="button" class="btn-ghost px-2 py-1 text-xs" :disabled="!!relapseBlocked(e.injury)" :title="relapseBlocked(e.injury) ?? 'Ha vuelto a lesionarse de lo mismo: lesión nueva enlazada a esta, que conserva su alta'" @click="openRelapse(e.injury)">Recaída</button>
              <button type="button" class="btn-ghost px-2 py-1 text-xs" :disabled="!!reopenBlocked(e.injury)" :title="reopenBlocked(e.injury) ?? 'Solo si el alta se dio por error'" @click="reopen(e.injury)">Deshacer el alta</button>
            </template>
            <button type="button" class="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" v-busy="busy" :disabled="busy" :title="busy ? busyTitle : 'Borrar la lesión (registrada por error)'" aria-label="Borrar" @click="remove(e.injury)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
          </span>
        </li>
      </ul>
    </details>

    <!-- Lesión nueva, corrección o recaída -->
    <Modal :open="formOpen" :title="formTitle" size="md" @close="formOpen = false">
      <form id="injury-form" class="space-y-4" @submit.prevent="save">
        <Alert v-if="error" kind="error">{{ error }}</Alert>
        <p v-if="mode === 'relapse' && target" class="text-sm text-slate-600">
          Ha vuelto a lesionarse de lo mismo después del alta del {{ formatDate(target.returnedOn ?? target.startedOn) }}. Se registra como lesión nueva, enlazada a la
          anterior, que conserva su alta y los {{ daysLabel(target.daysOut) }} que tardó en recuperarse.
        </p>
        <div v-if="mode !== 'relapse'">
          <label class="label" for="injury-player">Jugador</label>
          <SearchSelect id="injury-player" placeholder="Elige al jugador" :disabled="mode === 'edit' || !!playerId" :model-value="form.squadPlayerId" :options="playerOptions" @update:model-value="form.squadPlayerId = ($event as string | null)" />
        </div>
        <div>
          <label class="label" for="injury-type">Tipo de lesión</label>
          <SearchSelect id="injury-type" placeholder="Elige el tipo" :disabled="mode === 'relapse'" :model-value="form.type" :options="typeOptions" @update:model-value="form.type = ($event as InjuryType | null); proposeReturn()" />
          <p v-if="averageDays" class="mt-1 text-xs text-slate-500">Duración media orientativa: {{ averageDays }} días. La vuelta prevista se propone con ella; cámbiala si el médico dice otra cosa.</p>
        </div>
        <div>
          <label class="label" for="injury-reason">Motivo o detalle <span class="font-normal text-slate-400">(opcional)</span></label>
          <input id="injury-reason" v-model="form.reason" type="text" maxlength="300" class="input" placeholder="Golpe en el entrenamiento del martes, isquio derecho…" />
          <p v-if="fieldErrors.reason" class="field-error">{{ fieldErrors.reason[0] }}</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="injury-start">Fecha del parte</label>
            <input id="injury-start" v-model="form.startedOn" type="date" required class="input" :min="startMin" :max="today" @change="proposeReturn()" />
            <p class="mt-1 text-[11px] text-slate-500">Desde ese día cuentan los días de baja.</p>
          </div>
          <div>
            <label class="label" for="injury-return">Vuelta prevista <span class="font-normal text-slate-400">(opcional)</span></label>
            <input id="injury-return" v-model="form.expectedReturnOn" type="date" class="input" :min="form.startedOn" />
            <p v-if="fieldErrors.expectedReturnOn" class="field-error">{{ fieldErrors.expectedReturnOn[0] }}</p>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="formOpen = false">Cancelar</button>
          <button type="submit" form="injury-form" class="btn-primary" v-busy="busy" :disabled="!!formBlocked" :title="formBlocked">
            {{ mode === 'edit' ? 'Guardar' : mode === 'relapse' ? 'Registrar la recaída' : 'Registrar lesión' }}
          </button>
        </div>
      </template>
    </Modal>

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
