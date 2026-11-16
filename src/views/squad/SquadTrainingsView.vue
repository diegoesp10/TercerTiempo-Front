<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import AgendaList from '@/components/trainings/AgendaList.vue';
import ExerciseLibraryModal from '@/components/trainings/ExerciseLibraryModal.vue';
import TrainingCalendar from '@/components/trainings/TrainingCalendar.vue';
import TrainingPlanModal from '@/components/trainings/TrainingPlanModal.vue';
import TrainingSessionModal from '@/components/trainings/TrainingSessionModal.vue';
import TrialPlayersModal from '@/components/trainings/TrialPlayersModal.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';
import { useAuthStore } from '@/stores/auth';
import type { ExerciseDto, MatchDto, TrainingSummaryDto, TrialPlayerDto } from '@/types/api';
import { toDateKey } from '@/utils/format';

const { squadId, detail, reload } = useSquad();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const canManage = computed(() => detail.value?.canManage ?? false);
const teamId = computed(() => detail.value?.summary.teamId ?? '');
const photos = computed<Record<string, string | null>>(() => Object.fromEntries((detail.value?.players ?? []).map((p) => [p.id, p.photoUrl])));

// Mes visible (primer día) y la agenda (entrenamientos y partidos) de las seis semanas que muestra el calendario.
const month = ref(firstOfMonth(new Date()));
const monthLabel = computed(() => {
  const text = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' }).format(new Date(`${month.value}T00:00:00`));
  return text.charAt(0).toUpperCase() + text.slice(1);
});

function firstOfMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function shiftMonth(delta: number) {
  const date = new Date(`${month.value}T00:00:00`);
  date.setMonth(date.getMonth() + delta);
  month.value = firstOfMonth(date);
}

const range = computed(() => {
  const first = new Date(`${month.value}T00:00:00`);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(start.getDate() + 41);
  return { from: toDateKey(start), to: toDateKey(end) };
});

const agenda = useAsync(() => api.trainings.agenda(squadId.value, range.value.from, range.value.to), { redirectOnError: false });
watch(range, () => void agenda.run());

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

function refresh() {
  void agenda.run();
  void upcoming.run();
}

// Modales: sesión abierta (también desde ?sesion= de un aviso), nuevo entrenamiento y biblioteca.
const selectedId = ref<string | null>(typeof route.query.sesion === 'string' ? route.query.sesion : null);
const planDate = ref<string | null>(null);
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

function plan(date: string | null) {
  planDate.value = date;
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

  <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div class="flex items-center gap-1">
      <button type="button" class="btn-ghost px-2" aria-label="Mes anterior" @click="shiftMonth(-1)"><Icon icon="chevron-left" class="h-4 w-4" /></button>
      <h2 class="min-w-[11rem] text-center text-lg font-semibold text-slate-900">{{ monthLabel }}</h2>
      <button type="button" class="btn-ghost px-2" aria-label="Mes siguiente" @click="shiftMonth(1)"><Icon icon="chevron-right" class="h-4 w-4" /></button>
      <button type="button" class="btn-ghost px-2 text-xs" @click="month = firstOfMonth(new Date())">Hoy</button>
    </div>
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
        :month="month"
        :items="agenda.data.value ?? []"
        :team-id="teamId"
        :can-plan="canManage"
        :selected-id="selectedId"
        @select="openSession"
        @match="openMatch"
        @plan="plan"
      />
      <p class="mt-1 text-xs text-slate-500">
        <template v-if="canManage">Pulsa un día para crear un entrenamiento ese día, una sesión para preparar sus ejercicios y pasar lista, o un partido para preparar su convocatoria.</template>
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

  <TrainingSessionModal
    :open="selectedId !== null"
    :squad-id="squadId"
    :session-id="selectedId"
    :library="library"
    :catalog="catalog.data.value"
    :photos="photos"
    :trial-players="trials"
    @close="closeSession"
    @changed="refresh"
    @trials-changed="loadTrials"
    @promoted="onPromoted"
  />
  <TrainingPlanModal :open="planOpen" :squad-id="squadId" :date="planDate" :library="library" :catalog="catalog.data.value" @close="planOpen = false" @created="onCreated" />
  <ExerciseLibraryModal :open="libraryOpen" :squad-id="squadId" :exercises="library" :exercise-types="catalog.data.value?.exerciseTypes ?? []" :readonly="!canManage" @close="libraryOpen = false" @changed="library = $event" />
  <TrialPlayersModal :open="trialsOpen" :squad-id="squadId" :trial-players="trials" :readonly="!canManage" @close="trialsOpen = false" @changed="loadTrials" @promoted="onPromoted" />
</template>
