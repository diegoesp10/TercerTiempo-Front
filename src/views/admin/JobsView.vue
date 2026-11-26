<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { adminApi } from '@/api/admin';
import { ApiError, errorMessage } from '@/api/http';
import AdminMfaStep from '@/components/admin/AdminMfaStep.vue';
import ResponsiveTabs from '@/components/ui/ResponsiveTabs.vue';
import ClubInvitationsPanel from '@/components/admin/ClubInvitationsPanel.vue';
import FootballSyncPanel from '@/components/admin/FootballSyncPanel.vue';
import LicensesPanel from '@/components/admin/LicensesPanel.vue';
import PassEarningsPanel from '@/components/admin/PassEarningsPanel.vue';
import ModerationPanel from '@/components/admin/ModerationPanel.vue';
import LicensingSettingsPanel from '@/components/admin/LicensingSettingsPanel.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useSort } from '@/composables/useSort';
import type { AdminAuthResponse, AdminMfaChallenge, JobDto, JobRunDto, JobsOverviewDto, ScrapeRequestDto, ScrapeSourceDto } from '@/types/api';
import { formatKickoff } from '@/utils/format';
import { pauseLabels, pauseText, runDuration as duration, runStatusLabels as statusLabels, runStatusTone as statusTone, scheduleText as interval, until } from '@/components/admin/jobs';
import AnalyticsPanel from '@/components/admin/AnalyticsPanel.vue';
import LiveDownloadsPanel from '@/components/admin/LiveDownloadsPanel.vue';
import PresencePanel from '@/components/admin/PresencePanel.vue';
import { useAdminSessionStore } from '@/stores/adminSession';
import { useAuthStore } from '@/stores/auth';
import CookiesAdminPanel from '@/components/admin/CookiesAdminPanel.vue';
import InjuryTypesAdminPanel from '@/components/admin/InjuryTypesAdminPanel.vue';
import BodySitesAdminPanel from '@/components/admin/BodySitesAdminPanel.vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';

/**
 * Página oculta del administrador (/jobs, sin enlace en el menú): cuándo y cómo se han actualizado los datos, las
 * llamadas reales a cada web externa y el lanzamiento a mano de cada trabajo. Su sesión dura lo que la pestaña y no
 * convive con la de una cuenta: entrar aquí cierra la del club, técnico o jugador (stores/adminSession).
 */
const RUNNING_EVERY_MS = 4_000;
const IDLE_EVERY_MS = 30_000;

const admin = useAdminSessionStore();
const auth = useAuthStore();
const session = computed(() => admin.session);

type AdminTab = 'jobs' | 'live' | 'presence' | 'licenses' | 'invitations' | 'moderation' | 'analytics' | 'cookies' | 'injuries';
const tabs: { value: AdminTab; label: string }[] = [
  { value: 'jobs', label: 'Trabajos y scrapeos' },
  { value: 'live', label: 'Descargas en directo' },
  { value: 'presence', label: 'Gente en sesión' },
  { value: 'licenses', label: 'Licencias y cobros' },
  { value: 'invitations', label: 'Invitaciones de clubes' },
  { value: 'moderation', label: 'Moderación' },
  { value: 'analytics', label: 'Uso de la web' },
  { value: 'cookies', label: 'Cookies' },
  { value: 'injuries', label: 'Lesiones' },
];
const tab = ref<AdminTab>('jobs');
// En «Lesiones», los dos catálogos: los tipos y los sitios del cuerpo por los que preguntan.
const injuryCatalog = ref<'types' | 'sites'>('types');
const injuryCatalogOptions = [
  { value: 'types' as const, label: 'Tipos de lesión' },
  { value: 'sites' as const, label: 'Sitios del cuerpo' },
];
// Trabajo que se acaba de lanzar: «Descargas en directo» se abre en su apartado.
const focus = ref<string | null>(null);
const licensesPanel = ref<InstanceType<typeof LicensesPanel> | null>(null);
const form = reactive({ userName: '', password: '' });
const loggingIn = ref(false);
const loginError = ref<string | null>(null);
// En publicación la contraseña no basta: el login devuelve el reto del código de la app de autenticación.
const mfa = ref<{ challenge: AdminMfaChallenge; userName: string } | null>(null);

const data = ref<JobsOverviewDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const provider = ref<string | null>(null);
const launching = ref<string | null>(null);
const launchMessage = ref<string | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;

const anyRunning = computed(() => data.value?.jobs.some((j) => j.running) ?? false);
const jobTitles = computed(() => new Map((data.value?.jobs ?? []).map((j) => [j.name, j.title])));
const runsById = computed(() => new Map((data.value?.runs ?? []).map((r) => [r.id, r])));

/** Los datos reales (ligas, partidos, actas oficiales) los descarga un solo entorno a la vez y los demás los copian. */
const ingester = computed(() => {
  const current = data.value?.ingester;
  if (!data.value) return null;
  if (!current) return { tone: 'amber' as const, text: 'Ahora no los descarga ningún entorno: se actualizarán en cuanto arranque uno que pueda descargar.' };
  const since = formatKickoff(current.since);
  if (current.thisProcess) return { tone: 'green' as const, text: `Los descarga este entorno (${current.environment}) desde ${since}.` };
  return {
    tone: 'blue' as const,
    text: `Los descarga ${current.environment} desde ${since}; este entorno los copia cada pocos minutos${current.thisEnvironmentCanIngest ? ' y tomará el relevo si ese entorno se para' : ''}.`,
  };
});

async function login() {
  loggingIn.value = true;
  loginError.value = null;
  try {
    const response = await adminApi.login(form.userName, form.password);
    form.password = '';
    if (response.mfa) mfa.value = { challenge: response.mfa, userName: response.userName };
    else await start(response);
  } catch (e) {
    loginError.value = errorMessage(e);
  } finally {
    loggingIn.value = false;
  }
}

async function start(response: AdminAuthResponse) {
  if (!response.accessToken || !response.expiresAt) return;
  mfa.value = null;
  admin.start({ token: response.accessToken, userName: response.userName, expiresAt: response.expiresAt });
  await load();
}

function restartLogin(message: string | null) {
  mfa.value = null;
  loginError.value = message;
}

function logout(message: string | null = null) {
  stopPolling();
  admin.end();
  data.value = null;
  loginError.value = message;
}

async function load(silent = false) {
  if (!session.value) return;
  if (!silent) loading.value = true;
  try {
    data.value = await adminApi.jobs(session.value.token, provider.value, silent);
    error.value = null;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      logout('La sesión de administrador ha caducado. Vuelve a entrar.');
      return;
    }
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
    schedule();
  }
}

function schedule() {
  stopPolling();
  if (!session.value || document.hidden) return;
  timer = setTimeout(() => void load(true), anyRunning.value ? RUNNING_EVERY_MS : IDLE_EVERY_MS);
}

function stopPolling() {
  if (timer) clearTimeout(timer);
  timer = null;
}

// Recargas sueltas (justo después de lanzar un trabajo): se cancelan al salir de la página.
const pending = new Set<ReturnType<typeof setTimeout>>();
function later(run: () => void, ms: number) {
  const id = setTimeout(() => { pending.delete(id); run(); }, ms);
  pending.add(id);
}

function onVisibilityChange() {
  if (document.hidden) stopPolling();
  else void load(true);
}

async function launch(job: JobDto) {
  if (!session.value) return;
  launching.value = job.name;
  launchMessage.value = null;
  try {
    const launched = await adminApi.run(session.value.token, job.name);
    // Con la federación en pausa queda pedido: empieza solo al acabar la pausa, sin saltársela.
    launchMessage.value = launched.pause
      ? `«${job.title}» pedido. ${pauseText(launched)}: empieza solo entonces.`
      : `«${job.title}» lanzado. Aquí lo ves en directo.`;
    watchLive(job.name);
    // El trabajo arranca en segundo plano: un instante después ya figura en marcha.
    later(() => void load(true), 1_000);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    launching.value = null;
  }
}

function watchLive(job: string) {
  tab.value = 'live';
  focus.value = job;
}

function onSyncLaunched(message: string) {
  launchMessage.value = message;
  watchLive('football-data');
  later(() => void load(true), 1_000);
}

watch(tab, (value) => {
  if (value !== 'live') focus.value = null;
});

watch(provider, () => void load());

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (session.value) void load();
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  stopPolling();
  for (const id of pending) clearTimeout(id);
  pending.clear();
});

/** Uso del límite de peticiones (0-100), siempre dentro de la barra. */
const usage = (used: number | null, max: number | null) => (used === null || !max ? 0 : Math.min(100, (used / max) * 100));

function origin(request: ScrapeRequestDto) {
  if (!request.jobRunId) return 'Bajo demanda';
  const run = runsById.value.get(request.jobRunId);
  if (!run) return 'Ejecución antigua';
  return `${jobTitles.value.get(run.job) ?? run.job}${run.manual ? ' (a mano)' : ''}`;
}

const statusClass = (code: number | null) =>
  code === null ? 'text-red-600' : code >= 500 || code === 403 || code === 429 ? 'text-red-600' : code >= 300 ? 'text-amber-700' : 'text-emerald-700';

const sourceTitle = (source: ScrapeSourceDto) =>
  ({ asturfutbol: 'asturfutbol.es (actas)', futbolasturiano: 'futbolasturiano.es (datos)', escudos: 'Escudos' } as Record<string, string>)[source.provider] ?? source.provider;

const time = (iso: string | null) => (iso ? Date.parse(iso) : null);

const sources = computed(() => data.value?.sources ?? []);
type SourceSortKey = 'web' | 'hour' | 'day' | 'state' | 'last24h' | 'last';
const { sorted: sortedSources, sortBy: sortSources, state: sourceSortState } = useSort<ScrapeSourceDto, SourceSortKey>(
  sources,
  {
    web: (s) => sourceTitle(s),
    hour: (s) => (s.maxPerHour ? s.hourRequests : null),
    day: (s) => (s.maxPerDay ? s.dayRequests : null),
    // En pausa, esperando turno y disponible: primero lo que frena las descargas.
    state: (s) => (s.pausedUntil ? 0 : s.nextRequestAt ? 1 : 2),
    last24h: (s) => s.last24h,
    last: (s) => time(s.lastRequestAt),
  },
  'web',
  { desc: false, ascendingFirst: ['web', 'state'] },
);

const runs = computed(() => data.value?.runs ?? []);
type RunSortKey = 'started' | 'job' | 'status' | 'duration' | 'requests' | 'summary';
const { sorted: sortedRuns, sortBy: sortRuns, state: runSortState } = useSort<JobRunDto, RunSortKey>(
  runs,
  {
    started: (r) => Date.parse(r.startedAt),
    job: (r) => jobTitles.value.get(r.job) ?? r.job,
    status: (r) => statusLabels[r.status],
    duration: (r) => (r.finishedAt ? Date.parse(r.finishedAt) : Date.now()) - Date.parse(r.startedAt),
    requests: (r) => r.requests,
    summary: (r) => [r.scope, r.summary].filter(Boolean).join(' · ') || null,
  },
  'started',
  { ascendingFirst: ['job', 'status', 'summary'] },
);

const requests = computed(() => data.value?.requests ?? []);
type RequestSortKey = 'at' | 'web' | 'code' | 'ms' | 'origin' | 'url';
const { sorted: sortedRequests, sortBy: sortRequests, state: requestSortState } = useSort<ScrapeRequestDto, RequestSortKey>(
  requests,
  {
    at: (r) => Date.parse(r.at),
    web: (r) => r.provider,
    // Sin respuesta cuenta como el peor código.
    code: (r) => r.statusCode ?? 1000,
    ms: (r) => r.durationMs,
    origin: (r) => origin(r),
    url: (r) => `${r.method} ${r.url}`,
  },
  'at',
  { ascendingFirst: ['web', 'origin', 'url'] },
);
</script>

<template>
  <section v-if="!session" class="mx-auto max-w-md" data-page-surface="transparent">
    <div v-if="mfa" class="card">
      <AdminMfaStep :challenge="mfa.challenge" :user-name="mfa.userName" @verified="start" @restart="restartLogin" />
    </div>
    <div v-else class="card">
      <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900"><Icon icon="lock" class="h-5 w-5 text-accent-400" /> Administración</h1>
      <p class="mt-1 text-sm text-slate-500">Trabajos en segundo plano y llamadas a las webs externas. Solo para el administrador.</p>
      <form class="mt-6 space-y-4" @submit.prevent="login">
        <Alert v-if="loginError" kind="error">{{ loginError }}</Alert>
        <Alert v-if="auth.isAuthenticated" kind="warning">
          Tienes abierta la sesión de <strong>{{ auth.displayName }}</strong>. Al entrar como administrador se cerrará: las dos no pueden convivir.
        </Alert>
        <div>
          <label class="label" for="admin-user">Usuario</label>
          <input id="admin-user" v-model="form.userName" type="text" autocomplete="username" required class="input" />
        </div>
        <div>
          <label class="label" for="admin-password">Contraseña</label>
          <input id="admin-password" v-model="form.password" type="password" autocomplete="current-password" required class="input" />
        </div>
        <button type="submit" class="btn-primary w-full py-2.5" v-busy="loggingIn" :disabled="loggingIn">{{ loggingIn ? 'Entrando…' : 'Entrar' }}</button>
      </form>
    </div>
  </section>

  <template v-else>
    <PageHeader title="Administración" :subtitle="`Scrapeos, licencias y altas de clubes. Sesión de ${session.userName}.`">
      <template #actions>
        <button type="button" class="btn-secondary" v-busy="loading" :disabled="loading" @click="load()"><Icon icon="rotate-right" class="h-3.5 w-3.5" /> Actualizar</button>
        <button type="button" class="btn-ghost" @click="logout()"><Icon icon="right-from-bracket" class="h-3.5 w-3.5" /> Salir</button>
      </template>
    </PageHeader>

    <ResponsiveTabs
      :items="tabs.map((item) => ({ key: item.value, label: item.label }))"
      :model-value="tab"
      label="Apartados de la administración"
      variant="pills"
      class="mb-6"
      @update:model-value="(key) => (tab = key as AdminTab)"
    />

    <div v-if="tab === 'licenses'" class="space-y-6">
      <LicensingSettingsPanel :token="session.token" @saved="licensesPanel?.load()" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
      <LicensesPanel ref="licensesPanel" :token="session.token" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
      <PassEarningsPanel :token="session.token" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
    </div>
    <div v-else-if="tab === 'live'" class="space-y-4">
      <Alert v-if="launchMessage" kind="success">{{ launchMessage }}</Alert>
      <LiveDownloadsPanel :token="session.token" :focus="focus" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
    </div>
    <PresencePanel v-else-if="tab === 'presence'" :token="session.token" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
    <ClubInvitationsPanel v-else-if="tab === 'invitations'" :token="session.token" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
    <AnalyticsPanel v-else-if="tab === 'analytics'" :token="session.token" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
    <ModerationPanel v-else-if="tab === 'moderation'" :token="session.token" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
    <CookiesAdminPanel v-else-if="tab === 'cookies'" :token="session.token" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
    <div v-else-if="tab === 'injuries'" class="space-y-4">
      <ChoiceToggle v-model="injuryCatalog" :options="injuryCatalogOptions" label="Qué catálogo" />
      <InjuryTypesAdminPanel v-if="injuryCatalog === 'types'" :token="session.token" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
      <BodySitesAdminPanel v-else :token="session.token" @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')" />
    </div>

    <template v-else>
    <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>
    <Alert v-if="launchMessage" kind="success" class="mb-4">{{ launchMessage }}</Alert>
    <Spinner v-if="loading && !data" />

    <div v-if="data" class="space-y-6">
      <p v-if="ingester" class="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-slate-700">
        <Icon icon="database" class="mt-0.5 h-3.5 w-3.5 shrink-0" :class="ingester.tone === 'green' ? 'text-success' : ingester.tone === 'amber' ? 'text-warning' : 'text-brand-400'" />
        <span><strong class="text-slate-900">Datos reales.</strong> {{ ingester.text }}</span>
      </p>
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <article v-for="job in data.jobs" :key="job.name" class="card" :class="job.name === 'football-data' ? 'lg:col-span-2' : ''">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="font-semibold text-slate-900">{{ job.title }}</h2>
              <p class="mt-0.5 text-xs text-slate-500">{{ job.description }}</p>
            </div>
            <Badge v-if="!job.enabled" tone="slate">Desactivado</Badge>
            <Badge v-else-if="job.running" tone="blue">En marcha</Badge>
            <Badge v-else-if="job.pause" tone="amber">En pausa</Badge>
            <Badge v-else tone="green">{{ interval(job) }}</Badge>
          </div>

          <p v-if="job.pause" class="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-xs text-slate-700">
            <Icon :icon="job.pause.kind === 'rest' ? 'mug-hot' : 'pause'" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              <strong class="text-slate-900">{{ pauseText(job) }}.</strong>
              {{ job.pause.reason ?? 'La federación limita las peticiones.' }} Sigue sola a esa hora; si lo lanzas antes, queda pedido para entonces.
            </span>
          </p>

          <div v-if="job.progress" class="mt-3">
            <div class="mb-1 flex justify-between gap-2 text-xs text-slate-600">
              <span class="min-w-0 break-words">{{ job.progress.current ?? 'Preparando…' }}</span>
              <span v-if="job.progress.total" class="shrink-0 tabular-nums">{{ job.progress.done }}/{{ job.progress.total }}</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div class="h-full rounded-full bg-brand-500 transition-[width] duration-700" :style="{ width: `${usage(job.progress.done, job.progress.total)}%` }" />
            </div>
          </div>

          <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt class="text-slate-500">Próxima</dt>
            <dd class="text-right text-slate-800">{{ job.running ? 'Ahora' : job.external ? 'Al subir un vídeo' : job.pause ? `Al acabar la pausa (${until(job.pause.until)})` : job.nextRunAt ? formatKickoff(job.nextRunAt) : job.enabled ? 'Solo a mano' : '—' }}</dd>
            <template v-if="job.lastRun">
              <dt class="text-slate-500">Última</dt>
              <dd class="text-right text-slate-800">{{ formatKickoff(job.lastRun.startedAt) }} · {{ duration(job.lastRun) }}</dd>
              <template v-if="job.lastRun.scope">
                <dt class="text-slate-500">Alcance</dt>
                <dd class="text-right text-slate-800">{{ job.lastRun.scope }}</dd>
              </template>
              <dt class="text-slate-500">Resultado</dt>
              <dd class="text-right"><Badge :tone="statusTone[job.lastRun.status]">{{ statusLabels[job.lastRun.status] }}</Badge> <span class="text-xs text-slate-500">{{ job.lastRun.requests }} llamadas{{ job.lastRun.manual ? ' · a mano' : '' }}{{ job.realData && job.lastRun.environment ? ` · ${job.lastRun.environment}` : '' }}</span></dd>
            </template>
          </dl>
          <p v-if="job.lastRun?.summary" class="mt-2 text-xs text-slate-600">{{ job.lastRun.summary }}</p>
          <details v-if="job.lastRun?.errors.length" class="mt-2 text-xs">
            <summary class="cursor-pointer text-amber-700">{{ job.lastRun.errors.length }} {{ job.lastRun.errors.length === 1 ? 'error' : 'errores' }}</summary>
            <ul class="mt-1 max-h-40 space-y-1 overflow-y-auto text-slate-600">
              <li v-for="(message, i) in job.lastRun.errors" :key="i" class="break-words">{{ message }}</li>
            </ul>
          </details>

          <FootballSyncPanel
            v-if="job.name === 'football-data'"
            :token="session.token"
            :running="job.running"
            :enabled="job.enabled"
            @launched="onSyncLaunched"
            @unauthorized="logout('La sesión de administrador ha caducado. Vuelve a entrar.')"
          />
          <p v-else-if="job.external" class="mt-4 text-xs text-slate-500">
            Lo hace el servicio de vídeo, en su propio proceso, cada vez que se sube un vídeo: aquí solo se ve su historial.
          </p>
          <div v-else class="mt-4 flex flex-wrap gap-2">
            <button v-if="job.running" type="button" class="btn-primary" @click="watchLive(job.name)">
              <Icon icon="eye" class="h-3.5 w-3.5" /> En marcha · verlo en directo
            </button>
            <button
              v-else
              type="button"
              class="btn-primary"
              v-busy="launching === job.name"
              :disabled="!job.enabled || launching !== null"
              @click="launch(job)"
            >
              <Icon icon="play" class="h-3.5 w-3.5" /> {{ job.pause ? `Lanzar (empieza a ${until(job.pause.until)})` : 'Lanzar ahora' }}
            </button>
            <button v-if="!job.running" type="button" class="btn-ghost" @click="watchLive(job.name)">
              <Icon icon="eye" class="h-3.5 w-3.5" /> En directo
            </button>
          </div>
        </article>
      </div>

      <section class="card">
        <h2 class="font-semibold text-slate-900">Webs externas</h2>
        <p class="mb-3 text-xs text-slate-500">Peticiones de la hora y del día frente a su límite (solo las webs de actas lo tienen), pausas por bloqueo y lo llamado en las últimas 24 h.</p>
        <div class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <SortHeader class="px-3 py-2 text-left" label="Web" v-bind="sourceSortState('web')" @sort="sortSources('web')" />
                <SortHeader class="px-3 py-2 text-left" label="Esta hora" title="Peticiones de esta hora" v-bind="sourceSortState('hour')" @sort="sortSources('hour')" />
                <SortHeader class="px-3 py-2 text-left" label="Hoy (UTC)" title="Peticiones de hoy (UTC)" v-bind="sourceSortState('day')" @sort="sortSources('day')" />
                <SortHeader class="px-3 py-2 text-left" label="Estado" v-bind="sourceSortState('state')" @sort="sortSources('state')" />
                <SortHeader class="px-3 py-2 text-right" label="24 h" title="Llamadas en las últimas 24 h" v-bind="sourceSortState('last24h')" @sort="sortSources('last24h')" />
                <SortHeader class="px-3 py-2 text-right" label="Última llamada" v-bind="sourceSortState('last')" @sort="sortSources('last')" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="source in sortedSources" :key="source.provider">
                <td class="px-3 py-2 font-medium whitespace-nowrap text-slate-800">{{ sourceTitle(source) }}</td>
                <td class="px-3 py-2">
                  <template v-if="source.maxPerHour">
                    <span class="tabular-nums">{{ source.hourRequests }}/{{ source.maxPerHour }}</span>
                    <div class="mt-1 h-1 w-24 overflow-hidden rounded-full bg-surface-3"><div class="h-full bg-accent-400" :style="{ width: `${usage(source.hourRequests, source.maxPerHour)}%` }" /></div>
                  </template>
                  <span v-else class="text-slate-400">Sin límite</span>
                </td>
                <td class="px-3 py-2">
                  <template v-if="source.maxPerDay">
                    <span class="tabular-nums">{{ source.dayRequests }}/{{ source.maxPerDay }}</span>
                    <div class="mt-1 h-1 w-24 overflow-hidden rounded-full bg-surface-3"><div class="h-full bg-accent-400" :style="{ width: `${usage(source.dayRequests, source.maxPerDay)}%` }" /></div>
                  </template>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="px-3 py-2 text-xs whitespace-nowrap">
                  <span v-if="source.pausedUntil" class="font-semibold" :class="source.pauseKind === 'blocked' ? 'text-red-600' : 'text-warning'" :title="source.pauseReason ?? undefined">
                    {{ source.pauseKind ? pauseLabels[source.pauseKind] : 'En pausa' }} hasta {{ formatKickoff(source.pausedUntil) }}
                  </span>
                  <span v-else-if="source.nextRequestAt" class="text-slate-600">Siguiente desde {{ formatKickoff(source.nextRequestAt) }}</span>
                  <span v-else class="text-emerald-700">Disponible</span>
                </td>
                <td class="px-3 py-2 text-right tabular-nums">{{ source.last24h }}<span v-if="source.failed24h" class="text-red-600"> ({{ source.failed24h }} fallos)</span></td>
                <td class="px-3 py-2 text-right text-xs whitespace-nowrap text-slate-600">{{ source.lastRequestAt ? formatKickoff(source.lastRequestAt) : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2 class="mb-3 font-semibold text-slate-900">Ejecuciones</h2>
        <p v-if="!data.runs.length" class="text-sm text-slate-500">Todavía no hay ejecuciones guardadas.</p>
        <!-- Unas 15 ejecuciones a la vista (el resumen ocupa como mucho dos líneas; entero, al pasar el ratón); el resto, con
             scroll y la cabecera fija, como en «Últimas llamadas». -->
        <div v-else class="max-h-[62rem] overflow-auto rounded-lg border border-slate-200">
          <table class="min-w-full text-sm">
            <thead class="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <SortHeader class="px-3 py-2 text-left" label="Inicio" v-bind="runSortState('started')" @sort="sortRuns('started')" />
                <SortHeader class="px-3 py-2 text-left" label="Trabajo" v-bind="runSortState('job')" @sort="sortRuns('job')" />
                <SortHeader class="px-3 py-2 text-left" label="Estado" v-bind="runSortState('status')" @sort="sortRuns('status')" />
                <SortHeader class="px-3 py-2 text-right" label="Duración" v-bind="runSortState('duration')" @sort="sortRuns('duration')" />
                <SortHeader class="px-3 py-2 text-right" label="Llamadas" v-bind="runSortState('requests')" @sort="sortRuns('requests')" />
                <SortHeader class="px-3 py-2 text-left" label="Resumen" v-bind="runSortState('summary')" @sort="sortRuns('summary')" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="run in sortedRuns" :key="run.id">
                <td class="px-3 py-2 whitespace-nowrap text-slate-700">{{ formatKickoff(run.startedAt) }}</td>
                <td class="px-3 py-2 whitespace-nowrap">{{ jobTitles.get(run.job) ?? run.job }}<span class="text-xs text-slate-500"> · {{ run.manual ? 'a mano' : 'automática' }}{{ run.environment ? ` · ${run.environment}` : '' }}</span></td>
                <td class="px-3 py-2"><Badge :tone="statusTone[run.status]">{{ statusLabels[run.status] }}</Badge></td>
                <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap">{{ duration(run) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ run.requests }}</td>
                <td class="min-w-80 max-w-xl px-3 py-2 text-xs text-slate-600">
                  <span v-if="run.scope" class="block break-words font-medium text-slate-700">{{ run.scope }}</span>
                  <span class="block break-words">{{ run.summary ?? '—' }}<span v-if="run.errors.length" class="text-amber-700"> · {{ run.errors.length }} {{ run.errors.length === 1 ? 'error' : 'errores' }}</span></span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold text-slate-900">Últimas llamadas</h2>
            <p class="text-xs text-slate-500">Cada petición real a una web externa (lo servido desde la caché no aparece). Se guardan 30 días.</p>
          </div>
          <ChoiceToggle
            :options="[{ value: '', label: 'Todas' }, ...data.sources.map((source) => ({ value: source.provider, label: sourceTitle(source) }))]"
            :model-value="provider ?? ''"
            label="Qué web"
            size="xs"
            @update:model-value="provider = $event || null"
          />
        </div>
        <p v-if="!data.requests.length" class="text-sm text-slate-500">Sin llamadas guardadas.</p>
        <div v-else class="max-h-[32rem] overflow-auto rounded-lg border border-slate-200">
          <table class="min-w-full text-sm">
            <thead class="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <SortHeader class="px-3 py-2 text-left" label="Hora" v-bind="requestSortState('at')" @sort="sortRequests('at')" />
                <SortHeader class="px-3 py-2 text-left" label="Web" v-bind="requestSortState('web')" @sort="sortRequests('web')" />
                <SortHeader class="px-3 py-2 text-right" label="Código" title="Código de respuesta" v-bind="requestSortState('code')" @sort="sortRequests('code')" />
                <SortHeader class="px-3 py-2 text-right" label="ms" title="Duración (ms)" v-bind="requestSortState('ms')" @sort="sortRequests('ms')" />
                <SortHeader class="px-3 py-2 text-left" label="Origen" v-bind="requestSortState('origin')" @sort="sortRequests('origin')" />
                <SortHeader class="px-3 py-2 text-left" label="URL" v-bind="requestSortState('url')" @sort="sortRequests('url')" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="request in sortedRequests" :key="request.id">
                <td class="px-3 py-1.5 whitespace-nowrap text-xs text-slate-600">{{ formatKickoff(request.at) }}</td>
                <td class="px-3 py-1.5 whitespace-nowrap text-xs">{{ request.provider }}</td>
                <td class="px-3 py-1.5 text-right font-semibold tabular-nums" :class="statusClass(request.statusCode)" :title="request.error ?? undefined">{{ request.statusCode ?? 'Error' }}</td>
                <td class="px-3 py-1.5 text-right tabular-nums text-slate-600">{{ request.durationMs }}</td>
                <td class="px-3 py-1.5 whitespace-nowrap text-xs text-slate-600">{{ origin(request) }}</td>
                <td class="px-3 py-1.5 text-xs text-slate-500"><span class="block max-w-[28rem] [overflow-wrap:anywhere]">{{ request.method }} {{ request.url }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
    </template>
  </template>
</template>
