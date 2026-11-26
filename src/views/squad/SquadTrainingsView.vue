<script setup lang="ts">
import { computed, defineAsyncComponent, h, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import AgendaList from '@/components/trainings/AgendaList.vue';
import TrainingAttendancePanel from '@/components/trainings/attendance/TrainingAttendancePanel.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import { useAsync } from '@/composables/useAsync';
import { useLazyMount } from '@/composables/useLazyMount';
import { useSquad } from '@/composables/useSquad';
import { useAuthStore } from '@/stores/auth';
import type { ExerciseDto, MatchDto, Position, SquadAgendaItemDto, TrainingSummaryDto, TrialPlayerDto } from '@/types/api';
import { toDateKey } from '@/utils/format';

// El calendario (FullCalendar, con preact y su polyfill) va en su propio trozo: la página, «Lo próximo» y la asistencia
// salen sin esperarlo, con un hueco del alto del mes (o de la lista, en el móvil) mientras llega.
const TrainingCalendar = defineAsyncComponent({
  loader: () => import('@/components/trainings/TrainingCalendar.vue'),
  loadingComponent: { render: () => h('div', { class: 'skeleton h-96 rounded-xl sm:h-[39.5rem]', role: 'status', 'aria-label': 'Cargando el calendario…' }) },
  delay: 0,
});

// Las ventanas se descargan la primera vez que se abren, no con la agenda.
const ExerciseLibraryModal = defineAsyncComponent(() => import('@/components/trainings/ExerciseLibraryModal.vue'));
const TrainingPlanModal = defineAsyncComponent(() => import('@/components/trainings/TrainingPlanModal.vue'));
const TrainingSessionModal = defineAsyncComponent(() => import('@/components/trainings/TrainingSessionModal.vue'));
const TrialPlayersModal = defineAsyncComponent(() => import('@/components/trainings/TrialPlayersModal.vue'));

const { squadId, detail, reload } = useSquad();
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const canManage = computed(() => detail.value?.canManage ?? false);
const teamId = computed(() => detail.value?.summary.teamId ?? '');
const photos = computed<Record<string, string | null>>(() => Object.fromEntries((detail.value?.players ?? []).map((p) => [p.id, p.photoUrl])));
const positions = computed<Record<string, Position | null>>(() =>
  Object.fromEntries([...(detail.value?.players ?? []), ...(detail.value?.leftPlayers ?? [])].map((p) => [p.id, p.position ?? null])));

// Agenda (entrenamientos y partidos). Al entrar se pide de una vez una ventana que cubre el mes del calendario (sea cual
// sea la vista, la de hoy cabe en él) y «Lo próximo» (de dos semanas atrás a cinco por delante): mientras el calendario
// se mueva dentro de ella, se filtra lo que ya hay; fuera, se pide el tramo que enseña.
function shiftDays(days: number, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date;
}
function agendaWindow() {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  // El mes del calendario: seis semanas desde el lunes de la semana del día 1.
  const gridStart = shiftDays(-((first.getDay() + 6) % 7), first);
  const gridEnd = shiftDays(41, gridStart);
  const upcomingFrom = shiftDays(-14, today);
  const upcomingTo = shiftDays(35, today);
  return {
    from: toDateKey(gridStart < upcomingFrom ? gridStart : upcomingFrom),
    to: toDateKey(gridEnd > upcomingTo ? gridEnd : upcomingTo),
    upcomingFrom: toDateKey(upcomingFrom),
    upcomingTo: toDateKey(upcomingTo),
  };
}
const agendaRange = agendaWindow();
type DayRange = { from: string; to: string };
const inWindow = (r: DayRange) => r.from >= agendaRange.from && r.to <= agendaRange.to;
const within = (items: SquadAgendaItemDto[], from: string, to: string) =>
  items.filter((item) => {
    const day = toDateKey(new Date(item.startsAt));
    return day >= from && day <= to;
  });

const windowAgenda = useAsync(() => api.trainings.agenda(squadId.value, agendaRange.from, agendaRange.to), { redirectOnError: false });

const range = ref<DayRange | null>(null);
const outside = useAsync(
  () => (range.value && !inWindow(range.value) ? api.trainings.agenda(squadId.value, range.value.from, range.value.to) : Promise.resolve([])),
  { immediate: false, redirectOnError: false },
);
function onRange(next: DayRange) {
  if (range.value?.from === next.from && range.value?.to === next.to) return;
  range.value = next;
  if (!inWindow(next)) void outside.run();
}
const calendarItems = computed(() => {
  if (!range.value) return [];
  return inWindow(range.value) ? within(windowAgenda.data.value ?? [], range.value.from, range.value.to) : outside.data.value ?? [];
});
const calendarLoading = computed(() => (range.value && !inWindow(range.value) ? outside.loading.value : windowAgenda.loading.value));
const agendaError = computed(() => windowAgenda.error.value ?? outside.error.value);

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
const next = computed(() => {
  const list = within(windowAgenda.data.value ?? [], agendaRange.upcomingFrom, agendaRange.upcomingTo);
  return [...list.filter((i) => i.done).slice(-1), ...list.filter((i) => !i.done).slice(0, 6)];
});

// Se sube al guardar algo de una sesión (lista incluida) para que la tabla de asistencia se vuelva a contar.
const attendanceKey = ref(0);
function refresh() {
  void windowAgenda.run();
  if (range.value && !inWindow(range.value)) void outside.run();
  attendanceKey.value++;
}

// Modales: sesión abierta (también desde ?sesion= de un aviso), nuevo entrenamiento y biblioteca.
const selectedId = ref<string | null>(typeof route.query.sesion === 'string' ? route.query.sesion : null);
const planDate = ref<string | null>(null);
const planTime = ref<string | null>(null);
const planOpen = ref(false);
const libraryOpen = ref(false);

watch(() => route.query.sesion, (id) => { if (typeof id === 'string') selectedId.value = id; });

const sessionMounted = useLazyMount(() => selectedId.value !== null);
const planMounted = useLazyMount(planOpen);
const libraryMounted = useLazyMount(libraryOpen);
const trialsMounted = useLazyMount(trialsOpen);

function openSession(session: TrainingSummaryDto | { id: string }) {
  selectedId.value = session.id;
}

// El partido pulsado en el calendario: a su página, en la pestaña de la convocatoria.
function openMatch(match: MatchDto) {
  void router.push({ name: 'sheet', params: { squadId: squadId.value, matchId: match.id }, query: { tab: 'convocatoria' } });
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
  <Alert v-if="agendaError" kind="error" class="mb-4">{{ agendaError }}</Alert>
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

  <!-- min-w-0 en las dos columnas: sin él, la columna se ensancha hasta lo que piden las pestañas del calendario, que así
       nunca pasan al menú y sacan la página de la pantalla en un móvil estrecho. -->
  <div class="grid gap-6 xl:grid-cols-[1fr_20rem]">
    <div class="min-w-0" :class="calendarLoading ? 'is-refreshing' : ''">
      <TrainingCalendar
        :items="calendarItems"
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

    <aside class="min-w-0 space-y-6">
      <section>
        <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Lo próximo</h3>
        <p class="mb-2 text-xs text-slate-500">Entrenamientos y partidos por orden, con lo último ya realizado delante.</p>
        <p v-if="windowAgenda.loading.value && !windowAgenda.data.value" class="text-sm text-slate-500">Cargando…</p>
        <p v-else-if="next.length === 0" class="text-sm text-slate-500">Nada en las próximas semanas.</p>
        <AgendaList v-else :items="next" :squad-id="squadId" :team-id="teamId" :can-manage="canManage" @training="openSession" />
      </section>
    </aside>
  </div>

  <TrainingAttendancePanel v-if="canManage" class="mt-6" :squad-id="squadId" :photos="photos" :positions="positions" :reload-key="attendanceKey" />

  <TrainingSessionModal
    v-if="sessionMounted"
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
  <TrainingPlanModal v-if="planMounted" :open="planOpen" :squad-id="squadId" :date="planDate" :time="planTime" :library="library" :catalog="catalog.data.value" @close="planOpen = false" @created="onCreated" />
  <ExerciseLibraryModal v-if="libraryMounted" :open="libraryOpen" :squad-id="squadId" :exercises="library" :exercise-types="catalog.data.value?.exerciseTypes ?? []" :readonly="!canManage" @close="libraryOpen = false" @changed="library = $event" />
  <TrialPlayersModal v-if="trialsMounted" :open="trialsOpen" :squad-id="squadId" :trial-players="trials" :readonly="!canManage" @close="trialsOpen = false" @changed="loadTrials" @promoted="onPromoted" />
</template>
