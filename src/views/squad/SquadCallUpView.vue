<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import PlayerName from '@/components/players/PlayerName.vue';
import DisciplineBadge from '@/components/squads/DisciplineBadge.vue';
import TeamName from '@/components/teams/TeamName.vue';
import CallUpReviewModal, { type ReviewGroup, type ReviewPlayer } from '@/components/trainings/CallUpReviewModal.vue';
import GroundCard from '@/components/trainings/GroundCard.vue';
import GroundPicker from '@/components/trainings/GroundPicker.vue';
import InjuryNote from '@/components/trainings/InjuryNote.vue';
import SuspensionNote from '@/components/trainings/SuspensionNote.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import GroupByPositionToggle from '@/components/ui/GroupByPositionToggle.vue';
import Modal from '@/components/ui/Modal.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAsync } from '@/composables/useAsync';
import { useGroupByPosition } from '@/composables/usePositionGrouping';
import { useLivePoll } from '@/composables/useLivePoll';
import { useSquad } from '@/composables/useSquad';
import { useViewer } from '@/composables/useViewer';
import { markCallUpsSeen } from '@/composables/useCallUpSeen';
import { useAlertsStore } from '@/stores/alerts';
import type { CallUpEntryDto, CallUpRequest, CallUpResponse, GroundDto, MatchCallUpDto, Position, SquadGroundsDto } from '@/types/api';
import { opponentOf } from '@/utils/crests';
import { warnedDiscipline } from '@/utils/discipline';
import { callUpResponseLabels, callUpResponseTone, formatKickoff, positionLabels, positionShortLabels, toDateKey } from '@/utils/format';

/**
 * La convocatoria de un partido: el cuerpo técnico elige quién va (por posición, viendo cuántos lleva de cada una), pone
 * la cita (día, hora y un campo de la liga con su mapa, o un sitio alternativo escrito a mano), la repasa y la envía (se
 * avisa a toda la plantilla, al que va y al que no); cada jugador la firma desde aquí o desde «Mis convocatorias». Como
 * en un chat, el cuerpo técnico ve un check cuando le ha llegado y el doble check verde cuando el jugador la ha abierto;
 * la firma va aparte. No hay «no puedo» para los partidos: lo que cambie se habla con el cuerpo técnico. La página se
 * pone al día sola: quien la tenga abierta ve al momento quién firma o la abre, sin recargar. Enviada, la lista queda fija
 * y el cuerpo técnico la filtra (quién la ha visto, quién ha respondido, a quién le falta firmar); para cambiarla,
 * «Modificar la convocatoria».
 */
const props = defineProps<{ matchId: string }>();

const { squadId, detail } = useSquad();
const alerts = useAlertsStore();

const { data, loading, error, run } = useAsync(() => api.trainings.callUp(squadId.value, props.matchId));
// Sube con cada acción propia (guardar, enviar, firmar, cambiar de partido): una recarga en segundo plano que llegue
// después no la pisa.
let actions = 0;
watch(() => props.matchId, () => {
  actions++;
  void run();
});

const teamId = computed(() => detail.value?.summary.teamId ?? '');
const players = computed(() => detail.value?.players ?? []);
const photos = computed<Record<string, string | null>>(() => Object.fromEntries(players.value.map((p) => [p.id, p.photoUrl])));
const positionOf = computed<Record<string, Position | null>>(() => Object.fromEntries(players.value.map((p) => [p.id, p.position])));

const canEdit = computed(() => (data.value?.canEdit ?? false) && !(data.value?.closed ?? false));
// Enviada, la lista queda fija: mirando quién ha firmado nadie cambia a un jugador sin querer. «Modificar la convocatoria»
// la abre a propósito y, al guardar, se repasa quién entra y quién sale.
const editing = ref(false);
const locked = computed(() => canEdit.value && data.value?.status === 'Published' && !editing.value);
const editable = computed(() => canEdit.value && !locked.value);
// La previa es del club y del cuerpo técnico (y del administrador, que mira); los jugadores no la tienen.
const { isAdmin } = useViewer();
const seesPreview = computed(() => isAdmin.value || !!detail.value?.canManage || !!detail.value?.canInvitePlayers || detail.value?.summary.myRole != null);

// Los campos de la liga, para la cita (solo hacen falta a quien la prepara).
const grounds = ref<SquadGroundsDto | null>(null);
watch(
  canEdit,
  async (can) => {
    if (!can || grounds.value) return;
    try {
      grounds.value = await api.trainings.grounds(squadId.value);
    } catch {
      grounds.value = { homeGroundId: null, grounds: [] };
    }
  },
  { immediate: true },
);
const groundList = computed<GroundDto[]>(() => {
  const list = grounds.value?.grounds ?? [];
  const extra = [data.value?.meetGround, data.value?.matchGround].filter((g): g is GroundDto => !!g && !list.some((x) => x.id === g.id));
  return [...list, ...extra];
});

// Borrador local de lo que el cuerpo técnico está preparando.
const called = ref(new Set<string>());
const meet = ref({ date: '', time: '', groundId: null as string | null, place: '', notes: '' });
const busy = ref<'draft' | 'publish' | 'respond' | 'resend' | null>(null);
const actionError = ref<string | null>(null);
const reviewOpen = ref(false);

// A cuántos se convoca: el número fijo de la plantilla o el que se diga aquí (se pregunta al empezar la convocatoria).
// Es exacto: no se puede marcar a más y, si se envía con menos, el cuerpo técnico y el club reciben un aviso.
const sizeMin = 7;
const sizeMax = 30;
const size = ref<number | null>(null);
const sizeAskOpen = ref(false);
const sizeDraft = ref<number | null>(null);
const sizeValid = (n: number | null) => n !== null && Number.isInteger(n) && n >= sizeMin && n <= sizeMax;
function openSizeAsk() {
  sizeDraft.value = size.value ?? data.value?.suggestedSize ?? null;
  sizeAskOpen.value = true;
}
function confirmSize() {
  if (!sizeValid(sizeDraft.value)) return;
  size.value = sizeDraft.value;
  sizeAskOpen.value = false;
}

const timeOf = (at: Date) => `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
function savedMeet(dto: MatchCallUpDto) {
  const at = dto.meetAt ? new Date(dto.meetAt) : null;
  return { date: at ? toDateKey(at) : '', time: at ? timeOf(at) : '', groundId: dto.meetGround?.id ?? null, place: dto.meetPlace ?? '', notes: dto.notes ?? '' };
}

// No puede ir quien está lesionado el día del partido o sancionado para este partido.
const blocked = (e: CallUpEntryDto) => e.injured || e.suspended;
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
function blockedTitle(e: CallUpEntryDto) {
  if (e.suspended) return `Sancionado para este partido${e.suspension ? ` (${lowerFirst(e.suspension.reason)})` : ''}: no puede ir convocado`;
  if (e.injured) return 'Lesionado el día del partido: no puede ir convocado';
  return undefined;
}

// ask: false en las recargas en segundo plano, para no volver a preguntar a cuántos se convoca cada pocos segundos.
function take(dto: MatchCallUpDto, ask = true) {
  // Quien no puede ir (lesionado o sancionado): si estaba en lo enviado, el borrador ya lo quita.
  called.value = new Set(dto.entries.filter((e) => e.called && !(dto.canEdit && blocked(e))).map((e) => e.squadPlayerId));
  meet.value = savedMeet(dto);
  size.value = dto.size ?? null;
  // Una convocatoria nueva propone el campo del partido.
  if (!dto.id && dto.canEdit && dto.matchGround) meet.value.groundId = dto.matchGround.id;
  // Sin número fijo, se pregunta a cuántos se convoca antes de empezar (a una ya enviada, al modificarla).
  if (ask && dto.canEdit && !dto.closed && dto.status !== 'Published' && !dto.sizeFixed && dto.size == null) openSizeAsk();
}
// La recarga en segundo plano solo pone al día lo que se ve: lo que el cuerpo técnico tiene a medias no se pisa.
let background: { keepDraft: boolean } | null = null;
watch(data, (dto) => {
  if (!dto) return;
  const quiet = background;
  background = null;
  if (!quiet) take(dto);
  else if (!quiet.keepDraft) take(dto, false);
  // Quien la abre es el jugador: doble check para el cuerpo técnico.
  if (dto.id && dto.status === 'Published' && dto.mine) markCallUpsSeen([{ callUpId: dto.id, closed: dto.closed, mine: dto.mine }]);
}, { immediate: true });

const savedCalled = computed(() => new Set((data.value?.entries ?? []).filter((e) => e.called).map((e) => e.squadPlayerId)));
// Lo que sale marcado: el borrador mientras se prepara o se modifica; con la lista fija, lo enviado.
const shownCalled = computed(() => (editable.value ? called.value : savedCalled.value));
const meetChanged = computed(() => {
  if (!data.value) return false;
  const saved = savedMeet(data.value);
  const now = meet.value;
  return saved.date !== now.date || saved.time !== now.time || saved.groundId !== now.groundId || (!now.groundId && saved.place !== now.place.trim());
});
const dirty = computed(() => {
  if (!data.value) return false;
  const saved = savedCalled.value;
  if (saved.size !== called.value.size || [...called.value].some((id) => !saved.has(id))) return true;
  if (size.value !== (data.value.size ?? null)) return true;
  return meetChanged.value || (data.value.notes ?? '') !== meet.value.notes.trim();
});

const over = computed(() => (size.value !== null ? Math.max(0, called.value.size - size.value) : 0));
const missing = computed(() => (size.value !== null ? Math.max(0, size.value - called.value.size) : 0));
const full = computed(() => size.value !== null && called.value.size >= size.value);
const fullTitle = computed(() => `Ya tienes a los ${size.value} convocados: quita a alguno para meter a otro`);
// Por qué no se puede guardar o enviar todavía (los botones lo dicen al pasar por encima).
const sizeBlocked = computed(() => {
  if (size.value === null) return 'Di primero a cuántos convocas';
  if (over.value > 0) return `La convocatoria es de ${size.value} y llevas ${called.value.size}: quita a ${over.value}`;
  return undefined;
});
const draftBlocked = computed(() => {
  if (busy.value !== null) return 'Espera a que termine lo que se está guardando';
  if (!dirty.value) return 'No has cambiado nada';
  return sizeBlocked.value;
});
const sendBlocked = computed(() => {
  if (busy.value !== null) return 'Espera a que termine lo que se está guardando';
  if (called.value.size === 0) return 'Convoca al menos a un jugador';
  if (data.value?.status === 'Published' && !dirty.value) return 'No has cambiado nada';
  return sizeBlocked.value;
});

// En directo: cada pocos segundos se pregunta solo por la huella de la convocatoria y, si ha cambiado (alguien firma o la
// abre, el cuerpo técnico cambia a quién lleva o la cita, empieza el partido), se vuelve a pedir entera, sin barra de
// carga. Con la pestaña oculta no se pregunta; al volver a ella, en el momento.
const LIVE_EVERY_MS = 15_000;
const live = computed(() => !!data.value && !data.value.closed && busy.value === null);
useLivePoll(async () => {
  const current = data.value;
  if (!current) return;
  const started = actions;
  const { stamp } = await api.trainings.callUpStamp(squadId.value, props.matchId);
  if (stamp === current.stamp || started !== actions) return;
  const keepDraft = editable.value && dirty.value;
  const fresh = await api.trainings.callUp(squadId.value, props.matchId, true);
  if (started !== actions || data.value !== current) return;
  background = { keepDraft };
  data.value = fresh;
}, LIVE_EVERY_MS, live);

const sorted = computed(() => [...(data.value?.entries ?? [])].sort((a, b) => a.playerName.localeCompare(b.playerName, 'es')));

// Por posición, como en la plantilla: cuántos van de cada una.
const groupByPosition = useGroupByPosition('call-up', true);
const positionOrder: (Position | null)[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', null];
// Para el cuerpo técnico, con la convocatoria enviada: de un vistazo, quién la ha abierto, quién ha respondido (firmado
// si va, «Enterado» si no) y a quién le falta firmar. Son las mismas cuentas que «Entrega» y «Firmas».
type CallUpFilter = 'all' | 'seen' | 'responded' | 'pending';
const filter = ref<CallUpFilter>('all');
const filterTests: Record<Exclude<CallUpFilter, 'all'>, (e: CallUpEntryDto) => boolean> = {
  seen: (e) => !!e.seenAt,
  responded: (e) => (e.called && e.response === 'Confirmed') || (!e.called && e.response === 'Acknowledged'),
  pending: (e) => e.called && e.response === 'Pending',
};
// Mientras se modifica, la lista entera: hace falta para meter o quitar a quien sea.
const showsFilter = computed(() => !!data.value?.canEdit && data.value.status === 'Published' && !editable.value);
const activeFilter = computed<CallUpFilter>(() => (showsFilter.value ? filter.value : 'all'));
const filterOptions = computed(() => {
  const entries = data.value?.entries ?? [];
  const count = (key: Exclude<CallUpFilter, 'all'>) => entries.filter(filterTests[key]).length;
  return [
    { key: 'all' as const, label: 'Todos', icon: null, count: entries.length, title: 'Toda la plantilla', empty: '' },
    { key: 'seen' as const, label: 'La han visto', icon: 'check-double', count: count('seen'), title: 'Los que han abierto la convocatoria (doble check verde)', empty: 'Todavía no la ha abierto nadie' },
    { key: 'responded' as const, label: 'Han respondido', icon: null, count: count('responded'), title: 'Convocados que la han firmado y no convocados que han dado el «Enterado»', empty: 'Todavía no ha respondido nadie' },
    { key: 'pending' as const, label: 'Sin firmar', icon: null, count: count('pending'), title: 'Convocados que todavía no la han firmado', empty: 'Ya la han firmado todos los convocados' },
  ];
});
const filterEmpty = computed(() => filterOptions.value.find((o) => o.key === activeFilter.value)?.empty ?? '');
watch(() => props.matchId, () => {
  editing.value = false;
  filter.value = 'all';
});

const shown = (entries: CallUpEntryDto[]) => (activeFilter.value === 'all' ? entries : entries.filter(filterTests[activeFilter.value]));
const calledIn = (entries: CallUpEntryDto[]) => entries.filter((e) => shownCalled.value.has(e.squadPlayerId)).length;
function positionGroups(list: CallUpEntryDto[]) {
  return positionOrder
    .map((p) => {
      const entries = list.filter((e) => (positionOf.value[e.squadPlayerId] ?? null) === p);
      return { key: p ?? 'none', label: p ? `${positionLabels[p]}s` : 'Sin posición', short: p ? positionShortLabels[p] : 'S/P', entries, called: calledIn(entries) };
    })
    .filter((g) => g.entries.length > 0);
}
// Quien causó baja después del partido sigue en la convocatoria que se le hizo (es historial), en su grupo «De baja».
const current = computed(() => sorted.value.filter((e) => !e.left));
// Cuántos van de cada posición: con toda la plantilla, haya o no filtro.
const byPosition = computed(() => positionGroups(current.value));
const groups = computed(() => {
  const list = shown(current.value);
  const left = shown(sorted.value.filter((e) => e.left));
  return [
    ...(groupByPosition.value ? positionGroups(list) : [{ key: 'all', label: '', short: '', entries: list, called: calledIn(list) }]),
    ...(left.length > 0 ? [{ key: 'left', label: 'De baja', short: 'Baja', entries: left, called: calledIn(left) }] : []),
  ].filter((g) => activeFilter.value === 'all' || g.entries.length > 0);
});

const blockedIds = computed(() => new Set((data.value?.entries ?? []).filter(blocked).map((e) => e.squadPlayerId)));
// Convocados en lo enviado que no pueden ir: los lesionados el día del partido y los sancionados.
const calledInjured = computed(() => (data.value?.entries ?? []).filter((e) => e.called && e.injured && !e.suspended));
const calledSuspended = computed(() => (data.value?.entries ?? []).filter((e) => e.called && e.suspended));
const suspendedCount = computed(() => (data.value?.entries ?? []).filter((e) => e.suspended).length);
// Apercibidos: cuatro amarillas del ciclo, así que una más en este partido les deja sin el siguiente de liga. Llevan la
// misma marca que en la plantilla y el cuerpo técnico tiene además un aviso con sus nombres mientras convoca.
const warned = computed(() => (data.value?.closed ? [] : (data.value?.entries ?? []).filter((e) => e.warned && !e.left)));

function toggle(id: string) {
  if (blockedIds.value.has(id)) return;
  const next = new Set(called.value);
  if (next.has(id)) next.delete(id);
  else if (!full.value) next.add(id);
  called.value = next;
}

// Quien se puede convocar: ni lesionado, ni sancionado, ni de baja.
const selectable = (e: CallUpEntryDto) => !blocked(e) && !e.left;
// «Todos» solo si caben todos en el número.
const allBlocked = computed(() => {
  const available = sorted.value.filter(selectable).length;
  return size.value !== null && available > size.value ? `No caben todos: la convocatoria es de ${size.value}` : undefined;
});
function groupBlocked(entries: CallUpEntryDto[]) {
  const adding = entries.filter((e) => selectable(e) && !called.value.has(e.squadPlayerId)).length;
  if (adding === 0 || size.value === null || called.value.size + adding <= size.value) return undefined;
  return `No caben: la convocatoria es de ${size.value} y llevas ${called.value.size}`;
}

function selectAll(on: boolean) {
  called.value = on ? new Set(sorted.value.filter(selectable).map((e) => e.squadPlayerId)) : new Set();
}

function selectGroup(entries: CallUpEntryDto[]) {
  const available = entries.filter(selectable);
  const on = available.some((e) => !called.value.has(e.squadPlayerId));
  if (on && groupBlocked(entries)) return;
  const next = new Set(called.value);
  for (const e of available) {
    if (on) next.add(e.squadPlayerId);
    else next.delete(e.squadPlayerId);
  }
  called.value = next;
}

// Lo que enseña el repaso antes de enviar.
const reviewPlayer = (e: CallUpEntryDto): ReviewPlayer => ({
  id: e.squadPlayerId,
  name: e.playerName,
  shirtNumber: e.shirtNumber,
  photoUrl: photos.value[e.squadPlayerId] ?? null,
  linked: e.linked,
  injured: e.injured,
  suspended: e.suspended,
  discipline: warnedDiscipline(e),
});
const reviewGroups = computed<ReviewGroup[]>(() =>
  byPosition.value.map((g) => ({ key: g.key, label: g.label, short: g.short, total: g.entries.length, players: g.entries.filter((e) => called.value.has(e.squadPlayerId)).map(reviewPlayer) })),
);
const reviewNotCalled = computed(() => sorted.value.filter((e) => !called.value.has(e.squadPlayerId)).map(reviewPlayer));
const reviewChanges = computed(() => {
  if (data.value?.status !== 'Published') return null;
  return {
    entering: [...called.value].filter((id) => !savedCalled.value.has(id)),
    leaving: [...savedCalled.value].filter((id) => !called.value.has(id)),
    meetChanged: meetChanged.value,
  };
});
const meetAtIso = computed(() => (meet.value.date ? new Date(`${meet.value.date}T${meet.value.time || '00:00'}`).toISOString() : null));
const chosenGround = computed(() => groundList.value.find((g) => g.id === meet.value.groundId) ?? null);
const writtenPlace = computed(() => (meet.value.groundId ? null : meet.value.place.trim() || null));

async function save(publish: boolean) {
  if (!data.value) return;
  actions++;
  busy.value = publish ? 'publish' : 'draft';
  actionError.value = null;
  try {
    const body: CallUpRequest = {
      calledSquadPlayerIds: [...called.value],
      meetAt: meetAtIso.value,
      meetGroundId: meet.value.groundId,
      meetPlace: writtenPlace.value,
      notes: meet.value.notes.trim() || null,
      publish,
      size: size.value,
    };
    data.value = await api.trainings.saveCallUp(squadId.value, props.matchId, body);
    reviewOpen.value = false;
    editing.value = false;
  } catch (e) {
    actionError.value = errorMessage(e);
    reviewOpen.value = false;
  } finally {
    busy.value = null;
  }
}

// Abrir la convocatoria enviada para cambiarla: se parte de lo enviado (sin quien ya no puede ir).
function startEditing() {
  if (!data.value) return;
  take(data.value, false);
  editing.value = true;
  if (!data.value.sizeFixed && size.value === null) openSizeAsk();
}
async function stopEditing() {
  if (dirty.value) {
    const ok = await confirmDialog({ title: 'Cancelar los cambios', message: 'Se descarta lo que has cambiado y la convocatoria se queda como se envió.', confirmLabel: 'Descartar los cambios' });
    if (!ok) return;
  }
  editing.value = false;
  if (data.value) take(data.value, false);
}

// Enviada (un check) y vista (doble check verde), como en un chat. La firma va aparte.
type Delivery = 'seen' | 'sent' | 'none';
function delivery(e: CallUpEntryDto): Delivery {
  if (e.seenAt) return 'seen';
  if (e.sentAt) return 'sent';
  return 'none';
}
function deliveryTitle(e: CallUpEntryDto) {
  if (e.seenAt) return `Vista el ${formatKickoff(e.seenAt)}`;
  if (e.sentAt) return `Enviada el ${formatKickoff(e.sentAt)}; todavía no la ha abierto`;
  return e.linked ? 'Pendiente de enviar' : 'Sin cuenta en la app: no le llega';
}
const unseen = computed(() => (data.value?.entries ?? []).filter((e) => e.linked && e.sentAt && !e.seenAt).length);

async function resend() {
  if (!data.value) return;
  const ok = await confirmDialog({ title: 'Reenviar la convocatoria', message: `Le vuelve a llegar el aviso a ${unseen.value === 1 ? 'el jugador que todavía no la ha abierto' : `los ${unseen.value} jugadores que todavía no la han abierto`}.`, confirmLabel: 'Reenviar' });
  if (!ok) return;
  actions++;
  busy.value = 'resend';
  actionError.value = null;
  try {
    data.value = await api.trainings.resendCallUp(squadId.value, props.matchId);
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

// Al firmar se vuelve a pedir la convocatoria al momento: la firma sale ya en la lista, con lo que hayan firmado los demás.
async function respond(response: CallUpResponse) {
  if (!data.value?.id) return;
  actions++;
  busy.value = 'respond';
  actionError.value = null;
  try {
    await api.trainings.respondCallUp(data.value.id, response);
    await run();
    void alerts.load();
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <RouterLink :to="{ name: 'squad-trainings', params: { squadId } }" class="text-xs font-medium text-accent-400 hover:underline"><Icon icon="chevron-left" class="mr-1 inline h-3 w-3" />Agenda</RouterLink>
        <h2 class="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-900">
          Convocatoria · J{{ data.match.matchday }}
          <TeamName prefix="vs" :name="opponentOf(data.match, teamId).name" :crest-url="opponentOf(data.match, teamId).crestUrl" :short-name="opponentOf(data.match, teamId).shortName" :team-id="opponentOf(data.match, teamId).id" size="sm" />
        </h2>
        <p class="text-sm text-slate-500">
          {{ formatKickoff(data.match.kickoffAt) }}
          <template v-if="data.matchGround"> · <a :href="data.matchGround.mapsUrl" target="_blank" rel="noopener noreferrer" class="hover:text-accent-400 hover:underline"><Icon icon="location-dot" class="mr-0.5 h-3 w-3" />{{ data.matchGround.name }}</a></template>
          <template v-else-if="data.match.venue"> · {{ data.match.venue }}</template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Badge v-if="data.closed" tone="slate">Partido empezado</Badge>
        <Badge v-else-if="data.status === 'Published'" tone="green">Enviada</Badge>
        <Badge v-else-if="data.id" tone="amber">Borrador</Badge>
        <Badge v-else tone="slate">Sin preparar</Badge>
        <Badge v-if="editing && canEdit" tone="amber">Modificándola</Badge>
        <RouterLink v-if="seesPreview" :to="{ name: 'sheet', params: { squadId, matchId }, query: { tab: 'previa' } }" class="btn-secondary px-3 py-1.5 text-xs"><Icon icon="chart-line" class="mr-1.5 h-3 w-3" />Previa del partido</RouterLink>
      </div>
    </div>

    <Alert v-if="actionError" kind="error" class="mb-4">{{ actionError }}</Alert>

    <!-- La línea del jugador que mira -->
    <section v-if="data.mine" class="card mb-6" :class="data.mine.called ? 'border-brand-500/50' : ''">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-lg font-semibold text-slate-900">{{ data.mine.called ? 'Vas convocado' : 'No vas convocado' }}</p>
          <p class="text-sm text-slate-600">
            <template v-if="data.mine.called && data.meetAt">Cita: {{ formatKickoff(data.meetAt) }}.</template>
            <template v-else-if="data.mine.called">El cuerpo técnico no ha puesto hora de cita.</template>
            <template v-else-if="data.mine.suspended">Estás sancionado para este partido: no puedes ir convocado.</template>
            <template v-else-if="data.mine.injured">Estás lesionado el día del partido: no puedes ir convocado.</template>
            <template v-else>Esta vez el cuerpo técnico no cuenta contigo para el partido.</template>
          </p>
          <SuspensionNote v-if="data.mine.suspended" :suspension="data.mine.suspension" class="mt-1" />
          <InjuryNote v-if="data.mine.injured" :injury="data.mine.injury" class="mt-1" />
          <p v-if="!data.closed && data.mine.warned" class="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-amber-700">
            <DisciplineBadge :discipline="warnedDiscipline(data.mine)" />Llevas {{ data.mine.cycleYellows }} amarillas: con una más te pierdes el siguiente partido de liga.
          </p>
          <GroundCard v-if="data.mine.called && (data.meetGround || data.meetPlace)" :ground="data.meetGround" :place="data.meetPlace" class="mt-2" />
          <p v-if="data.notes" class="mt-1 whitespace-pre-line text-sm text-slate-700">{{ data.notes }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Badge :tone="data.mine.called ? callUpResponseTone[data.mine.response] : data.mine.response === 'Acknowledged' ? 'slate' : 'amber'">
            {{ data.mine.called ? callUpResponseLabels[data.mine.response] : data.mine.response === 'Acknowledged' ? 'Enterado' : 'Sin firmar' }}
          </Badge>
          <template v-if="!data.closed">
            <button v-if="data.mine.called && data.mine.response !== 'Confirmed'" type="button" class="btn-primary px-3 py-1.5 text-xs" v-busy="busy === 'respond'" :disabled="busy !== null" @click="respond('Confirmed')"><Icon icon="check" class="mr-1.5 h-3 w-3" />Firmar la convocatoria</button>
            <button v-else-if="!data.mine.called && data.mine.response !== 'Acknowledged'" type="button" class="btn-secondary px-3 py-1.5 text-xs" v-busy="busy === 'respond'" :disabled="busy !== null" @click="respond('Acknowledged')">Enterado</button>
          </template>
        </div>
      </div>
      <p v-if="data.mine.called && !data.closed" class="mt-2 text-xs text-slate-500">Si no vas a poder ir, díselo a tu cuerpo técnico: la convocatoria la cambian ellos.</p>
    </section>

    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <!-- Jugadores -->
      <section class="min-w-0">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Plantilla <span class="font-normal normal-case text-slate-400">· {{ shownCalled.size }}<template v-if="editable && size !== null"> de {{ size }}</template> convocados</span></h3>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <GroupByPositionToggle v-model="groupByPosition" />
            <template v-if="editable">
              <button type="button" class="btn-ghost px-2 py-1 text-xs" :disabled="!!allBlocked" :title="allBlocked" @click="selectAll(true)">Todos</button>
              <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="selectAll(false)">Ninguno</button>
            </template>
          </div>
        </div>

        <Alert v-if="canEdit && calledSuspended.length" kind="warning" class="mb-3">
          {{ calledSuspended.map((e) => e.playerName).join(', ') }} {{ calledSuspended.length === 1 ? 'está sancionado' : 'están sancionados' }} para este partido y no
          {{ calledSuspended.length === 1 ? 'puede' : 'pueden' }} ir:
          <template v-if="locked">{{ calledSuspended.length === 1 ? 'va' : 'van' }} en la convocatoria enviada. Pulsa «Modificar la convocatoria» para {{ calledSuspended.length === 1 ? 'quitarlo' : 'quitarlos' }}.</template>
          <template v-else>ya {{ calledSuspended.length === 1 ? 'lo hemos quitado' : 'los hemos quitado' }} de la lista. Guarda o reenvía la convocatoria para que quede así.</template>
        </Alert>
        <Alert v-if="canEdit && calledInjured.length" kind="warning" class="mb-3">
          {{ calledInjured.map((e) => e.playerName).join(', ') }} {{ calledInjured.length === 1 ? 'está lesionado' : 'están lesionados' }} el día del partido y no
          {{ calledInjured.length === 1 ? 'puede' : 'pueden' }} ir:
          <template v-if="locked">{{ calledInjured.length === 1 ? 'va' : 'van' }} en la convocatoria enviada. Pulsa «Modificar la convocatoria» para {{ calledInjured.length === 1 ? 'quitarlo' : 'quitarlos' }}.</template>
          <template v-else>ya {{ calledInjured.length === 1 ? 'lo hemos quitado' : 'los hemos quitado' }} de la lista. Guarda o reenvía la convocatoria para que quede así.</template>
        </Alert>
        <Alert v-if="canEdit && warned.length" kind="warning" class="mb-3">
          <template v-if="warned.length === 1">{{ warned[0].playerName }} está apercibido: lleva {{ warned[0].cycleYellows }} amarillas y, si ve otra en este partido, se pierde el siguiente de liga.</template>
          <template v-else>Están apercibidos {{ warned.map((e) => e.playerName).join(', ') }}: llevan 4 amarillas y, si ven otra en este partido, se pierden el siguiente de liga.</template>
          Puedes convocarlos; van marcados en la lista.
        </Alert>

        <!-- Contador por posición -->
        <div v-if="data.id || canEdit" class="mb-3 flex flex-wrap gap-2" aria-label="Convocados por posición">
          <span
            v-for="g in byPosition"
            :key="g.key"
            class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition"
            :class="g.called ? 'border-brand-500/40 bg-brand-500/10 text-slate-800' : 'border-line text-slate-500'"
            :title="`${g.called} de ${g.entries.length} ${g.label.toLowerCase()} convocados`"
          >
            <strong class="font-display">{{ g.short }}</strong>
            <span class="tabular-nums"><span :class="g.called ? 'font-semibold text-brand-500' : ''">{{ g.called }}</span><span class="text-slate-400">/{{ g.entries.length }}</span></span>
          </span>
        </div>

        <!-- Vista rápida del cuerpo técnico -->
        <div v-if="showsFilter" class="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar la lista">
          <button
            v-for="o in filterOptions"
            :key="o.key"
            type="button"
            class="cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
            :class="filter === o.key ? 'border-brand-500 bg-brand-500 text-white' : 'border-line text-slate-600 hover:bg-surface-2'"
            :aria-pressed="filter === o.key"
            :disabled="o.key !== 'all' && o.count === 0 && filter !== o.key"
            :title="o.key !== 'all' && o.count === 0 ? o.empty : o.title"
            @click="filter = filter === o.key ? 'all' : o.key"
          >
            <Icon v-if="o.icon" :icon="o.icon" class="mr-1 h-3 w-3" />{{ o.label }} <span class="tabular-nums opacity-70">{{ o.count }}</span>
          </button>
        </div>

        <p v-if="!data.id && !canEdit" class="text-sm text-slate-500">El cuerpo técnico todavía no ha enviado la convocatoria de este partido.</p>
        <p v-else-if="groups.length === 0" class="rounded-lg border border-dashed border-line px-3 py-6 text-center text-sm text-slate-500">
          {{ filterEmpty }}. <button type="button" class="font-medium text-accent-400 hover:underline" @click="filter = 'all'">Ver a todos</button>
        </p>
        <div v-else class="overflow-hidden rounded-lg border border-line">
          <div v-for="g in groups" :key="g.key">
            <div v-if="g.label" class="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
              <span class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {{ g.label }} ·
                <template v-if="activeFilter === 'all'"><span :class="g.called ? 'text-brand-500' : ''">{{ g.called }}</span>/{{ g.entries.length }}</template>
                <template v-else>{{ g.entries.length }}</template>
              </span>
              <button v-if="editable" type="button" class="text-[11px] font-medium text-accent-400 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline" :disabled="!!groupBlocked(g.entries)" :title="groupBlocked(g.entries)" @click="selectGroup(g.entries)">
                {{ g.entries.some((e) => !called.has(e.squadPlayerId)) ? 'Todos' : 'Ninguno' }}
              </button>
            </div>
            <ul class="divide-y divide-line border-b border-line last:border-b-0">
              <li v-for="e in g.entries" :key="e.squadPlayerId" class="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" :class="shownCalled.has(e.squadPlayerId) ? 'bg-brand-500/5' : ''">
                <label v-if="editable" class="flex shrink-0 cursor-pointer items-center">
                  <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40" :checked="called.has(e.squadPlayerId)" :disabled="blocked(e) || (full && !called.has(e.squadPlayerId))" :aria-label="`Convocar a ${e.playerName}`" :title="blockedTitle(e) ?? (full && !called.has(e.squadPlayerId) ? fullTitle : undefined)" @change="toggle(e.squadPlayerId)" />
                </label>
                <Icon v-else-if="e.called" icon="check" class="h-4 w-4 shrink-0 text-brand-500" aria-label="Convocado" />
                <span v-else class="w-4 shrink-0"></span>
                <span class="flex min-w-0 flex-1 basis-40 items-center gap-1.5" :class="blocked(e) ? 'opacity-60' : ''">
                  <PlayerName :name="e.playerName" :photo-url="photos[e.squadPlayerId] ?? null" class="min-w-0" />
                  <Badge v-if="data.mine && e.squadPlayerId === data.mine.squadPlayerId" tone="blue" class="shrink-0">Tú</Badge>
                </span>
                <SuspensionNote v-if="e.suspended" :suspension="e.suspension" class="basis-full pl-6 sm:basis-auto sm:pl-0" />
                <InjuryNote v-if="e.injured" :injury="e.injury" class="basis-full pl-6 sm:basis-auto sm:pl-0" />
                <DisciplineBadge v-if="!data.closed" :discipline="warnedDiscipline(e)" class="shrink-0" />
                <span v-if="!groupByPosition" class="hidden text-xs text-slate-500 sm:inline">{{ positionOf[e.squadPlayerId] ? positionLabels[positionOf[e.squadPlayerId]!] : '' }}</span>
                <template v-if="data.status === 'Published'">
                  <Badge v-if="e.called" :tone="callUpResponseTone[e.response]">{{ callUpResponseLabels[e.response] }}</Badge>
                  <Badge v-else-if="e.response === 'Acknowledged'" tone="slate">Enterado</Badge>
                  <Badge v-else-if="e.linked" tone="slate">No va</Badge>
                  <span v-if="data.canEdit && e.linked" class="inline-flex w-14 shrink-0 items-center justify-end gap-1 text-xs" :title="deliveryTitle(e)">
                    <template v-if="delivery(e) === 'seen'"><Icon icon="check-double" class="h-3.5 w-3.5 text-emerald-500" aria-label="Vista" /><span class="text-emerald-500">Vista</span></template>
                    <template v-else-if="delivery(e) === 'sent'"><Icon icon="check" class="h-3.5 w-3.5 text-slate-400" aria-label="Enviada" /><span class="text-slate-400">Enviada</span></template>
                  </span>
                </template>
                <span v-if="!e.linked" class="text-xs text-slate-400" title="Sin cuenta en la app: no le llega el aviso">sin cuenta</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Cita y acciones -->
      <aside class="space-y-4">
        <section v-if="editable" class="card" aria-labelledby="cu-size">
          <h3 id="cu-size" class="mb-1 font-semibold text-slate-900">Convocados</h3>
          <p class="font-display text-3xl font-semibold tabular-nums text-slate-900">
            {{ called.size }}<span class="text-slate-400">/{{ size ?? '—' }}</span>
          </p>
          <p v-if="size === null" class="mt-1 text-sm text-amber-700">Di a cuántos convocas para este partido.</p>
          <p v-else-if="over > 0" class="mt-1 text-sm font-medium text-red-600">Sobran {{ over }}: quita a {{ over === 1 ? 'uno' : over }} para poder guardarla.</p>
          <p v-else-if="missing > 0" class="mt-1 text-sm text-amber-700">Faltan {{ missing }} por convocar.</p>
          <p v-else class="mt-1 text-sm text-emerald-600"><Icon icon="check" class="mr-1 h-3 w-3" />Convocatoria completa.</p>
          <p class="mt-2 text-xs text-slate-500">
            <template v-if="data.sizeFixed">
              Es el número fijo de la plantilla; se cambia en
              <RouterLink :to="{ name: 'squad', params: { squadId } }" class="font-medium text-accent-400 hover:underline">Gestión de la plantilla</RouterLink>.
            </template>
            <template v-else>Lo decides en cada convocatoria.</template>
            Si la envías con menos, el cuerpo técnico y el club reciben un aviso de que faltan jugadores hasta que la completes.
          </p>
          <button v-if="!data.sizeFixed" type="button" class="btn-secondary mt-3 w-full px-3 py-1.5 text-xs" :disabled="busy !== null" :title="busy !== null ? 'Espera a que termine lo que se está guardando' : undefined" @click="openSizeAsk">
            {{ size === null ? 'Decir a cuántos convoco' : 'Cambiar el número' }}
          </button>
        </section>

        <section class="card">
          <h3 class="mb-2 font-semibold text-slate-900">Cita</h3>
          <template v-if="editable">
            <div class="grid grid-cols-[1fr_5.5rem] gap-2">
              <div>
                <label class="label" for="cu-date">Día</label>
                <input id="cu-date" v-model="meet.date" type="date" class="input" />
              </div>
              <div>
                <label class="label" for="cu-time">Hora</label>
                <input id="cu-time" v-model="meet.time" type="time" class="input px-2" />
              </div>
            </div>
            <label class="label mt-2" for="cu-place">Lugar</label>
            <Spinner v-if="!grounds" class="py-2" />
            <GroundPicker
              v-else
              v-model:ground-id="meet.groundId"
              v-model:place="meet.place"
              :grounds="groundList"
              :home-ground-id="grounds.homeGroundId"
              :match-ground-id="data.matchGround?.id ?? null"
            />
            <label class="label mt-2" for="cu-notes">Notas</label>
            <textarea id="cu-notes" v-model="meet.notes" rows="3" maxlength="1000" class="input" placeholder="Equipación, comida, qué llevar…"></textarea>
          </template>
          <template v-else>
            <p v-if="data.meetAt" class="text-sm text-slate-700">{{ formatKickoff(data.meetAt) }}</p>
            <p v-else class="text-sm text-slate-500">Sin hora de cita.</p>
            <GroundCard v-if="data.meetGround || data.meetPlace" :ground="data.meetGround" :place="data.meetPlace" class="mt-2" />
            <p v-if="data.notes" class="mt-2 whitespace-pre-line text-sm text-slate-700">{{ data.notes }}</p>
          </template>
        </section>

        <section class="card text-sm" aria-labelledby="cu-rules">
          <h3 id="cu-rules" class="mb-1.5 flex items-center gap-2 font-semibold text-slate-900"><Icon icon="circle-info" class="h-3.5 w-3.5 text-accent-400" />Sanciones de liga</h3>
          <p class="text-slate-600">
            La 5.ª amarilla (y la 10.ª, la 15.ª…) y cada expulsión dejan al jugador sin el siguiente partido de liga: no se le puede convocar ni ponerle en el acta.
            Con 4 amarillas en el ciclo está apercibido: puede ir, pero una más le deja fuera del siguiente.
          </p>
          <p class="mt-1.5 text-xs text-slate-500">
            Salen de las tarjetas de las actas: la oficial de la federación cuando está cerrada y, mientras tanto, la interna. Cuando el comité de competición publica la sanción de un jugador, cuentan los partidos que pone (una roja directa puede costar varios); hasta entonces, el mínimo.
          </p>
          <p v-if="suspendedCount" class="mt-1.5 text-xs font-medium text-red-700">{{ suspendedCount === 1 ? '1 jugador sancionado' : `${suspendedCount} jugadores sancionados` }} para este partido.</p>
          <p v-if="warned.length" class="mt-1 text-xs font-medium text-amber-700">{{ warned.length === 1 ? '1 jugador apercibido' : `${warned.length} jugadores apercibidos` }}.</p>
        </section>

        <section v-if="data.status === 'Published' && data.canEdit" class="card text-sm">
          <h3 class="mb-2 font-semibold text-slate-900">Entrega</h3>
          <ul class="space-y-1">
            <li class="flex justify-between"><span class="text-slate-600"><Icon icon="check" class="mr-1.5 h-3 w-3 text-slate-400" />Enviada</span><strong class="tabular-nums text-slate-700">{{ data.counts.sent }}</strong></li>
            <li class="flex justify-between"><span class="text-slate-600"><Icon icon="check-double" class="mr-1.5 h-3 w-3 text-emerald-500" />Vista</span><strong class="tabular-nums text-emerald-600">{{ data.counts.seen }}</strong></li>
          </ul>
          <button v-if="canEdit && unseen > 0" type="button" class="btn-secondary mt-3 w-full px-3 py-1.5 text-xs" v-busy="busy === 'resend'" :disabled="busy !== null" @click="resend"><Icon icon="paper-plane" class="mr-1.5 h-3 w-3" />Reenviar a quien no la ha visto ({{ unseen }})</button>
          <p class="mt-2 text-xs text-slate-500">Un check: le ha llegado el aviso. Doble check verde: la ha abierto. La firma va aparte.</p>
        </section>

        <section v-if="data.status === 'Published'" class="card text-sm">
          <h3 class="mb-2 font-semibold text-slate-900">Firmas</h3>
          <ul class="space-y-1">
            <li class="flex justify-between"><span class="text-slate-600">Convocados que han firmado</span><strong class="tabular-nums text-emerald-600">{{ data.counts.confirmed }}</strong></li>
            <li class="flex justify-between"><span class="text-slate-600">Sin firmar</span><strong class="tabular-nums text-amber-600">{{ data.counts.pending }}</strong></li>
            <li class="flex justify-between"><span class="text-slate-600">No convocados enterados</span><strong class="tabular-nums text-slate-700">{{ data.counts.acknowledged }}</strong></li>
          </ul>
          <p v-if="data.publishedAt" class="mt-2 text-xs text-slate-500">Enviada el {{ formatKickoff(data.publishedAt) }}.</p>
        </section>

        <div v-if="locked" class="flex flex-col gap-2">
          <button type="button" class="btn-secondary" :disabled="busy !== null" :title="busy !== null ? 'Espera a que termine lo que se está guardando' : undefined" @click="startEditing">
            <Icon icon="pen" class="mr-1.5 h-3.5 w-3.5" />Modificar la convocatoria
          </button>
          <p class="text-xs text-slate-500">Ya está enviada: la lista queda fija para que nadie cambie a un jugador sin querer. Para cambiar a quién llevas o la cita, modifícala; antes de guardar verás quién entra y quién sale.</p>
        </div>
        <div v-else-if="editable" class="flex flex-col gap-2">
          <button v-if="data.status !== 'Published'" type="button" class="btn-secondary" v-busy="busy === 'draft'" :disabled="!!draftBlocked" :title="draftBlocked" @click="save(false)">Guardar borrador</button>
          <button type="button" class="btn-primary" :disabled="!!sendBlocked" :title="sendBlocked" @click="reviewOpen = true">
            <Icon icon="paper-plane" class="mr-1.5 h-3.5 w-3.5" />{{ data.status === 'Published' ? 'Repasar y avisar a quien cambie' : 'Repasar y enviar' }}
          </button>
          <button v-if="editing" type="button" class="btn-ghost" :disabled="busy !== null" :title="busy !== null ? 'Espera a que termine lo que se está guardando' : undefined" @click="stopEditing">Cancelar los cambios</button>
          <p class="text-xs text-slate-500">
            <template v-if="data.status === 'Published'">Antes de guardar verás quién entra y quién sale: solo reciben aviso ellos (y todos los convocados si cambia la cita); a quien entra o sale se le borra la firma anterior.</template>
            <template v-else>El borrador solo lo ve el cuerpo técnico. Antes de enviarla la repasas; al enviarla, a cada jugador con cuenta le llega el aviso de si va o no y verás quién la ha abierto (doble check verde) y quién la ha firmado.</template>
          </p>
        </div>
      </aside>
    </div>

    <CallUpReviewModal
      :open="reviewOpen"
      :busy="busy === 'publish'"
      :update="data.status === 'Published'"
      :match="data.match"
      :team-id="teamId"
      :meet-at="meetAtIso"
      :ground="chosenGround"
      :place="writtenPlace"
      :notes="meet.notes.trim() || null"
      :groups="reviewGroups"
      :not-called="reviewNotCalled"
      :changes="reviewChanges"
      :size="size"
      @close="reviewOpen = false"
      @confirm="save(true)"
    />

    <Modal :open="sizeAskOpen" title="¿A cuántos convocas?" size="md" @close="sizeAskOpen = false">
      <form class="space-y-3" @submit.prevent="confirmSize">
        <p class="text-sm text-slate-600">
          Para este partido. Es exacto: no podrás marcar a más y, si la envías con menos, el cuerpo técnico y el club reciben un aviso de que faltan
          jugadores hasta que la completes.
        </p>
        <label class="block">
          <span class="label">Convocados</span>
          <input v-model.number="sizeDraft" type="number" :min="sizeMin" :max="sizeMax" step="1" required class="input w-24" />
          <span v-if="data.suggestedSize" class="mt-1 block text-[11px] text-slate-500">Te proponemos {{ data.suggestedSize }}, el de tu última convocatoria.</span>
          <span v-else class="mt-1 block text-[11px] text-slate-500">De {{ sizeMin }} a {{ sizeMax }}.</span>
        </label>
        <p class="text-xs text-slate-500">Si siempre convocas a los mismos, ponlo fijo en «Gestión de la plantilla» y no se te volverá a preguntar.</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="sizeAskOpen = false">Ahora no</button>
          <button type="submit" class="btn-primary" :disabled="!sizeValid(sizeDraft)" :title="sizeValid(sizeDraft) ? undefined : `Pon un número de ${sizeMin} a ${sizeMax}`">Aceptar</button>
        </div>
      </form>
    </Modal>
  </template>
</template>
