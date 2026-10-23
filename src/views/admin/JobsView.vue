<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { adminApi } from '@/api/admin';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { JobDto, JobRunDto, JobRunStatus, JobsOverviewDto, ScrapeRequestDto, ScrapeSourceDto } from '@/types/api';
import { formatKickoff } from '@/utils/format';

/**
 * Página oculta del administrador (/jobs, sin enlace en el menú): cuándo y cómo se han actualizado los datos, las
 * llamadas reales a cada web externa y el lanzamiento a mano de cada trabajo. Su sesión es aparte de la normal y
 * dura lo que la pestaña (sessionStorage).
 */
const STORAGE_KEY = 'tt.admin-session';
const RUNNING_EVERY_MS = 4_000;
const IDLE_EVERY_MS = 30_000;

interface AdminSession { token: string; userName: string; expiresAt: string }

function readSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const session = raw ? (JSON.parse(raw) as AdminSession) : null;
    return session && new Date(session.expiresAt).getTime() > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function writeSession(session: AdminSession | null) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sin almacenamiento: la sesión vive solo en memoria */
  }
}

const session = ref<AdminSession | null>(readSession());
const form = reactive({ userName: '', password: '' });
const loggingIn = ref(false);
const loginError = ref<string | null>(null);

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

async function login() {
  loggingIn.value = true;
  loginError.value = null;
  try {
    const response = await adminApi.login(form.userName, form.password);
    session.value = { token: response.accessToken, userName: response.userName, expiresAt: response.expiresAt };
    writeSession(session.value);
    form.password = '';
    await load();
  } catch (e) {
    loginError.value = errorMessage(e);
  } finally {
    loggingIn.value = false;
  }
}

function logout(message: string | null = null) {
  stopPolling();
  session.value = null;
  data.value = null;
  writeSession(null);
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

function onVisibilityChange() {
  if (document.hidden) stopPolling();
  else void load(true);
}

async function launch(job: JobDto) {
  if (!session.value) return;
  launching.value = job.name;
  launchMessage.value = null;
  try {
    await adminApi.run(session.value.token, job.name);
    launchMessage.value = `«${job.title}» lanzado. La página se actualiza sola mientras dura.`;
    // El trabajo arranca en segundo plano: un instante después ya figura en marcha.
    setTimeout(() => void load(true), 1_000);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    launching.value = null;
  }
}

watch(provider, () => void load());

onMounted(() => {
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (session.value) void load();
});

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  stopPolling();
});

const statusLabels: Record<JobRunStatus, string> = {
  running: 'En marcha',
  succeeded: 'Correcta',
  partial: 'Con errores',
  failed: 'Fallida',
  paused: 'En pausa',
  interrupted: 'Interrumpida',
};
const statusTone: Record<JobRunStatus, 'green' | 'amber' | 'red' | 'blue' | 'slate'> = {
  running: 'blue',
  succeeded: 'green',
  partial: 'amber',
  failed: 'red',
  paused: 'amber',
  interrupted: 'slate',
};

function duration(run: JobRunDto) {
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(run.startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min ${seconds % 60} s` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const interval = (job: JobDto) =>
  job.intervalMinutes === null ? 'Solo a mano' : job.intervalMinutes % 60 === 0 ? `Cada ${job.intervalMinutes / 60} h` : `Cada ${job.intervalMinutes} min`;

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
  ({ besoccer: 'BeSoccer (actas)', asturfutbol: 'asturfutbol.es (actas)', futbolasturiano: 'futbolasturiano.es (datos)', escudos: 'Escudos', 'besoccer-datos': 'BeSoccer (datos)' })[source.provider] ?? source.provider;
</script>

<template>
  <section v-if="!session" class="mx-auto max-w-md">
    <div class="card">
      <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900"><Icon icon="lock" class="h-5 w-5 text-accent-400" /> Administración</h1>
      <p class="mt-1 text-sm text-slate-500">Trabajos en segundo plano y llamadas a las webs externas. Solo para el administrador.</p>
      <form class="mt-6 space-y-4" @submit.prevent="login">
        <Alert v-if="loginError" kind="error">{{ loginError }}</Alert>
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
    <PageHeader title="Trabajos y scrapeos" :subtitle="`Cuándo y cómo se han actualizado los datos, y cada llamada a las webs externas. Sesión de ${session.userName}.`">
      <template #actions>
        <button type="button" class="btn-secondary" v-busy="loading" :disabled="loading" @click="load()"><Icon icon="rotate-right" class="h-3.5 w-3.5" /> Actualizar</button>
        <button type="button" class="btn-ghost" @click="logout()"><Icon icon="right-from-bracket" class="h-3.5 w-3.5" /> Salir</button>
      </template>
    </PageHeader>

    <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>
    <Alert v-if="launchMessage" kind="success" class="mb-4">{{ launchMessage }}</Alert>
    <Spinner v-if="loading && !data" />

    <div v-if="data" class="space-y-6">
      <div class="grid gap-4 lg:grid-cols-2">
        <article v-for="job in data.jobs" :key="job.name" class="card">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="font-semibold text-slate-900">{{ job.title }}</h2>
              <p class="mt-0.5 text-xs text-slate-500">{{ job.description }}</p>
            </div>
            <Badge v-if="!job.enabled" tone="slate">Desactivado</Badge>
            <Badge v-else-if="job.running" tone="blue">En marcha</Badge>
            <Badge v-else tone="green">{{ interval(job) }}</Badge>
          </div>

          <div v-if="job.progress" class="mt-3">
            <div class="mb-1 flex justify-between gap-2 text-xs text-slate-600">
              <span class="truncate">{{ job.progress.current ?? 'Preparando…' }}</span>
              <span class="tabular-nums">{{ job.progress.done }}/{{ job.progress.total }}</span>
            </div>
            <div class="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
              <div class="h-full rounded-full bg-brand-500 transition-[width] duration-700" :style="{ width: `${usage(job.progress.done, job.progress.total)}%` }" />
            </div>
          </div>

          <dl class="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt class="text-slate-500">Próxima</dt>
            <dd class="text-right text-slate-800">{{ job.running ? 'Ahora' : job.nextRunAt ? formatKickoff(job.nextRunAt) : job.enabled ? 'Solo a mano' : '—' }}</dd>
            <template v-if="job.lastRun">
              <dt class="text-slate-500">Última</dt>
              <dd class="text-right text-slate-800">{{ formatKickoff(job.lastRun.startedAt) }} · {{ duration(job.lastRun) }}</dd>
              <dt class="text-slate-500">Resultado</dt>
              <dd class="text-right"><Badge :tone="statusTone[job.lastRun.status]">{{ statusLabels[job.lastRun.status] }}</Badge> <span class="text-xs text-slate-500">{{ job.lastRun.requests }} llamadas{{ job.lastRun.manual ? ' · a mano' : '' }}</span></dd>
            </template>
          </dl>
          <p v-if="job.lastRun?.summary" class="mt-2 text-xs text-slate-600">{{ job.lastRun.summary }}</p>
          <details v-if="job.lastRun?.errors.length" class="mt-2 text-xs">
            <summary class="cursor-pointer text-amber-700">{{ job.lastRun.errors.length }} {{ job.lastRun.errors.length === 1 ? 'error' : 'errores' }}</summary>
            <ul class="mt-1 max-h-40 space-y-1 overflow-y-auto text-slate-600">
              <li v-for="(message, i) in job.lastRun.errors" :key="i" class="break-words">{{ message }}</li>
            </ul>
          </details>

          <button
            type="button"
            class="btn-primary mt-4"
            v-busy="launching === job.name"
            :disabled="!job.enabled || job.running || launching !== null"
            @click="launch(job)"
          >
            <Icon icon="play" class="h-3.5 w-3.5" /> {{ job.running ? 'En marcha…' : 'Lanzar ahora' }}
          </button>
        </article>
      </div>

      <section class="card">
        <h2 class="font-semibold text-slate-900">Webs externas</h2>
        <p class="mb-3 text-xs text-slate-500">Peticiones de la hora y del día frente a su límite (solo las webs de actas lo tienen), pausas por bloqueo y lo llamado en las últimas 24 h.</p>
        <div class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left">Web</th>
                <th class="px-3 py-2 text-left">Esta hora</th>
                <th class="px-3 py-2 text-left">Hoy (UTC)</th>
                <th class="px-3 py-2 text-left">Estado</th>
                <th class="px-3 py-2 text-right">24 h</th>
                <th class="px-3 py-2 text-right">Última llamada</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="source in data.sources" :key="source.provider">
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
                  <span v-if="source.pausedUntil" class="font-semibold text-red-600">En pausa hasta {{ formatKickoff(source.pausedUntil) }}</span>
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
        <div v-else class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left">Inicio</th>
                <th class="px-3 py-2 text-left">Trabajo</th>
                <th class="px-3 py-2 text-left">Estado</th>
                <th class="px-3 py-2 text-right">Duración</th>
                <th class="px-3 py-2 text-right">Llamadas</th>
                <th class="px-3 py-2 text-left">Resumen</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="run in data.runs" :key="run.id">
                <td class="px-3 py-2 whitespace-nowrap text-slate-700">{{ formatKickoff(run.startedAt) }}</td>
                <td class="px-3 py-2 whitespace-nowrap">{{ jobTitles.get(run.job) ?? run.job }}<span class="text-xs text-slate-500"> · {{ run.manual ? 'a mano' : 'automática' }}</span></td>
                <td class="px-3 py-2"><Badge :tone="statusTone[run.status]">{{ statusLabels[run.status] }}</Badge></td>
                <td class="px-3 py-2 text-right tabular-nums whitespace-nowrap">{{ duration(run) }}</td>
                <td class="px-3 py-2 text-right tabular-nums">{{ run.requests }}</td>
                <td class="max-w-md px-3 py-2 text-xs text-slate-600">
                  {{ run.summary ?? '—' }}<span v-if="run.errors.length" class="text-amber-700"> · {{ run.errors.length }} {{ run.errors.length === 1 ? 'error' : 'errores' }}</span>
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
          <div class="flex flex-wrap gap-1.5">
            <button type="button" class="rounded-full border px-3 py-1 text-xs" :class="provider === null ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600'" @click="provider = null">Todas</button>
            <button
              v-for="source in data.sources"
              :key="source.provider"
              type="button"
              class="rounded-full border px-3 py-1 text-xs"
              :class="provider === source.provider ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600'"
              @click="provider = source.provider"
            >{{ sourceTitle(source) }}</button>
          </div>
        </div>
        <p v-if="!data.requests.length" class="text-sm text-slate-500">Sin llamadas guardadas.</p>
        <div v-else class="max-h-[32rem] overflow-auto rounded-lg border border-slate-200">
          <table class="min-w-full text-sm">
            <thead class="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left">Hora</th>
                <th class="px-3 py-2 text-left">Web</th>
                <th class="px-3 py-2 text-right">Código</th>
                <th class="px-3 py-2 text-right">ms</th>
                <th class="px-3 py-2 text-left">Origen</th>
                <th class="px-3 py-2 text-left">URL</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="request in data.requests" :key="request.id">
                <td class="px-3 py-1.5 whitespace-nowrap text-xs text-slate-600">{{ formatKickoff(request.at) }}</td>
                <td class="px-3 py-1.5 whitespace-nowrap text-xs">{{ request.provider }}</td>
                <td class="px-3 py-1.5 text-right font-semibold tabular-nums" :class="statusClass(request.statusCode)" :title="request.error ?? undefined">{{ request.statusCode ?? 'Error' }}</td>
                <td class="px-3 py-1.5 text-right tabular-nums text-slate-600">{{ request.durationMs }}</td>
                <td class="px-3 py-1.5 whitespace-nowrap text-xs text-slate-600">{{ origin(request) }}</td>
                <td class="max-w-[28rem] truncate px-3 py-1.5 text-xs text-slate-500" :title="request.url">{{ request.method }} {{ request.url }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </template>
</template>
