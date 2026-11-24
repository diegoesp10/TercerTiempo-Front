<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import AgendaList from '@/components/trainings/AgendaList.vue';
import ExerciseLibraryModal from '@/components/trainings/ExerciseLibraryModal.vue';
import TrainingAttendancePanel from '@/components/trainings/attendance/TrainingAttendancePanel.vue';
import TrainingCalendar from '@/components/trainings/TrainingCalendar.vue';
import TrainingPlanModal from '@/components/trainings/TrainingPlanModal.vue';
import TrainingSessionModal from '@/components/trainings/TrainingSessionModal.vue';
import TrialPlayersModal from '@/components/trainings/TrialPlayersModal.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';
import { useAuthStore } from '@/stores/auth';
import type { ExerciseDto, MatchDto, Position, TrainingSummaryDto, TrialPlayerDto } from '@/types/api';
import { toDateKey } from '@/utils/format';

const { squadId, detail, reload } = useSquad();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const canManage = computed(() => detail.value?.canManage ?? false);
const teamId = computed(() => detail.value?.summary.teamId ?? '');
const photos = computed<Record<string, string | null>>(() => Object.fromEntries((detail.value?.players ?? []).map((p) => [p.id, p.photoUrl])));
const positions = computed<Record<string, Position | null>>(() =>
  Object.fromEntries([...(detail.value?.players ?? []), ...(detail.value?.leftPlayers ?? [])].map((p) => [p.id, p.position ?? null])));

// Agenda (entrenamientos y partidos) de los días que enseña el calendario: la pide él al cambiar de vista o de fechas.
const range = ref<{ from: string; to: string } | null>(null);
const agenda = useAsync(
  () => (range.value ? api.trainings.agenda(squadId.value, range.value.from, range.value.to) : Promise.resolve([])),
  { immediate: false, redirectOnError: false },
);
function onRange(next: { from: string; to: string }) {
  if (range.value?.from === next.from && range.value?.to === next.to) return;
  range.value = next;
  void agenda.run();
}

const catalog = useAsync(() => api.trainings.catalog(), { redirectOnError: false });
const library = ref<ExerciseDto[]>([]);
const libraryError = ref<string | null>(null);
async function loadLibrary() {
  try {
    library.value = await api.trainings.exercises(squadId.value);
  } catch (e) {
    libraryError.value = errorMessage(e);
  }
}
void loadLibrary();

// Jugadores a prueba: los apunta quien prepara los entrenamientos; con ficha pasan a la plantilla.
const trials = ref<TrialPlayerDto[]>([]);
const trialsOpen = ref(false);
async function loadTrials() {
  if (!canManage.value) return;
  try {
    trials.value = await api.trainings.trialPlayers(squadId.value);
  } catch (e) {
    libraryError.value = errorMessage(e);
  }
}
watch(canManage, () => void loadTrials(), { immediate: true });
const activeTrials = computed(() => trials.value.filter((t) => !t.promotedSquadPlayerId).length);

// Le han hecho ficha a uno de prueba: la plantilla tiene un jugador más (fotos, lista) y la lista de prueba cambia.
async function onPromoted() {
  await Promise.all([reload(), loadTrials()]);
  refresh();
}

// «Lo próximo»: entrenamientos y partidos de las dos semanas pasadas a las cinco que vienen, sea cual sea el mes a la
// vista. Va lo último ya realizado (atenuado, como referencia) y lo que queda.
function shiftDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
const upcoming = useAsync(() => api.trainings.agenda(squadId.value, shiftDays(-14), shiftDays(35)), { redirectOnError: false });
const next = computed(() => {
  const list = upcoming.data.value ?? [];
  return [...list.filter((i) => i.done).slice(-1), ...list.filter((i) => !i.done).slice(0, 6)];
});

// Se sube al guardar algo de una sesión (lista incluida) para que la tabla de asistencia se vuelva a contar.
const attendanceKey = ref(0);
function refresh() {
  void agenda.run();
  void upcoming.run();
  attendanceKey.value++;
}

// Modales: sesión abierta (también desde ?sesion= de un aviso), nuevo entrenamiento y biblioteca.
const selectedId = ref<string | null>(typeof route.query.sesion === 'string' ? route.query.sesion : null);
const planDate = ref<string | null>(null);
const planTime = ref<string | null>(null);
const planOpen = ref(false);
const libraryOpen = ref(false);

watch(() => route.query.sesion, (id) => { if (typeof id === 'string') selectedId.value = id; });

function openSession(session: TrainingSummaryDto | { id: string }) {
  selectedId.value = session.id;
}

function openMatch(match: MatchDto) {
  void router.push({ name: 'squad-callup', params: { squadId: squadId.value, matchId: match.id } });
}

function closeSession() {
  selectedId.value = null;
  if (route.query.sesion) void router.replace({ query: { ...route.query, sesion: undefined } });
}

function plan(date: string | null, time: string | null = null) {
  planDate.value = date;
  planTime.value = time;
  planOpen.value = true;
}

function onCreated() {
  planOpen.value = false;
  refresh();
}
</script>

<template>
  <Alert v-if="agenda.error.value" kind="error" class="mb-4">{{ agenda.error.value }}</Alert>
  <Alert v-if="libraryError" kind="warning" class="mb-4">{{ libraryError }}</Alert>

  <div class="mb-4 flex flex-wrap items-center justify-end gap-3">
    <div class="flex flex-wrap gap-2">
      <button type="button" class="btn-secondary" @click="libraryOpen = true"><Icon icon="list-ol" class="mr-1.5 h-3.5 w-3.5" />Biblioteca de ejercicios</button>
      <button v-if="canManage" type="button" class="btn-secondary" @click="trialsOpen = true">
        <Icon icon="user" class="mr-1.5 h-3.5 w-3.5" />A prueba
        <Badge v-if="activeTrials" tone="amber">{{ activeTrials }}</Badge>
      </button>
      <button v-if="canManage" type="button" class="btn-primary" @click="plan(null)"><Icon icon="plus" class="mr-1.5 h-3.5 w-3.5" />Nuevo entrenamiento</button>
    </div>
  </div>

  <div class="grid gap-6 xl:grid-cols-[1fr_20rem]">
    <div :class="agenda.loading.value ? 'is-refreshing' : ''">
      <TrainingCalendar
        :items="agenda.data.value ?? []"
        :team-id="teamId"
        :can-plan="canManage"
        :selected-id="selectedId"
        @select="openSession"
        @match="openMatch"
        @plan="plan"
        @range="onRange"
      />
      <p class="mt-1 text-xs text-slate-500">
        <template v-if="canManage">Pulsa un día (o una hora, en Semana y Día) para crear un entrenamiento ahí, una sesión para preparar sus ejercicios y pasar lista, o un partido para preparar su convocatoria.</template>
        <template v-else-if="auth.isPlayer">Pulsa una sesión para ver sus ejercicios y, si no puedes ir, avisar al cuerpo técnico; o un partido para ver y firmar su convocatoria.</template>
        <template v-else>Pulsa una sesión para ver sus ejercicios y la asistencia, o un partido para ver su convocatoria.</template>
      </p>
    </div>

    <aside class="space-y-6">
      <section>
        <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Lo próximo</h3>
        <p class="mb-2 text-xs text-slate-500">Entrenamientos y partidos por orden, con lo último ya realizado delante.</p>
        <p v-if="upcoming.loading.value && !upcoming.data.value" class="text-sm text-slate-500">Cargando…</p>
        <p v-else-if="next.length === 0" class="text-sm text-slate-500">Nada en las próximas semanas.</p>
        <AgendaList v-else :items="next" :squad-id="squadId" :team-id="teamId" :can-manage="canManage" @training="openSession" />
      </section>
    </aside>
  </div>

  <TrainingAttendancePanel v-if="canManage" class="mt-6" :squad-id="squadId" :photos="photos" :positions="positions" :reload-key="attendanceKey" />

  <TrainingSessionModal
    :open="selectedId !== null"
    :squad-id="squadId"
    :session-id="selectedId"
    :library="library"
    :catalog="catalog.data.value"
    :photos="photos"
    :positions="positions"
    :trial-players="trials"
    @close="closeSession"
    @changed="refresh"
    @trials-changed="loadTrials"
    @promoted="onPromoted"
  />
  <TrainingPlanModal :open="planOpen" :squad-id="squadId" :date="planDate" :time="planTime" :library="library" :catalog="catalog.data.value" @close="planOpen = false" @created="onCreated" />
  <ExerciseLibraryModal :open="libraryOpen" :squad-id="squadId" :exercises="library" :exercise-types="catalog.data.value?.exerciseTypes ?? []" :readonly="!canManage" @close="libraryOpen = false" @changed="library = $event" />
  <TrialPlayersModal :open="trialsOpen" :squad-id="squadId" :trial-players="trials" :readonly="!canManage" @close="trialsOpen = false" @changed="loadTrials" @promoted="onPromoted" />
</template>
