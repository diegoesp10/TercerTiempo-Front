<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import PlayerName from '@/components/players/PlayerName.vue';
import TrainingItemsEditor from '@/components/trainings/TrainingItemsEditor.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAlertsStore } from '@/stores/alerts';
import type { AttendanceInput, AttendanceStatus, ExerciseDto, TrainingCatalogDto, TrainingItemInput, TrainingKind, TrainingRequest, TrainingSessionDto } from '@/types/api';
import { attendanceStatusLabels, attendanceStatusTone, formatDayHeading, formatDurationMinutes, formatTime, toDateKey } from '@/utils/format';

/**
 * Una sesión de entrenamiento: sus datos, los ejercicios preparados y quién viene. El cuerpo técnico (o el club) lo
 * edita todo; el jugador de la plantilla ve la sesión y avisa de si falta.
 */
const props = defineProps<{
  open: boolean;
  squadId: string;
  sessionId: string | null;
  library: ExerciseDto[];
  catalog: TrainingCatalogDto | null;
  /** Foto de cada ficha de la plantilla, por id de ficha. */
  photos: Record<string, string | null>;
}>();
const emit = defineEmits<{ close: []; changed: [] }>();

const alerts = useAlertsStore();
const session = ref<TrainingSessionDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const busy = ref<'details' | 'items' | 'attendance' | 'absence' | 'delete' | null>(null);
const editingDetails = ref(false);

// Borradores que se editan aparte de lo guardado.
const details = ref({ kind: 'Season' as TrainingKind, title: '', date: '', time: '', durationMinutes: 90, location: '', notes: '' });
const items = ref<TrainingItemInput[]>([]);
const attendance = ref<AttendanceInput[]>([]);
const absenceReason = ref('');
const absenceOpen = ref(false);

const canEdit = computed(() => session.value?.canEdit ?? false);
const kindOptions = computed<SelectOption[]>(() => (props.catalog?.kinds ?? []).map((k) => ({ value: k.kind, label: k.label, hint: k.description })));
const exerciseTypes = computed(() => props.catalog?.exerciseTypes ?? []);
const itemsDirty = computed(() => session.value !== null && JSON.stringify(items.value) !== JSON.stringify(toInputs(session.value)));
const attendanceDirty = computed(() => session.value !== null && attendance.value.some((a) => {
  const saved = session.value!.attendance.find((s) => s.squadPlayerId === a.squadPlayerId);
  return saved && (saved.status !== a.status || (saved.reason ?? '') !== (a.reason ?? ''));
}));
const statuses: AttendanceStatus[] = ['Expected', 'WillMiss', 'Attended', 'Missed'];

const toInputs = (s: TrainingSessionDto): TrainingItemInput[] =>
  s.items.map((i) => ({ exerciseId: i.exerciseId, name: i.name, type: i.type, durationMinutes: i.durationMinutes, notes: i.notes }));

function take(s: TrainingSessionDto) {
  session.value = s;
  items.value = toInputs(s);
  attendance.value = s.attendance.map((a) => ({ squadPlayerId: a.squadPlayerId, status: a.status, reason: a.reason }));
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
    durationMinutes: details.value.durationMinutes,
    location: details.value.location.trim() || null,
    notes: details.value.notes.trim() || null,
    items: items.value,
    repeatWeekdays: [],
    repeatUntil: null,
  };
  void run('details', () => api.trainings.update(props.squadId, session.value!.id, body), (s) => { take(s); editingDetails.value = false; });
}

function saveItems() {
  if (!session.value) return;
  void run('items', () => api.trainings.setItems(props.squadId, session.value!.id, items.value), take);
}

function setStatus(squadPlayerId: string, status: AttendanceStatus) {
  attendance.value = attendance.value.map((a) => (a.squadPlayerId === squadPlayerId ? { ...a, status, reason: status === 'Expected' || status === 'Attended' ? null : a.reason } : a));
}

function setReason(squadPlayerId: string, reason: string) {
  attendance.value = attendance.value.map((a) => (a.squadPlayerId === squadPlayerId ? { ...a, reason: reason || null } : a));
}

function saveAttendance() {
  if (!session.value) return;
  void run('attendance', () => api.trainings.setAttendance(props.squadId, session.value!.id, attendance.value), take);
}

function markAll(status: AttendanceStatus) {
  attendance.value = attendance.value.map((a) => (a.status === 'WillMiss' && status === 'Attended' ? a : { ...a, status, reason: status === 'Attended' || status === 'Expected' ? null : a.reason }));
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

async function remove(series: boolean) {
  if (!session.value) return;
  const ok = await confirmDialog({
    title: series ? 'Borrar esta sesión y las siguientes de la serie' : 'Borrar la sesión',
    message: series ? 'Se borran esta sesión y todas las posteriores creadas con ella (las anteriores se quedan).' : 'Se borra la sesión con sus ejercicios y su asistencia.',
    confirmLabel: 'Borrar',
    danger: true,
  });
  if (!ok) return;
  void run('delete', () => api.trainings.remove(props.squadId, session.value!.id, series), () => emit('close'));
}
</script>

<template>
  <Modal :open="open" :title="session?.title ?? 'Entrenamiento'" size="xl" @close="emit('close')">
    <template #header>
      <div v-if="session" class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h2 class="text-lg font-bold text-slate-900">{{ session.title }}</h2>
          <Badge tone="blue">{{ session.kindLabel }}</Badge>
          <Badge v-if="session.started" tone="slate">Ya celebrado</Badge>
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
          <button v-if="canEdit && !editingDetails" type="button" class="btn-ghost px-2 py-1 text-xs" @click="editingDetails = true"><Icon icon="pen" class="mr-1 h-3 w-3" />Editar</button>
        </div>
        <form v-if="editingDetails" class="grid gap-3 sm:grid-cols-2" @submit.prevent="saveDetails">
          <div>
            <label class="label" for="ts-kind">Tipo</label>
            <SearchSelect id="ts-kind" v-model="details.kind" :options="kindOptions" />
          </div>
          <div>
            <label class="label" for="ts-title">Título</label>
            <input id="ts-title" v-model="details.title" type="text" maxlength="120" class="input" placeholder="Si lo dejas vacío, el tipo" />
          </div>
          <div class="grid grid-cols-[1fr_6rem_5rem] gap-2 sm:col-span-2">
            <div>
              <label class="label" for="ts-date">Día</label>
              <input id="ts-date" v-model="details.date" type="date" required class="input" />
            </div>
            <div>
              <label class="label" for="ts-time">Hora</label>
              <input id="ts-time" v-model="details.time" type="time" required class="input px-2" />
            </div>
            <div>
              <label class="label" for="ts-minutes">Minutos</label>
              <input id="ts-minutes" v-model.number="details.durationMinutes" type="number" :min="catalog?.minDurationMinutes ?? 15" :max="catalog?.maxDurationMinutes ?? 300" required class="input px-2" />
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
          <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Ejercicios <span class="font-normal normal-case text-slate-400">· {{ formatDurationMinutes(session.plannedMinutes) }} preparados de {{ formatDurationMinutes(session.durationMinutes) }}</span></h3>
          <button v-if="canEdit" type="button" class="btn-primary px-3 py-1 text-xs" v-busy="busy === 'items'" :disabled="busy !== null || !itemsDirty" @click="saveItems">Guardar ejercicios</button>
        </div>
        <TrainingItemsEditor v-model="items" :library="library" :exercise-types="exerciseTypes" :max-items="catalog?.maxItems ?? 40" :readonly="!canEdit" />
      </section>

      <!-- Asistencia -->
      <section>
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Asistencia</h3>
          <div class="flex flex-wrap items-center gap-1.5 text-xs">
            <Badge tone="blue">{{ session.counts.expected }} cuentan con venir</Badge>
            <Badge v-if="session.counts.willMiss" tone="amber">{{ session.counts.willMiss }} avisan que faltan</Badge>
            <Badge v-if="session.counts.attended" tone="green">{{ session.counts.attended }} vinieron</Badge>
            <Badge v-if="session.counts.missed" tone="red">{{ session.counts.missed }} faltaron</Badge>
          </div>
        </div>

        <!-- El jugador: su línea y el aviso -->
        <div v-if="session.mine && !canEdit" class="mb-4 rounded-lg border border-line bg-surface-2 p-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-slate-700">
              Tú: <Badge :tone="attendanceStatusTone[session.mine.status]">{{ attendanceStatusLabels[session.mine.status] }}</Badge>
              <span v-if="session.mine.reason" class="ml-1 text-xs text-slate-500">({{ session.mine.reason }})</span>
            </p>
            <div v-if="!session.started" class="flex gap-2">
              <button v-if="session.mine.status === 'WillMiss'" type="button" class="btn-secondary px-3 py-1 text-xs" v-busy="busy === 'absence'" :disabled="busy !== null" @click="reportAbsence(false)">Al final sí voy</button>
              <button v-else-if="!absenceOpen" type="button" class="btn-secondary px-3 py-1 text-xs" @click="absenceOpen = true">No podré ir</button>
            </div>
          </div>
          <form v-if="absenceOpen && !session.started" class="mt-2 flex flex-wrap gap-2" @submit.prevent="reportAbsence(true)">
            <input v-model="absenceReason" type="text" maxlength="200" class="input min-w-0 flex-1 px-2 py-1 text-sm" placeholder="Motivo (opcional): trabajo, examen, lesión…" />
            <button type="submit" class="btn-primary px-3 py-1 text-xs" v-busy="busy === 'absence'" :disabled="busy !== null">Avisar al cuerpo técnico</button>
            <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="absenceOpen = false">Cancelar</button>
          </form>
        </div>

        <div v-if="canEdit" class="mb-2 flex flex-wrap items-center gap-2 text-xs">
          <span class="text-slate-500">Marcar a todos:</span>
          <button type="button" class="btn-secondary px-2 py-1 text-xs" @click="markAll('Attended')">Vinieron (salvo los que avisaron)</button>
          <button type="button" class="btn-secondary px-2 py-1 text-xs" @click="markAll('Expected')">Cuentan con venir</button>
          <button type="button" class="btn-primary ml-auto px-3 py-1 text-xs" v-busy="busy === 'attendance'" :disabled="busy !== null || !attendanceDirty" @click="saveAttendance">Guardar asistencia</button>
        </div>

        <ul class="divide-y divide-line rounded-lg border border-line">
          <li v-for="line in attendance" :key="line.squadPlayerId" class="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <span class="w-7 shrink-0 text-center text-xs tabular-nums text-slate-400">{{ session.attendance.find((a) => a.squadPlayerId === line.squadPlayerId)?.shirtNumber ?? '' }}</span>
            <PlayerName :name="session.attendance.find((a) => a.squadPlayerId === line.squadPlayerId)?.playerName ?? ''" :photo-url="photos[line.squadPlayerId] ?? null" class="min-w-0 flex-1 basis-40" />
            <template v-if="canEdit">
              <div class="flex rounded-lg border border-line" role="group" aria-label="Estado">
                <button
                  v-for="status in statuses"
                  :key="status"
                  type="button"
                  class="px-2 py-1 text-xs font-medium transition first:rounded-l-lg last:rounded-r-lg"
                  :class="line.status === status ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-surface-2'"
                  :aria-pressed="line.status === status"
                  @click="setStatus(line.squadPlayerId, status)"
                >{{ attendanceStatusLabels[status] }}</button>
              </div>
              <input
                v-if="line.status === 'WillMiss' || line.status === 'Missed'"
                :value="line.reason ?? ''"
                type="text"
                maxlength="200"
                class="input w-full px-2 py-1 text-xs sm:w-48"
                placeholder="Motivo"
                aria-label="Motivo"
                @input="setReason(line.squadPlayerId, ($event.target as HTMLInputElement).value)"
              />
            </template>
            <template v-else>
              <Badge :tone="attendanceStatusTone[line.status]">{{ attendanceStatusLabels[line.status] }}</Badge>
              <span v-if="line.reason" class="text-xs text-slate-500">{{ line.reason }}</span>
            </template>
          </li>
        </ul>
      </section>
    </template>

    <template v-if="session && canEdit" #footer>
      <div class="flex flex-wrap justify-between gap-2">
        <div class="flex gap-2">
          <button type="button" class="btn-ghost text-red-600 hover:bg-red-50" :disabled="busy !== null" @click="remove(false)"><Icon icon="trash" class="mr-1.5 h-3.5 w-3.5" />Borrar sesión</button>
          <button v-if="session.seriesId" type="button" class="btn-ghost text-red-600 hover:bg-red-50" :disabled="busy !== null" @click="remove(true)">Borrar esta y las siguientes</button>
        </div>
        <button type="button" class="btn-secondary" @click="emit('close')">Cerrar</button>
      </div>
    </template>
  </Modal>
</template>
