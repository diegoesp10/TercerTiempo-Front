<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { LiveDownloadsDto, SheetDownloadStatus, SheetQueueItemDto, SyncEventDto, SyncLeagueDto } from '@/types/api';
import { formatKickoff, formatTime } from '@/utils/format';

/**
 * Descargas en directo: lo que va trayendo la sincronización de las ligas (cada liga con su fase y cifras, y los
 * partidos, equipos, clasificaciones y plantillas según llegan) y la cola de actas pedidas a la federación, partido a
 * partido, con sus límites, la pausa si la hay y cuándo terminaría.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const data = ref<LiveDownloadsDto | null>(null);
const error = ref<string | null>(null);
const now = ref(Date.now());
const busy = ref(false);
let poll: ReturnType<typeof setTimeout> | null = null;
let tick: ReturnType<typeof setInterval> | null = null;

const football = computed(() => data.value?.football ?? null);
const sheets = computed(() => data.value?.sheets ?? null);
const sheetsActive = computed(() => !!sheets.value && sheets.value.pending + sheets.value.downloading > 0);
const paused = computed(() => {
  const until = sheets.value?.pausedUntil;
  return until && new Date(until).getTime() > now.value ? until : null;
});

async function load() {
  try {
    data.value = await adminApi.liveDownloads(props.token);
    error.value = null;
  } catch (e) {
    if ((e as { status?: number }).status === 401 || (e as { status?: number }).status === 403) {
      emit('unauthorized');
      return;
    }
    error.value = errorMessage(e);
  }
  schedule();
}

function schedule() {
  if (poll) clearTimeout(poll);
  if (document.hidden) return;
  const fast = football.value?.running || (sheetsActive.value && !paused.value);
  poll = setTimeout(() => void load(), fast ? 2_000 : 10_000);
}

function onVisibility() {
  if (!document.hidden) void load();
  else if (poll) clearTimeout(poll);
}

onMounted(() => {
  void load();
  tick = setInterval(() => { now.value = Date.now(); }, 1_000);
  document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
  if (poll) clearTimeout(poll);
  if (tick) clearInterval(tick);
  document.removeEventListener('visibilitychange', onVisibility);
});

// --- Tiempos

function elapsed(fromIso: string | null, toIso: string | null = null) {
  if (!fromIso) return '';
  const seconds = Math.max(0, Math.round(((toIso ? new Date(toIso).getTime() : now.value) - new Date(fromIso).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ${seconds % 60} s`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function countdown(iso: string | null) {
  if (!iso) return '';
  const seconds = Math.max(0, Math.round((new Date(iso).getTime() - now.value) / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0 ? `${h} h ${m} min` : m > 0 ? `${m} min ${s} s` : `${s} s`;
}

const pct = (done: number, total: number) => (total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0);

// --- Ligas

const stages = ['Calendario', 'Equipos', 'Partidos', 'Clasificación', 'Plantillas'];
function stageState(league: SyncLeagueDto, stage: string) {
  if (league.status === 'done') return 'done';
  if (league.status !== 'running' || !league.stage) return 'idle';
  const current = stages.findIndex((s) => league.stage!.startsWith(s));
  const index = stages.indexOf(stage);
  if (league.stage === 'Guardando') return 'done';
  return index < current ? 'done' : index === current ? 'current' : 'idle';
}

const leaguesDone = computed(() => football.value?.leagues.filter((l) => l.status === 'done').length ?? 0);

// --- Lo último descargado

type FeedFilter = 'changes' | 'all' | 'match' | 'team' | 'standings' | 'roster';
const feedFilter = ref<FeedFilter>('changes');
const feedFilters: { value: FeedFilter; label: string }[] = [
  { value: 'changes', label: 'Novedades' },
  { value: 'all', label: 'Todo' },
  { value: 'match', label: 'Partidos' },
  { value: 'team', label: 'Equipos' },
  { value: 'standings', label: 'Clasificaciones' },
  { value: 'roster', label: 'Plantillas' },
];
const feed = computed(() => {
  const all = football.value?.feed ?? [];
  const filtered = feedFilter.value === 'all' ? all
    : feedFilter.value === 'changes' ? all.filter((e) => e.kind !== 'match' || e.change !== 'same')
    : all.filter((e) => e.kind === feedFilter.value);
  return filtered.slice(0, 120);
});
const feedIcon: Record<SyncEventDto['kind'], string> = { match: 'futbol', team: 'shield-halved', standings: 'list-ol', roster: 'users' };

// --- Actas

type SheetFilter = 'all' | SheetDownloadStatus;
const sheetFilter = ref<SheetFilter>('all');
const sheetLabels: Record<SheetDownloadStatus, string> = {
  pending: 'En cola',
  downloading: 'Descargando',
  done: 'Guardada',
  missing: 'Sin publicar',
  failed: 'Error',
};
const sheetTone: Record<SheetDownloadStatus, 'green' | 'amber' | 'red' | 'blue' | 'slate'> = {
  pending: 'slate',
  downloading: 'blue',
  done: 'green',
  missing: 'amber',
  failed: 'red',
};
const sheetCounts = computed(() => {
  const s = sheets.value;
  return s ? { pending: s.pending, downloading: s.downloading, done: s.done, missing: s.missing, failed: s.failed } : null;
});
const sheetTotal = computed(() => (sheetCounts.value ? Object.values(sheetCounts.value).reduce((a, b) => a + b, 0) : 0));
const sheetFinished = computed(() => (sheetCounts.value ? sheetCounts.value.done + sheetCounts.value.missing + sheetCounts.value.failed : 0));

/** Los partidos de la cola agrupados por liga y jornada (una página de jornada de la federación sirve para todos). */
const groups = computed(() => {
  const items = (sheets.value?.items ?? []).filter((i) => sheetFilter.value === 'all' || i.status === sheetFilter.value);
  const map = new Map<string, { key: string; competition: string; matchday: number; items: SheetQueueItemDto[] }>();
  for (const item of items) {
    const key = `${item.competition}|${item.matchday}`;
    if (!map.has(key)) map.set(key, { key, competition: item.competition, matchday: item.matchday, items: [] });
    map.get(key)!.items.push(item);
  }
  return [...map.values()].map((g) => ({
    ...g,
    done: g.items.filter((i) => i.status === 'done').length,
    active: g.items.some((i) => i.status === 'downloading'),
  }));
});
const queuePosition = computed(() => {
  const positions = new Map<string, number>();
  (sheets.value?.items ?? []).filter((i) => i.status === 'pending').forEach((item, index) => positions.set(item.matchId, index + 1));
  return positions;
});

const sheetState = computed(() => {
  const s = sheets.value;
  if (!s) return null;
  if (paused.value) {
    const when = `${countdown(paused.value)} (${formatKickoff(paused.value)})`;
    switch (s.pauseKind) {
      case 'rest': return { tone: 'blue' as const, title: 'Descansando', text: `Pausa entre tandas para no cargar a la federación. Sigue con una sesión nueva en ${when}.` };
      case 'session': return { tone: 'amber' as const, title: 'Sesión cerrada', text: `${s.pauseReason ?? 'La federación cerró la sesión; no es un bloqueo.'} Sigue en ${when}.` };
      case 'retry': return { tone: 'amber' as const, title: 'Reintentando', text: `${s.pauseReason ?? 'La federación devolvió una página vacía; no es un bloqueo.'} Se reintenta en ${when}.` };
      case 'error': return { tone: 'amber' as const, title: 'La federación falla', text: `${s.pauseReason ?? 'La web de la federación da error.'} Se reintenta en ${when}.` };
      case 'day': return { tone: 'amber' as const, title: 'Tope del día', text: `Se han gastado las peticiones de hoy; sigue en ${when}.` };
      case 'hour': return { tone: 'amber' as const, title: 'Tope de la hora', text: `Se han gastado las peticiones de esta hora; sigue en ${when}.` };
      case 'blocked': return { tone: 'red' as const, title: 'Bloqueada', text: `${s.pauseReason ?? 'asturfutbol.es nos ha bloqueado.'} Se reintenta en ${when}.` };
      default: return { tone: 'amber' as const, title: 'En espera', text: `Las descargas siguen en ${when}.` };
    }
  }
  if (s.downloading > 0) return { tone: 'blue' as const, title: 'Descargando', text: 'Bajando un acta de la federación.' };
  if (s.pending > 0 && s.dayRequests >= s.maxPerDay) return { tone: 'amber' as const, title: 'Tope del día', text: 'Se han gastado las peticiones de hoy; sigue a medianoche UTC.' };
  if (s.pending > 0 && s.hourRequests >= s.maxPerHour) return { tone: 'amber' as const, title: 'Tope de la hora', text: 'Se han gastado las peticiones de esta hora; sigue en la siguiente.' };
  if (s.pending > 0) return { tone: 'blue' as const, title: 'Esperando turno', text: s.nextRequestAt ? `Siguiente petición en ${countdown(s.nextRequestAt)}.` : 'A la espera de la siguiente petición.' };
  return { tone: 'slate' as const, title: 'Sin cola', text: 'No hay actas pedidas por descargar.' };
});

// Solo un bloqueo de verdad sale en rojo; el descanso entre tandas es lo normal.
const alertKind = computed(() => ({ red: 'error', amber: 'warning', blue: 'info', slate: 'info' } as const)[sheetState.value?.tone ?? 'slate']);
const pauseIconTone = computed(() => ({ red: 'text-red-500', amber: 'text-amber-500', blue: 'text-brand-500', slate: 'text-slate-400' })[sheetState.value?.tone ?? 'slate']);

async function clearQueue(onlyFinished: boolean) {
  if (!onlyFinished) {
    const ok = await confirmDialog({
      title: 'Vaciar la cola de actas',
      message: `Se quitarán las ${sheets.value?.pending ?? 0} actas que faltan por descargar. Las ya guardadas no se tocan.`,
      confirmLabel: 'Vaciar cola',
      danger: true,
    });
    if (!ok) return;
  }
  busy.value = true;
  try {
    await adminApi.cancelSheetDownloads(props.token, onlyFinished);
    await load();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

defineExpose({ load });
</script>

<template>
  <div class="space-y-6">
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <Spinner v-if="!data && !error" class="my-10" />

    <template v-if="data && football && sheets">
      <!-- Resumen: las dos descargas -->
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section class="card relative overflow-hidden">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="eyebrow">Datos de las ligas · futbolasturiano.es</p>
              <h2 class="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900">
                <span v-if="football.running" class="relative flex h-3 w-3"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" /><span class="relative inline-flex h-3 w-3 rounded-full bg-brand-500" /></span>
                {{ football.running ? 'Descargando' : football.finishedAt ? 'Última descarga' : 'Sin descargas desde que arrancó la API' }}
              </h2>
              <p v-if="football.scope" class="text-sm text-slate-500">{{ football.scope }}</p>
            </div>
            <div class="shrink-0 text-xs text-slate-500 sm:text-right">
              <p v-if="football.startedAt">{{ football.running ? 'En marcha' : 'Duró' }} {{ elapsed(football.startedAt, football.finishedAt) }}</p>
              <p v-if="football.finishedAt">Terminó {{ formatTime(football.finishedAt) }}</p>
            </div>
          </div>
          <div v-if="football.total > 0" class="mt-4">
            <div class="mb-1 flex justify-between text-xs text-slate-600">
              <span class="truncate">{{ football.running ? football.current ?? 'Preparando…' : football.summary }}</span>
              <span class="shrink-0 tabular-nums">{{ leaguesDone }}/{{ football.total }} ligas</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-surface-3">
              <div class="h-full rounded-full bg-brand-500 transition-[width] duration-700" :class="football.running ? 'animate-pulse' : ''" :style="{ width: `${pct(leaguesDone, football.total)}%` }" />
            </div>
          </div>
          <details v-if="!football.running && football.errors.length" class="mt-3 text-xs">
            <summary class="cursor-pointer text-amber-500">{{ football.errors.length }} {{ football.errors.length === 1 ? 'error' : 'errores' }}</summary>
            <ul class="mt-1 space-y-1 text-slate-600"><li v-for="(message, i) in football.errors" :key="i" class="break-words">{{ message }}</li></ul>
          </details>
        </section>

        <section class="card">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="eyebrow">Actas · asturfutbol.es</p>
              <h2 class="mt-1 flex items-center gap-2 text-lg font-bold text-slate-900">
                <Icon v-if="paused" :icon="sheets.pauseKind === 'rest' ? 'mug-hot' : 'pause'" class="h-4 w-4" :class="pauseIconTone" />
                <Icon v-else-if="sheets.downloading" icon="spinner" class="h-4 w-4 animate-spin text-brand-500" />
                <Icon v-else-if="sheets.pending" icon="hourglass-half" class="h-4 w-4 text-amber-500" />
                <Icon v-else icon="file-lines" class="h-4 w-4 text-slate-400" />
                {{ sheetState?.title }}
              </h2>
              <p class="text-sm text-slate-500">{{ sheetState?.text }}</p>
            </div>
            <div v-if="sheetTotal" class="shrink-0 sm:text-right">
              <p class="font-figures text-2xl font-extrabold tabular-nums text-slate-900">{{ sheetFinished }}<span class="text-sm font-medium text-slate-500">/{{ sheetTotal }}</span></p>
              <p class="text-xs text-slate-500">actas terminadas</p>
            </div>
          </div>

          <div v-if="sheetTotal" class="mt-4 flex h-2 overflow-hidden rounded-full bg-surface-3">
            <div class="h-full bg-emerald-500 transition-[width] duration-700" :style="{ width: `${pct(sheets.done, sheetTotal)}%` }" />
            <div class="h-full bg-amber-400 transition-[width] duration-700" :style="{ width: `${pct(sheets.missing, sheetTotal)}%` }" />
            <div class="h-full bg-red-500 transition-[width] duration-700" :style="{ width: `${pct(sheets.failed, sheetTotal)}%` }" />
            <div class="h-full animate-pulse bg-brand-500 transition-[width] duration-700" :style="{ width: `${pct(sheets.downloading, sheetTotal)}%` }" />
          </div>

          <dl class="mt-4 grid grid-cols-2 gap-3 text-xs">
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <dt class="text-slate-500">Peticiones esta hora</dt>
              <dd class="mt-1 font-semibold text-slate-900">{{ sheets.hourRequests }} / {{ sheets.maxPerHour }}</dd>
              <div class="mt-1 h-1 overflow-hidden rounded-full bg-surface-3"><div class="h-full bg-brand-500" :style="{ width: `${pct(sheets.hourRequests, sheets.maxPerHour)}%` }" /></div>
            </div>
            <div class="rounded-lg bg-surface-2 px-3 py-2">
              <dt class="text-slate-500">Peticiones hoy (UTC)</dt>
              <dd class="mt-1 font-semibold text-slate-900">{{ sheets.dayRequests }} / {{ sheets.maxPerDay }}</dd>
              <div class="mt-1 h-1 overflow-hidden rounded-full bg-surface-3"><div class="h-full bg-brand-500" :style="{ width: `${pct(sheets.dayRequests, sheets.maxPerDay)}%` }" /></div>
            </div>
            <div v-if="sheets.maxPerBurst" class="rounded-lg bg-surface-2 px-3 py-2">
              <dt class="text-slate-500">Tanda en curso</dt>
              <dd class="mt-1 font-semibold text-slate-900">{{ sheets.burstRequests }} / {{ sheets.maxPerBurst }}</dd>
              <div class="mt-1 h-1 overflow-hidden rounded-full bg-surface-3"><div class="h-full bg-brand-500" :style="{ width: `${pct(sheets.burstRequests, sheets.maxPerBurst)}%` }" /></div>
              <p class="mt-0.5 text-[11px] text-slate-500">Luego descansa y sigue con sesión nueva</p>
            </div>
            <div class="rounded-lg bg-surface-2 px-3 py-2" :class="{ 'col-span-2': !sheets.maxPerBurst }">
              <dt class="text-slate-500">Terminaría hacia</dt>
              <dd class="mt-1 font-semibold text-slate-900">{{ sheets.estimatedFinishAt ? formatKickoff(sheets.estimatedFinishAt) : '—' }}</dd>
              <p v-if="sheets.requestsNeeded" class="mt-0.5 text-[11px] text-slate-500">≈ {{ sheets.requestsNeeded }} peticiones</p>
            </div>
          </dl>
        </section>
      </div>

      <!-- Ligas -->
      <section v-if="football.leagues.length" class="card">
        <h2 class="font-semibold text-slate-900">Ligas</h2>
        <p class="mb-4 text-xs text-slate-500">Cada liga pasa por calendario, equipos, partidos, clasificación y, si se piden, plantillas.</p>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <article
            v-for="league in football.leagues"
            :key="league.name"
            class="rounded-xl border p-3 transition"
            :class="league.status === 'running' ? 'border-brand-400 bg-brand-500/10 shadow-card' : league.status === 'failed' ? 'border-red-400/60' : 'border-line bg-surface-2'"
          >
            <div class="flex items-center justify-between gap-2">
              <p class="truncate font-semibold text-slate-900">{{ league.name }}</p>
              <Icon v-if="league.status === 'running'" icon="spinner" class="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />
              <Icon v-else-if="league.status === 'done'" icon="circle-check" class="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <Icon v-else-if="league.status === 'failed'" icon="circle-xmark" class="h-3.5 w-3.5 shrink-0 text-red-500" />
              <Icon v-else icon="clock" class="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </div>
            <ol class="mt-2 flex gap-1" aria-label="Fases">
              <li
                v-for="stage in stages"
                :key="stage"
                class="h-1.5 flex-1 rounded-full"
                :class="{ 'bg-emerald-500': stageState(league, stage) === 'done', 'animate-pulse bg-brand-500': stageState(league, stage) === 'current', 'bg-surface-3': stageState(league, stage) === 'idle' }"
                :title="stage"
              />
            </ol>
            <p class="mt-1 text-[11px] text-slate-500">
              <template v-if="league.status === 'running'">{{ league.stage }}</template>
              <template v-else-if="league.status === 'failed'">{{ league.error ?? 'Falló' }}</template>
              <template v-else-if="league.status === 'pending'">En espera</template>
              <template v-else>Terminada</template>
            </p>
            <dl class="mt-2 grid grid-cols-4 gap-1 text-center">
              <div><dt class="text-[10px] uppercase tracking-wide text-slate-500">Equipos</dt><dd class="font-figures font-bold tabular-nums text-slate-900">{{ league.teams }}</dd></div>
              <div><dt class="text-[10px] uppercase tracking-wide text-slate-500">Partidos</dt><dd class="font-figures font-bold tabular-nums text-slate-900">{{ league.matches }}</dd></div>
              <div><dt class="text-[10px] uppercase tracking-wide text-slate-500">Jugados</dt><dd class="font-figures font-bold tabular-nums text-slate-900">{{ league.played }}</dd></div>
              <div><dt class="text-[10px] uppercase tracking-wide text-slate-500">Fichas</dt><dd class="font-figures font-bold tabular-nums text-slate-900">{{ league.roster }}</dd></div>
            </dl>
          </article>
        </div>
      </section>

      <!-- Lo último descargado -->
      <section v-if="football.feed.length" class="card">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="font-semibold text-slate-900">Lo último descargado</h2>
            <p class="text-xs text-slate-500">Partidos, equipos nuevos, clasificaciones y plantillas según van llegando.</p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="item in feedFilters"
              :key="item.value"
              type="button"
              class="rounded-full border px-3 py-1 text-xs"
              :class="feedFilter === item.value ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
              @click="feedFilter = item.value"
            >{{ item.label }}</button>
          </div>
        </div>
        <p v-if="feed.length === 0" class="mt-4 text-sm text-slate-500">Nada en este filtro: los partidos sin cambios se ven en «Todo».</p>
        <TransitionGroup v-else tag="ul" name="feed" class="mt-3 max-h-[32rem] divide-y divide-line overflow-y-auto pr-1">
          <li v-for="event in feed" :key="event.id" class="flex items-center gap-3 py-2 text-sm">
            <Icon :icon="feedIcon[event.kind]" class="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <template v-if="event.kind === 'match' && event.home && event.away">
              <span class="w-9 shrink-0 text-xs font-semibold text-slate-500">J{{ event.matchday }}</span>
              <div class="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <span class="flex min-w-0 items-center justify-end gap-2 text-right"><span class="truncate text-slate-800">{{ event.home.name }}</span><TeamCrest :src="event.home.crestUrl" :name="event.home.name" size="xs" /></span>
                <RouterLink v-if="event.matchId" :to="{ name: 'match', params: { matchId: event.matchId } }" class="rounded-md bg-surface-2 px-2 py-0.5 font-figures font-bold tabular-nums text-slate-900 hover:text-accent-400">
                  {{ event.homeGoals !== null ? `${event.homeGoals} - ${event.awayGoals}` : 'vs' }}
                </RouterLink>
                <span class="flex min-w-0 items-center gap-2"><TeamCrest :src="event.away.crestUrl" :name="event.away.name" size="xs" /><span class="truncate text-slate-800">{{ event.away.name }}</span></span>
              </div>
            </template>
            <template v-else>
              <TeamCrest v-if="event.home" :src="event.home.crestUrl" :name="event.home.name" size="xs" />
              <span class="min-w-0 flex-1 truncate text-slate-800">{{ event.text }}</span>
            </template>
            <span class="hidden shrink-0 text-xs text-slate-500 md:inline">{{ event.league }}</span>
            <Badge v-if="event.change === 'new'" tone="green" class="shrink-0">Nuevo</Badge>
            <Badge v-else-if="event.change === 'updated'" tone="blue" class="shrink-0">Actualizado</Badge>
            <span class="w-14 shrink-0 text-right text-[11px] tabular-nums text-slate-500">{{ formatTime(event.at) }}</span>
          </li>
        </TransitionGroup>
      </section>

      <!-- Cola de actas -->
      <section class="card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 class="font-semibold text-slate-900">Actas pedidas a la federación</h2>
            <p class="max-w-3xl text-xs text-slate-500">
              Se piden al lanzar los datos de las ligas con «Actas de los partidos jugados». Van liga a liga y jornada a jornada (una página de jornada sirve para
              todas sus actas) y siempre por detrás de las que abre un usuario. asturfutbol.es cierra la sesión si se le piden muchas seguidas, así que van en
              tandas<template v-if="sheets.maxPerBurst"> de {{ sheets.maxPerBurst }}</template> con un descanso entre ellas, con un tope de
              {{ sheets.maxPerHour }} por hora y {{ sheets.maxPerDay }} al día. La cola se guarda y sigue tras reiniciar la API.
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="btn-ghost px-3 py-1.5 text-xs" :disabled="busy || sheetFinished === 0" @click="clearQueue(true)">Limpiar terminadas</button>
            <button type="button" class="btn-ghost px-3 py-1.5 text-xs text-red-500" :disabled="busy || sheets.pending === 0" @click="clearQueue(false)">
              <Icon icon="trash" class="h-3 w-3" />Vaciar cola
            </button>
          </div>
        </div>

        <Alert v-if="paused && sheetState" :kind="alertKind" class="mt-4">
          <strong>{{ sheetState.title }}.</strong> {{ sheetState.text }}
        </Alert>

        <div v-if="sheetCounts && sheetTotal" class="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Estado">
          <button
            type="button"
            class="rounded-full border px-3 py-1 text-xs"
            :class="sheetFilter === 'all' ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
            @click="sheetFilter = 'all'"
          >Todas · {{ sheetTotal }}</button>
          <button
            v-for="(count, status) in sheetCounts"
            :key="status"
            type="button"
            class="rounded-full border px-3 py-1 text-xs"
            :class="sheetFilter === status ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
            :disabled="count === 0"
            @click="sheetFilter = status"
          >{{ sheetLabels[status] }} · {{ count }}</button>
        </div>

        <p v-if="!sheetTotal" class="mt-4 rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-slate-500">
          <Icon icon="download" class="mb-2 h-5 w-5 text-slate-400" /><br />
          No hay actas pedidas. Lanza los datos de las ligas con «Actas de los partidos jugados» marcado.
        </p>

        <div v-else class="mt-4 space-y-4">
          <div v-for="group in groups" :key="group.key" class="rounded-xl border border-line" :class="group.active ? 'border-brand-400 shadow-card' : ''">
            <header class="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2">
              <p class="truncate text-sm font-semibold text-slate-900">{{ group.competition }} · Jornada {{ group.matchday }}</p>
              <span class="shrink-0 text-xs tabular-nums text-slate-500">{{ group.done }}/{{ group.items.length }} guardadas</span>
            </header>
            <ul class="divide-y divide-line">
              <li v-for="item in group.items" :key="item.matchId" class="grid grid-cols-1 gap-2 px-3 py-2 text-sm sm:grid-cols-[minmax(0,1fr)_14rem] sm:items-center" :class="item.status === 'downloading' ? 'bg-brand-500/10' : ''">
                <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                  <span class="flex min-w-0 items-center justify-end gap-2 text-right"><span class="truncate text-slate-800">{{ item.home.name }}</span><TeamCrest :src="item.home.crestUrl" :name="item.home.name" size="sm" /></span>
                  <RouterLink :to="{ name: 'match', params: { matchId: item.matchId } }" class="rounded-md bg-surface-2 px-2 py-0.5 text-center font-figures font-bold tabular-nums text-slate-900 hover:text-accent-400">
                    {{ item.homeGoals !== null ? `${item.homeGoals} - ${item.awayGoals}` : 'vs' }}
                    <span class="block text-[10px] font-normal text-slate-500">{{ formatKickoff(item.kickoffAt) }}</span>
                  </RouterLink>
                  <span class="flex min-w-0 items-center gap-2"><TeamCrest :src="item.away.crestUrl" :name="item.away.name" size="sm" /><span class="truncate text-slate-800">{{ item.away.name }}</span></span>
                </div>
                <div class="flex min-w-0 items-center gap-2 sm:justify-end">
                  <Icon v-if="item.status === 'downloading'" icon="spinner" class="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />
                  <Badge :tone="sheetTone[item.status]" class="shrink-0">
                    {{ sheetLabels[item.status] }}<template v-if="item.status === 'pending' && queuePosition.get(item.matchId)"> · #{{ queuePosition.get(item.matchId) }}</template>
                  </Badge>
                  <span v-if="item.detail" class="min-w-0 truncate text-xs text-slate-500" :title="item.detail">{{ item.detail }}</span>
                  <span v-else-if="item.status === 'downloading' && item.startedAt" class="text-xs text-slate-500">{{ elapsed(item.startedAt) }}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.feed-enter-active {
  transition: all 0.45s ease;
}
.feed-enter-from {
  opacity: 0;
  transform: translateY(-8px);
  background-color: rgb(59 130 246 / 0.15);
}
</style>
