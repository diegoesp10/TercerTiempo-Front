<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import PlayerName from '@/components/players/PlayerName.vue';
import InjuryFormModal, { type InjuryFormMode, type InjuryFormPlayer, type InjuryFormPreset } from '@/components/squads/InjuryFormModal.vue';
import InjuryNote from '@/components/trainings/InjuryNote.vue';
import MyAttendanceBadge from '@/components/trainings/MyAttendanceBadge.vue';
import TrainingItemsEditor from '@/components/trainings/TrainingItemsEditor.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';
import type { ChoiceOption } from '@/components/ui/choice';
import GroupByPositionToggle from '@/components/ui/GroupByPositionToggle.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { groupByPosition, useGroupByPosition, type PositionGroup } from '@/composables/usePositionGrouping';
import { useAlertsStore } from '@/stores/alerts';
import type {
  AttendanceInput,
  AttendanceStatus,
  ExerciseDto,
  InjuryDto,
  InjuryOccasionDto,
  Position,
  TrainingAttendanceDto,
  TrainingCatalogDto,
  TrainingItemInput,
  TrainingKind,
  TrainingRequest,
  TrainingSessionDto,
  TrialPlayerDto,
} from '@/types/api';
import { attendanceStatusLabels, attendanceStatusTone, formatDayHeading, formatDurationMinutes, formatTime, positionLabels, toDateKey } from '@/utils/format';

/**
 * Una sesión de entrenamiento: sus datos, los ejercicios preparados y quién viene. El cuerpo técnico (o el club) lo
 * edita todo, apunta a los que vienen a prueba sin ficha y, si les hace ficha, los pasa a la plantilla; el jugador de
 * la plantilla ve la sesión y avisa de si falta.
 */
const props = defineProps<{
  open: boolean;
  squadId: string;
  sessionId: string | null;
  library: ExerciseDto[];
  catalog: TrainingCatalogDto | null;
  /** Foto de cada ficha de la plantilla, por id de ficha. */
  photos: Record<string, string | null>;
  /** Posición de cada ficha de la plantilla, por id de ficha (para agrupar la lista). */
  positions?: Record<string, Position | null>;
  /** Jugadores a prueba de la plantilla (para apuntar a uno ya conocido). */
  trialPlayers: TrialPlayerDto[];
}>();
const emit = defineEmits<{ close: []; changed: []; trialsChanged: []; promoted: [] }>();

const alerts = useAlertsStore();
const session = ref<TrainingSessionDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const busy = ref<'details' | 'items' | 'attendance' | 'absence' | 'delete' | 'trial' | 'promote' | null>(null);
const editingDetails = ref(false);

// Borradores que se editan aparte de lo guardado.
const details = ref({ kind: 'Season' as TrainingKind, title: '', date: '', time: '', durationMinutes: 90, location: '', notes: '' });
const items = ref<TrainingItemInput[]>([]);
const attendance = ref<AttendanceInput[]>([]);
const absenceReason = ref('');
const absenceOpen = ref(false);

// Jugadores a prueba: apuntar a uno conocido o a uno nuevo por su nombre, y hacerle ficha.
const trialKnown = ref<string | null>(null);
const trialName = ref('');
const promoteFor = ref<string | null>(null);
const promoteForm = ref<{ position: Position | null; shirtNumber: number | null }>({ position: null, shirtNumber: null });

const canEdit = computed(() => session.value?.canEdit ?? false);
const finished = computed(() => session.value?.finished ?? false);
// Lo que ya pasó es historia: datos y ejercicios se quedan como fueron; solo se sigue pasando lista.
const canChange = computed(() => canEdit.value && !finished.value);
const kindOptions = computed<SelectOption[]>(() => (props.catalog?.kinds ?? []).map((k) => ({ value: k.kind, label: k.label, hint: k.description })));
const positionOptions = computed<SelectOption[]>(() => (Object.keys(positionLabels) as Position[]).map((p) => ({ value: p, label: positionLabels[p] })));
const exerciseTypes = computed(() => props.catalog?.exerciseTypes ?? []);
const itemsDirty = computed(() => session.value !== null && JSON.stringify(items.value) !== JSON.stringify(toInputs(session.value)));
// Con ejercicios guardados la sesión dura lo que suman; los minutos solo se escriben en una sesión sin ejercicios.
const savedWithItems = computed(() => (session.value?.items.length ?? 0) > 0);
const itemsTotal = computed(() => items.value.reduce((sum, i) => sum + (i.durationMinutes || 0), 0));
const itemsProblem = computed(() => {
  const unnamed = items.value.flatMap((item, i) => (item.name.trim() ? [] : [i + 1]));
  if (unnamed.length) return unnamed.length === 1 ? `El ejercicio ${unnamed[0]} no tiene descripción.` : `Los ejercicios ${unnamed.join(', ')} no tienen descripción.`;
  const min = props.catalog?.minDurationMinutes ?? 15;
  const max = props.catalog?.maxDurationMinutes ?? 300;
  if (items.value.length && (itemsTotal.value < min || itemsTotal.value > max))
    return `Los ejercicios suman ${formatDurationMinutes(itemsTotal.value)} y una sesión tiene que durar entre ${formatDurationMinutes(min)} y ${formatDurationMinutes(max)}: ajusta sus minutos.`;
  return null;
});
const attendanceDirty = computed(() => session.value !== null && attendance.value.some((a) => {
  const saved = lineOf(keyOf(a));
  return saved && (saved.status !== a.status || (saved.reason ?? '') !== (a.reason ?? ''));
}));
// Antes de empezar se cuenta con venir o se avisa de que se falta; acabada, solo vino o faltó; durante, todo.
const statuses = computed<AttendanceStatus[]>(() =>
  finished.value ? ['Attended', 'Missed'] : session.value?.started ? ['Expected', 'WillMiss', 'Attended', 'Missed'] : ['Expected', 'WillMiss']);
const statusOptions = computed<ChoiceOption<AttendanceStatus>[]>(() => statuses.value.map((value) => ({ value, label: attendanceStatusLabels[value] })));
const trialCandidates = computed<SelectOption[]>(() => {
  const inSession = new Set((session.value?.attendance ?? []).map((a) => a.trialPlayerId).filter((id): id is string => id !== null));
  return props.trialPlayers
    .filter((t) => !t.promotedSquadPlayerId && !inSession.has(t.id))
    .map((t) => ({ value: t.id, label: t.fullName, hint: t.sessions ? `${t.sessions} ${t.sessions === 1 ? 'sesión' : 'sesiones'}` : 'Sin sesiones todavía' }));
});

const keyOf = (a: { squadPlayerId: string | null; trialPlayerId: string | null }) => a.squadPlayerId ?? a.trialPlayerId ?? '';

// Quién viene, agrupable por posición como todas las listas; los que vienen a prueba (sin ficha) van aparte, al final.
const groupedRollCall = useGroupByPosition('training-roll-call');
// Quien causó baja después de la sesión sigue en su lista (es historial), en el grupo «De baja».
const leftLine = (a: AttendanceInput) => session.value?.attendance.find((l) => keyOf(l) === keyOf(a))?.left ?? false;
const rollCallGroups = computed<PositionGroup<AttendanceInput>[]>(() => {
  if (!groupedRollCall.value) return groupByPosition(attendance.value, () => null, false, undefined, leftLine);
  const squad = attendance.value.filter((a) => a.squadPlayerId !== null);
  const trials = attendance.value.filter((a) => a.squadPlayerId === null);
  const groups = groupByPosition(squad, (a) => props.positions?.[a.squadPlayerId ?? ''] ?? null, true, undefined, leftLine);
  return trials.length > 0 ? [...groups, { key: 'trial', label: 'A prueba', position: null, rows: trials }] : groups;
});
const lineOf = (key: string): TrainingAttendanceDto | undefined => session.value?.attendance.find((a) => keyOf(a) === key);
// Lesionado ese día: no entrena, así que no se le pasa lista (ni entra al marcar a todos).
const injured = (a: AttendanceInput) => lineOf(keyOf(a))?.injured ?? false;

// --- Lesiones de esta sesión ---
// El cuerpo técnico apunta quién se lesionó aquí (ya empezada) o corrige esa lesión: la sesión queda como el sitio donde
// se lesionó; en ella entrenó hasta entonces (se le pasa lista como a los demás) y desde ahí sale de baja.
const hereOf = (a: AttendanceInput) => lineOf(keyOf(a))?.hereInjury ?? null;
const sessionDay = computed(() => (session.value ? toDateKey(new Date(session.value.startsAt)) : ''));
// Lesionado con un parte de ese mismo día que no dice dónde: puede que fuera aquí.
const maybeHere = (a: AttendanceInput) => {
  const injury = lineOf(keyOf(a))?.injury;
  return injured(a) && !!injury && !injury.occasion && injury.startedOn === sessionDay.value;
};
const canRecordInjuries = computed(() => canEdit.value && (session.value?.started ?? false));
const sessionOccasion = (s: TrainingSessionDto): InjuryOccasionDto => ({ kind: 'Training', id: s.id, day: toDateKey(new Date(s.startsAt)), label: s.title });

const injuryFormOpen = ref(false);
const injuryForm = shallowRef<{ mode: InjuryFormMode; target: InjuryDto | null; preset: InjuryFormPreset | null; players: InjuryFormPlayer[]; injured: string[] }>({
  mode: 'new',
  target: null,
  preset: null,
  players: [],
  injured: [],
});
const injuryLoading = ref(false);

// Las lesiones de la plantilla: quién tiene ya una abierta (no puede tener dos) y la lesión entera para corregirla.
async function squadInjuries() {
  injuryLoading.value = true;
  error.value = null;
  try {
    return await api.squads.injuries(props.squadId);
  } catch (e) {
    error.value = errorMessage(e);
    return null;
  } finally {
    injuryLoading.value = false;
  }
}

// Se elige entre los de la plantilla que estaban en la sesión: el que no vino no pudo lesionarse en ella.
async function openInjuryNew() {
  const s = session.value;
  if (!s) return;
  const list = await squadInjuries();
  if (!list) return;
  const players = s.attendance
    .filter((a) => a.squadPlayerId && !a.injured && !a.left && !a.injuredHere)
    .map((a) => ({
      id: a.squadPlayerId!,
      fullName: a.playerName,
      photoUrl: props.photos[a.squadPlayerId!] ?? null,
      unavailable: a.status === 'Missed' || a.status === 'WillMiss' ? 'no vino: si vino, cámbialo antes en la asistencia' : null,
    }));
  const open = list.filter((i) => i.active && !i.playerLeft).map((i) => i.squadPlayerId);
  injuryForm.value = { mode: 'new', target: null, preset: { occasion: sessionOccasion(s), lockOccasion: true }, players, injured: open };
  injuryFormOpen.value = true;
}

// Corregir la que se hizo aquí o, con here, enlazar a esta sesión una lesión con el parte de este día.
async function openInjuryEdit(injuryId: string, here = false) {
  const s = session.value;
  if (!s) return;
  const list = await squadInjuries();
  if (!list) return;
  const injury = list.find((i) => i.id === injuryId);
  if (!injury || injury.playerLeft || injury.continuedOn) {
    error.value = 'Esa lesión ya no se puede corregir desde aquí: es historial de la plantilla.';
    return;
  }
  injuryForm.value = {
    mode: 'edit',
    target: injury,
    preset: here ? { occasion: sessionOccasion(s), lockOccasion: true } : null,
    players: [{ id: injury.squadPlayerId, fullName: injury.playerName, photoUrl: props.photos[injury.squadPlayerId] ?? null }],
    injured: [],
  };
  injuryFormOpen.value = true;
}

// Se vuelve a pedir la sesión sin perder lo que se estaba cambiando (la asistencia, los ejercicios, los datos).
async function onInjurySaved() {
  injuryFormOpen.value = false;
  emit('changed');
  if (!props.sessionId) return;
  try {
    const fresh = await api.trainings.get(props.squadId, props.sessionId);
    const drafts = {
      attendance: attendanceDirty.value ? attendance.value : null,
      items: itemsDirty.value ? items.value : null,
      details: editingDetails.value ? details.value : null,
    };
    take(fresh);
    if (drafts.attendance) {
      const kept = new Map(drafts.attendance.map((a) => [keyOf(a), a]));
      attendance.value = attendance.value.map((a) => kept.get(keyOf(a)) ?? a);
    }
    if (drafts.items) items.value = drafts.items;
    if (drafts.details) details.value = drafts.details;
  } catch (e) {
    error.value = errorMessage(e);
  }
}

const toInputs = (s: TrainingSessionDto): TrainingItemInput[] =>
  s.items.map((i) => ({ exerciseId: i.exerciseId, name: i.name, type: i.type, durationMinutes: i.durationMinutes, notes: i.notes, positions: [...i.positions] }));

function take(s: TrainingSessionDto) {
  session.value = s;
  items.value = toInputs(s);
  attendance.value = s.attendance.map((a) => ({ squadPlayerId: a.squadPlayerId, trialPlayerId: a.trialPlayerId, status: a.status, reason: a.reason }));
  const starts = new Date(s.startsAt);
  details.value = {
    kind: s.kind,
    title: s.title,
    date: toDateKey(starts),
    time: `${String(starts.getHours()).padStart(2, '0')}:${String(starts.getMinutes()).padStart(2, '0')}`,
    durationMinutes: s.durationMinutes,
    location: s.location ?? '',
    notes: s.notes ?? '',
  };
}

async function load() {
  if (!props.sessionId) return;
  loading.value = true;
  error.value = null;
  editingDetails.value = false;
  absenceOpen.value = false;
  promoteFor.value = null;
  try {
    take(await api.trainings.get(props.squadId, props.sessionId));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(() => [props.open, props.sessionId], ([open]) => {
  if (open) void load();
  else session.value = null;
}, { immediate: true });

async function run<T>(what: typeof busy.value, action: () => Promise<T>, after?: (result: T) => void) {
  busy.value = what;
  error.value = null;
  try {
    after?.(await action());
    emit('changed');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

function saveDetails() {
  if (!session.value) return;
  const body: TrainingRequest = {
    kind: details.value.kind,
    title: details.value.title.trim() || null,
    startsAt: new Date(`${details.value.date}T${details.value.time || '00:00'}`).toISOString(),
    durationMinutes: savedWithItems.value ? session.value.plannedMinutes : details.value.durationMinutes,
    location: details.value.location.trim() || null,
    notes: details.value.notes.trim() || null,
    items: items.value,
    repeatWeekdays: [],
    repeatUntil: null,
  };
  void run('details', () => api.trainings.update(props.squadId, session.value!.id, body), (s) => { take(s); editingDetails.value = false; });
}

function saveItems() {
  if (!session.value || itemsProblem.value) return;
  void run('items', () => api.trainings.setItems(props.squadId, session.value!.id, items.value), take);
}

function setStatus(key: string, status: AttendanceStatus) {
  attendance.value = attendance.value.map((a) => (keyOf(a) === key ? { ...a, status, reason: status === 'Expected' || status === 'Attended' ? null : a.reason } : a));
}

function setReason(key: string, reason: string) {
  attendance.value = attendance.value.map((a) => (keyOf(a) === key ? { ...a, reason: reason || null } : a));
}

function saveAttendance() {
  if (!session.value) return;
  void run('attendance', () => api.trainings.setAttendance(props.squadId, session.value!.id, attendance.value.filter((a) => !injured(a))), take);
}

function markAll(status: AttendanceStatus) {
  // «Vinieron» respeta a quien avisó de que faltaba (antes o después de la sesión).
  const warned = (a: AttendanceInput) => a.status === 'WillMiss' || (lineOf(keyOf(a))?.warned ?? false);
  attendance.value = attendance.value.map((a) => (injured(a) || (status === 'Attended' && warned(a)) ? a : { ...a, status, reason: status === 'Attended' || status === 'Expected' ? null : a.reason }));
}

function reportAbsence(willMiss: boolean) {
  if (!session.value) return;
  void run('absence', () => api.trainings.reportAbsence(session.value!.id, willMiss, willMiss ? absenceReason.value.trim() || null : null), (s) => {
    take(s);
    absenceOpen.value = false;
    absenceReason.value = '';
    void alerts.load();
  });
}

function addTrial(known: boolean) {
  if (!session.value) return;
  const body = known
    ? { trialPlayerId: trialKnown.value, fullName: null, notes: null }
    : { trialPlayerId: null, fullName: trialName.value.trim(), notes: null };
  if (known ? !body.trialPlayerId : !body.fullName) return;
  void run('trial', () => api.trainings.addTrialToTraining(props.squadId, session.value!.id, body), (s) => {
    take(s);
    trialKnown.value = null;
    trialName.value = '';
    emit('trialsChanged');
  });
}

async function removeTrial(line: TrainingAttendanceDto) {
  if (!session.value || !line.trialPlayerId) return;
  const ok = await confirmDialog({ title: `Quitar a ${line.playerName} de esta sesión`, message: 'Solo deja de contar en este entrenamiento; sigue apuntado como jugador a prueba.', confirmLabel: 'Quitar' });
  if (!ok) return;
  void run('trial', () => api.trainings.removeTrialFromTraining(props.squadId, session.value!.id, line.trialPlayerId!), take);
}

function openPromote(line: TrainingAttendanceDto) {
  promoteFor.value = line.trialPlayerId;
  promoteForm.value = { position: null, shirtNumber: null };
}

function promote(line: TrainingAttendanceDto) {
  if (!session.value || !line.trialPlayerId) return;
  void run('promote', () => api.trainings.promoteTrialPlayer(props.squadId, line.trialPlayerId!, { position: promoteForm.value.position, shirtNumber: promoteForm.value.shirtNumber || null }), () => {
    promoteFor.value = null;
    emit('promoted');
    void load();
  });
}

// Solo esta sesión (no hay borrado en bloque) y solo si no ha acabado.
async function remove() {
  if (!session.value || finished.value) return;
  const ok = await confirmDialog({
    title: 'Borrar la sesión',
    message: 'Se borra solo esta sesión, con sus ejercicios y su asistencia. Si aún no ha empezado, a los jugadores con cuenta se les avisa de que se anula.',
    confirmLabel: 'Borrar',
    danger: true,
  });
  if (!ok) return;
  void run('delete', () => api.trainings.remove(props.squadId, session.value!.id), () => emit('close'));
}
</script>

<template>
  <Modal :open="open" :title="session?.title ?? 'Entrenamiento'" size="xl" @close="emit('close')">
    <template #header>
      <div v-if="session" class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-lg font-bold text-slate-900">{{ session.title }}</h2>
          <Badge tone="blue">{{ session.kindLabel }}</Badge>
          <Badge v-if="session.finished" tone="slate">Ya realizado</Badge>
          <Badge v-else-if="session.started" tone="green">En curso</Badge>
          <Badge v-if="session.seriesId" tone="slate" title="Creado con repetición semanal">Serie semanal</Badge>
        </div>
        <p class="text-sm text-slate-500">
          {{ formatDayHeading(session.startsAt) }} · {{ formatTime(session.startsAt) }}–{{ formatTime(session.endsAt) }} ({{ formatDurationMinutes(session.durationMinutes) }})
          <template v-if="session.location"> · {{ session.location }}</template>
        </p>
      </div>
      <h2 v-else class="text-lg font-bold text-slate-900">Entrenamiento</h2>
    </template>

    <Spinner v-if="loading && !session" />
    <Alert v-else-if="error && !session" kind="error">{{ error }}</Alert>

    <template v-else-if="session">
      <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>

      <!-- Datos de la sesión -->
      <section class="mb-6">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Datos</h3>
          <button v-if="canChange && !editingDetails" type="button" class="btn-ghost btn-sm px-2" @click="editingDetails = true"><Icon icon="pen" class="mr-1 h-3 w-3" />Editar</button>
        </div>
        <p v-if="canEdit && finished" class="mb-2 flex items-center gap-1.5 text-xs text-slate-500">
          <Icon icon="lock" class="h-3 w-3" />Ya ha pasado: no se puede cambiar. Solo se pasa lista de quién vino y quién faltó.
        </p>
        <form v-if="editingDetails && canChange" class="grid gap-3 sm:grid-cols-2" @submit.prevent="saveDetails">
          <div>
            <label class="label" for="ts-kind">Tipo</label>
            <SearchSelect id="ts-kind" v-model="details.kind" :options="kindOptions" />
          </div>
          <div>
            <label class="label" for="ts-title">Título</label>
            <input id="ts-title" v-model="details.title" type="text" maxlength="120" class="input" placeholder="Si lo dejas vacío, el tipo" />
          </div>
          <!-- Día, hora y minutos en una fila solo si caben: el campo de fecha no baja de unos 150 px y en un móvil estrecho
               el día va solo y debajo la hora y los minutos. -->
          <div class="@container sm:col-span-2">
            <div class="grid grid-cols-2 gap-2 @sm:grid-cols-[1fr_6rem_6rem]">
              <div class="col-span-2 @sm:col-span-1">
                <label class="label" for="ts-date">Día</label>
                <input id="ts-date" v-model="details.date" type="date" required class="input" />
              </div>
              <div>
                <label class="label" for="ts-time">Hora</label>
                <input id="ts-time" v-model="details.time" type="time" required class="input px-2" />
              </div>
              <div>
                <label class="label" for="ts-minutes">Minutos</label>
                <input
                  v-if="savedWithItems"
                  id="ts-minutes"
                  :value="session.plannedMinutes"
                  type="number"
                  readonly
                  tabindex="-1"
                  class="input cursor-default bg-surface-2 px-2 font-semibold tabular-nums"
                  title="La suma de los minutos de los ejercicios guardados"
                />
                <input v-else id="ts-minutes" v-model.number="details.durationMinutes" type="number" :min="catalog?.minDurationMinutes ?? 15" :max="catalog?.maxDurationMinutes ?? 300" required class="input px-2" />
              </div>
              <p class="col-span-2 text-xs text-slate-500 @sm:col-span-3">
                {{ savedWithItems ? 'La duración es la suma de los ejercicios: se cambia desde los minutos de cada uno.' : 'Sin ejercicios, pon tú los minutos. Al guardar ejercicios, la duración pasa a ser su suma.' }}
              </p>
            </div>
          </div>
          <div>
            <label class="label" for="ts-location">Lugar</label>
            <input id="ts-location" v-model="details.location" type="text" maxlength="150" class="input" placeholder="Campo, pabellón…" />
          </div>
          <div>
            <label class="label" for="ts-notes">Notas</label>
            <input id="ts-notes" v-model="details.notes" type="text" maxlength="2000" class="input" placeholder="Lo que la plantilla debe saber" />
          </div>
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" class="btn-ghost" @click="editingDetails = false; take(session)">Cancelar</button>
            <button type="submit" class="btn-primary" v-busy="busy === 'details'" :disabled="busy !== null">Guardar datos</button>
          </div>
        </form>
        <p v-else-if="session.notes" class="whitespace-pre-line text-sm text-slate-700">{{ session.notes }}</p>
        <p v-else class="text-sm text-slate-500">Sin notas.</p>
      </section>

      <!-- Ejercicios -->
      <section class="mb-6">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Ejercicios <span class="font-normal normal-case text-slate-400">· {{ items.length ? `${formatDurationMinutes(itemsTotal)} en total` : `la sesión dura ${formatDurationMinutes(session.durationMinutes)}` }}</span></h3>
          <button v-if="canChange" type="button" class="btn-primary btn-sm" v-busy="busy === 'items'" :disabled="busy !== null || !itemsDirty || !!itemsProblem" :title="itemsProblem ?? undefined" @click="saveItems">Guardar ejercicios</button>
        </div>
        <p v-if="canChange && itemsProblem" class="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800" role="status">
          <Icon icon="triangle-exclamation" class="mr-1 h-3 w-3" />Aún no se pueden guardar: {{ itemsProblem }}
        </p>
        <p v-else-if="canChange && itemsDirty && items.length && itemsTotal !== session.durationMinutes" class="mb-2 text-xs text-slate-500">
          Al guardar, la sesión pasará a durar <strong class="text-slate-700">{{ formatDurationMinutes(itemsTotal) }}</strong>, la suma de los ejercicios.
        </p>
        <TrainingItemsEditor v-model="items" :library="library" :exercise-types="exerciseTypes" :max-items="catalog?.maxItems ?? 40" :readonly="!canChange" />
      </section>

      <!-- Asistencia -->
      <section>
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Asistencia</h3>
          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge v-if="session.counts.expected || !session.started" tone="blue">{{ session.counts.expected }} cuentan con venir</Badge>
            <Badge v-if="session.counts.willMiss" tone="amber">{{ session.counts.willMiss }} avisan que faltan</Badge>
            <Badge v-if="session.counts.attended" tone="green">{{ session.counts.attended }} vinieron</Badge>
            <Badge v-if="session.counts.missed" tone="red">{{ session.counts.missed }} faltaron</Badge>
            <Badge v-if="session.counts.injured" tone="slate" title="No entrenan: no cuentan como faltas">{{ session.counts.injured }} {{ session.counts.injured === 1 ? 'lesionado' : 'lesionados' }}</Badge>
          </div>
        </div>

        <!-- El jugador: su línea y el aviso -->
        <div v-if="session.mine && !canEdit" class="mb-4 rounded-lg border border-line bg-surface-2 p-3">
          <div v-if="session.mine.injured" class="text-sm text-slate-700">
            <p class="mb-1">Estás lesionado: no entrenas y no tienes que avisar. Cuando te den el alta, el cuerpo técnico la apunta.</p>
            <InjuryNote :injury="session.mine.injury" />
          </div>
          <div v-else class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-slate-700">
              <MyAttendanceBadge :status="session.mine.status" />
              <span v-if="session.mine.reason" class="ml-1 text-xs text-slate-500">({{ session.mine.reason }})</span>
            </p>
            <div v-if="!session.started" class="flex gap-2">
              <button v-if="session.mine.status === 'WillMiss'" type="button" class="btn-secondary btn-sm" v-busy="busy === 'absence'" :disabled="busy !== null" @click="reportAbsence(false)">Al final sí voy</button>
              <button v-else-if="!absenceOpen" type="button" class="btn-secondary btn-sm" @click="absenceOpen = true">No podré ir</button>
            </div>
          </div>
          <p v-if="!session.mine.injured && session.mine.hereInjury" class="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
            <Badge tone="red"><Icon icon="user-injured" class="mr-1 h-2.5 w-2.5" />Te lesionaste aquí</Badge>
            <InjuryNote :injury="session.mine.hereInjury" :badge="false" :place="false" />
          </p>
          <form v-if="absenceOpen && !session.started && !session.mine.injured" class="mt-2 flex flex-wrap gap-2" @submit.prevent="reportAbsence(true)">
            <input v-model="absenceReason" type="text" maxlength="200" class="input min-w-0 flex-1 px-2 py-1 text-sm" placeholder="Motivo (opcional): trabajo, examen, lesión…" />
            <button type="submit" class="btn-primary btn-sm" v-busy="busy === 'absence'" :disabled="busy !== null">Avisar al cuerpo técnico</button>
            <button type="button" class="btn-ghost btn-sm px-2" @click="absenceOpen = false">Cancelar</button>
          </form>
        </div>

        <div class="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <GroupByPositionToggle v-model="groupedRollCall" />
          <template v-if="canEdit">
            <span class="text-slate-500">Marcar a todos:</span>
            <button v-if="session.started" type="button" class="btn-secondary btn-sm px-2" @click="markAll('Attended')">Vinieron (salvo los que avisaron)</button>
            <button v-if="!finished" type="button" class="btn-secondary btn-sm px-2" @click="markAll('Expected')">Cuentan con venir</button>
            <button
              v-if="canRecordInjuries"
              type="button"
              class="btn-secondary btn-sm px-2"
              v-busy="injuryLoading"
              :disabled="busy !== null || injuryLoading"
              title="Apunta quién se lesionó en esta sesión: queda como el sitio donde se lesionó y desde ahí sale de baja"
              @click="openInjuryNew"
            ><Icon icon="user-injured" class="mr-1 h-3 w-3" />Se lesionó alguien</button>
            <button
              type="button"
              class="btn-primary btn-sm ml-auto"
              v-busy="busy === 'attendance'"
              :disabled="busy !== null || !attendanceDirty"
              :title="busy === null && !attendanceDirty ? 'No hay cambios que guardar' : undefined"
              @click="saveAttendance"
            >Guardar asistencia</button>
          </template>
        </div>

        <ul class="divide-y divide-line rounded-lg border border-line">
          <template v-for="group in rollCallGroups" :key="group.key">
            <li v-if="group.label" class="bg-surface-2 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{{ group.label }} · {{ group.rows.length }}</li>
            <li v-for="line in group.rows" :key="keyOf(line)" class="px-3 py-2 text-sm" :class="line.trialPlayerId ? 'bg-amber-50/40' : ''">
              <div class="flex flex-wrap items-center gap-2">
                <PlayerName :name="lineOf(keyOf(line))?.playerName ?? ''" :photo-url="line.squadPlayerId ? photos[line.squadPlayerId] ?? null : null" class="min-w-0 flex-1 basis-40" />
                <Badge v-if="line.trialPlayerId" tone="amber" title="Viene a prueba, sin ficha en la plantilla">A prueba</Badge>
                <Badge v-if="lineOf(keyOf(line))?.warned && !injured(line)" tone="amber" title="Avisó antes de la sesión de que no iba">Avisó</Badge>
                <template v-if="injured(line)">
                  <InjuryNote :injury="lineOf(keyOf(line))?.injury ?? null" class="basis-full sm:basis-auto" />
                  <button
                    v-if="canRecordInjuries && maybeHere(line) && !leftLine(line)"
                    type="button"
                    class="btn-ghost btn-sm px-2 text-brand-500"
                    v-busy="injuryLoading"
                    :disabled="busy !== null || injuryLoading"
                    title="El parte es de este día y no dice dónde se lesionó: si fue en esta sesión, queda enlazada a ella"
                    @click="openInjuryEdit(lineOf(keyOf(line))!.injury!.id, true)"
                  ><Icon icon="link" class="mr-1 h-3 w-3" />Fue en esta sesión</button>
                </template>
                <template v-else-if="canEdit">
                  <ChoiceToggle
                    :model-value="line.status"
                    :options="statusOptions"
                    :label="`Asistencia de ${lineOf(keyOf(line))?.playerName ?? 'este jugador'}`"
                    size="xs"
                    tone="brand"
                    @update:model-value="setStatus(keyOf(line), $event)"
                  />
                  <input
                    v-if="line.status === 'WillMiss' || line.status === 'Missed'"
                    :value="line.reason ?? ''"
                    type="text"
                    maxlength="200"
                    class="input w-full px-2 py-1 text-xs sm:w-48"
                    placeholder="Motivo"
                    aria-label="Motivo"
                    @input="setReason(keyOf(line), ($event.target as HTMLInputElement).value)"
                  />
                  <div v-if="line.trialPlayerId" class="flex items-center gap-1">
                    <button v-if="promoteFor !== line.trialPlayerId" type="button" class="btn-ghost btn-sm px-2 text-brand-500" :disabled="busy !== null" @click="openPromote(lineOf(keyOf(line))!)"><Icon icon="plus" class="mr-1 h-3 w-3" />Hacerle ficha</button>
                    <button type="button" class="btn-ghost-danger px-1.5 py-1" :aria-label="`Quitar a ${lineOf(keyOf(line))?.playerName} de la sesión`" :disabled="busy !== null" @click="removeTrial(lineOf(keyOf(line))!)"><Icon icon="xmark" class="h-3 w-3" /></button>
                  </div>
                </template>
                <template v-else>
                  <Badge :tone="attendanceStatusTone[line.status]">{{ attendanceStatusLabels[line.status] }}</Badge>
                  <span v-if="line.reason" class="text-xs text-slate-500">{{ line.reason }}</span>
                </template>
              </div>
              <!-- Se lesionó en esta sesión: entrenó hasta entonces (se le pasa lista) y desde ahí está de baja -->
              <div v-if="hereOf(line)" class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 sm:pl-9">
                <Badge tone="red" title="Se lesionó en esta sesión: entrenó hasta entonces y desde ahí está de baja"><Icon icon="user-injured" class="mr-1 h-2.5 w-2.5" />Se lesionó aquí</Badge>
                <InjuryNote :injury="hereOf(line)" :badge="false" :place="false" />
                <button
                  v-if="canEdit && !leftLine(line)"
                  type="button"
                  class="btn-ghost btn-sm px-2 py-0.5"
                  v-busy="injuryLoading"
                  :disabled="busy !== null || injuryLoading"
                  @click="openInjuryEdit(hereOf(line)!.id)"
                ><Icon icon="pen" class="mr-1 h-3 w-3" />Corregir la lesión</button>
              </div>
              <!-- Hacerle ficha: pasa a la plantilla con su nombre y sus asistencias de prueba -->
              <form v-if="canEdit && line.trialPlayerId && promoteFor === line.trialPlayerId" class="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-brand-500/40 bg-surface-2 p-2 sm:ml-9" @submit.prevent="promote(lineOf(keyOf(line))!)">
                <p class="basis-full text-xs text-slate-600"><strong>{{ lineOf(keyOf(line))?.playerName }}</strong> pasa a la plantilla con ficha; lo que ya se le ha anotado en los entrenamientos se queda a su nombre.</p>
                <div class="min-w-0 flex-1 basis-40">
                  <label class="label text-xs" :for="`pr-pos-${line.trialPlayerId}`">Posición</label>
                  <SearchSelect :id="`pr-pos-${line.trialPlayerId}`" v-model="promoteForm.position" :options="positionOptions" size="sm" placeholder="Elige su posición" />
                </div>
                <button type="submit" class="btn-primary btn-sm py-1.5" v-busy="busy === 'promote'" :disabled="busy !== null || !promoteForm.position" :title="promoteForm.position ? undefined : 'Elige su posición'">Hacerle ficha</button>
                <button type="button" class="btn-ghost btn-sm px-2 py-1.5" @click="promoteFor = null">Cancelar</button>
              </form>
            </li>
          </template>
        </ul>

        <!-- Apuntar a alguien que viene a prueba -->
        <div v-if="canEdit" class="mt-3 rounded-lg border border-dashed border-line p-3">
          <p class="label">Viene alguien a prueba</p>
          <div class="grid gap-2 sm:grid-cols-2">
            <form class="flex gap-2" @submit.prevent="addTrial(false)">
              <input v-model="trialName" type="text" maxlength="150" class="input min-w-0 flex-1 px-2 py-1.5" placeholder="Nombre y apellidos" aria-label="Nombre del jugador de prueba" :disabled="busy !== null" />
              <button type="submit" class="btn-secondary shrink-0 px-3" :disabled="busy !== null || !trialName.trim()" aria-label="Apuntar al jugador de prueba nuevo"><Icon icon="plus" class="h-3.5 w-3.5" /></button>
            </form>
            <div v-if="trialCandidates.length > 0" class="flex gap-2">
              <SearchSelect v-model="trialKnown" :options="trialCandidates" placeholder="O uno que ya vino" class="min-w-0 flex-1" aria-label="Jugador de prueba ya conocido" :disabled="busy !== null" />
              <button type="button" class="btn-secondary shrink-0 px-3" :disabled="busy !== null || !trialKnown" aria-label="Apuntar al jugador de prueba elegido" @click="addTrial(true)"><Icon icon="plus" class="h-3.5 w-3.5" /></button>
            </div>
          </div>
          <p class="mt-1 text-xs text-slate-500">Sin ficha ni cuenta: solo para pasarle lista. Si le hacéis ficha, pasa a la plantilla con lo que ya tenga anotado.</p>
        </div>
      </section>

      <InjuryFormModal
        :open="injuryFormOpen"
        :squad-id="squadId"
        :mode="injuryForm.mode"
        :target="injuryForm.target"
        :preset="injuryForm.preset"
        :players="injuryForm.players"
        :injured-player-ids="injuryForm.injured"
        @close="injuryFormOpen = false"
        @saved="onInjurySaved"
      />
    </template>

    <template v-if="session && canEdit" #footer>
      <div class="flex flex-wrap justify-between gap-2">
        <div class="flex gap-2">
          <button v-if="canChange" type="button" class="btn-ghost-danger" :disabled="busy !== null" @click="remove"><Icon icon="trash" class="mr-1.5 h-3.5 w-3.5" />Borrar sesión</button>
        </div>
        <button type="button" class="btn-secondary" @click="emit('close')">Cerrar</button>
      </div>
    </template>
  </Modal>
</template>
