<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { adminApi } from '@/api/admin';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { AccountType, PresenceOverviewDto, PresenceSessionDto } from '@/types/api';
import { accountTypeLabels, formatTime } from '@/utils/format';

/**
 * Gente en sesión: las cuentas (club, cuerpo técnico y jugadores) con la web abierta, solo para verlo. Cada inicio de
 * sesión es una fila, con la página en la que está, el dispositivo y su última señal; se actualiza sola cada 10 segundos
 * y busca por nombre, email o equipo en la API (con mucha gente conectada no se trae la lista entera).
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const REFRESH_MS = 10_000;

const data = ref<PresenceOverviewDto | null>(null);
const error = ref<string | null>(null);
const query = ref('');
const type = ref<AccountType | 'all'>('all');
const status = ref<'all' | 'online' | 'idle'>('all');
const now = ref(Date.now());
let poll: ReturnType<typeof setTimeout> | null = null;
let typing: ReturnType<typeof setTimeout> | null = null;
let tick: ReturnType<typeof setInterval> | null = null;

async function load() {
  if (poll) clearTimeout(poll);
  try {
    data.value = await adminApi.presence(props.token, query.value.trim());
    error.value = null;
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      emit('unauthorized');
      return;
    }
    error.value = errorMessage(e);
  }
  if (!document.hidden) poll = setTimeout(() => void load(), REFRESH_MS);
}

watch(query, () => {
  if (typing) clearTimeout(typing);
  typing = setTimeout(() => void load(), 300);
});

function onVisibility() {
  if (document.hidden) {
    if (poll) clearTimeout(poll);
  } else {
    void load();
  }
}

onMounted(() => {
  void load();
  tick = setInterval(() => { now.value = Date.now(); }, 1_000);
  document.addEventListener('visibilitychange', onVisibility);
});
onBeforeUnmount(() => {
  if (poll) clearTimeout(poll);
  if (typing) clearTimeout(typing);
  if (tick) clearInterval(tick);
  document.removeEventListener('visibilitychange', onVisibility);
});

const sessions = computed(() =>
  (data.value?.sessions ?? []).filter((s) => (type.value === 'all' || s.accountType === type.value) && (status.value === 'all' || s.status === status.value)),
);

const typeFilters = computed(() => [
  { value: 'all' as const, label: 'Todos', count: (data.value?.online ?? 0) + (data.value?.idle ?? 0) },
  { value: 'Club' as const, label: 'Clubes', count: data.value?.clubs ?? 0 },
  { value: 'Coach' as const, label: 'Cuerpo técnico', count: data.value?.coaches ?? 0 },
  { value: 'Player' as const, label: 'Jugadores', count: data.value?.players ?? 0 },
]);
const statusFilters = [
  { value: 'all' as const, label: 'Todos los estados' },
  { value: 'online' as const, label: 'En línea' },
  { value: 'idle' as const, label: 'Inactivos' },
];
const typeTone: Record<AccountType, 'amber' | 'blue' | 'green'> = { Club: 'amber', Coach: 'blue', Player: 'green' };

function ago(iso: string) {
  const seconds = Math.max(0, Math.round((now.value - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `hace ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  return `hace ${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const isOnline = (session: PresenceSessionDto) => session.status === 'online';
</script>

<template>
  <div class="space-y-6">
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <Spinner v-if="!data && !error" class="my-10" />

    <template v-if="data">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div class="card py-4">
          <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <span class="relative flex h-2.5 w-2.5"><span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" /></span>
            En línea
          </p>
          <p class="mt-1 font-figures text-3xl font-extrabold tabular-nums text-slate-900">{{ data.online }}</p>
        </div>
        <div class="card py-4">
          <p class="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500"><span class="h-2.5 w-2.5 rounded-full bg-slate-400" />Inactivos</p>
          <p class="mt-1 font-figures text-3xl font-extrabold tabular-nums text-slate-900">{{ data.idle }}</p>
        </div>
        <div class="card py-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Clubes</p>
          <p class="mt-1 font-figures text-3xl font-extrabold tabular-nums text-slate-900">{{ data.clubs }}</p>
        </div>
        <div class="card py-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Cuerpo técnico</p>
          <p class="mt-1 font-figures text-3xl font-extrabold tabular-nums text-slate-900">{{ data.coaches }}</p>
        </div>
        <div class="card py-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Jugadores</p>
          <p class="mt-1 font-figures text-3xl font-extrabold tabular-nums text-slate-900">{{ data.players }}</p>
        </div>
      </div>

      <section class="card">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 class="font-semibold text-slate-900">Gente en sesión</h2>
            <p class="text-xs text-slate-500">
              Cuentas con la web abierta en los últimos 30 minutos. En línea: con señales en los últimos 2,5 minutos. Se actualiza sola cada 10 segundos.
            </p>
          </div>
          <label class="relative w-full sm:w-80">
            <span class="sr-only">Buscar por nombre, email o equipo</span>
            <Icon icon="magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input v-model="query" type="search" class="input pl-9" placeholder="Buscar por nombre, email o equipo" autocomplete="off" />
          </label>
        </div>

        <div class="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de cuenta">
          <button
            v-for="item in typeFilters"
            :key="item.value"
            type="button"
            role="radio"
            :aria-checked="type === item.value"
            class="rounded-full border px-3 py-1 text-xs"
            :class="type === item.value ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
            @click="type = item.value"
          >{{ item.label }} · {{ item.count }}</button>
          <span class="mx-1 hidden w-px self-stretch bg-line sm:block" />
          <button
            v-for="item in statusFilters"
            :key="item.value"
            type="button"
            role="radio"
            :aria-checked="status === item.value"
            class="rounded-full border px-3 py-1 text-xs"
            :class="status === item.value ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
            @click="status = item.value"
          >{{ item.label }}</button>
        </div>

        <p v-if="sessions.length === 0" class="mt-4 rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-slate-500">
          <Icon icon="users" class="mb-2 h-5 w-5 text-slate-400" /><br />
          {{ query.trim() || type !== 'all' || status !== 'all' ? 'Nadie coincide con la búsqueda.' : 'Nadie tiene la web abierta con su cuenta ahora mismo.' }}
        </p>

        <div v-else class="mt-4 max-h-[70vh] overflow-auto rounded-lg border border-line">
          <table class="min-w-full text-sm">
            <thead class="sticky top-0 z-10 bg-surface-2 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left">Estado</th>
                <th class="px-3 py-2 text-left">Cuenta</th>
                <th class="px-3 py-2 text-left">Tipo</th>
                <th class="px-3 py-2 text-left">Equipos</th>
                <th class="px-3 py-2 text-left">Página</th>
                <th class="px-3 py-2 text-left">Dispositivo</th>
                <th class="px-3 py-2 text-right">Desde</th>
                <th class="px-3 py-2 text-right">Última señal</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="session in sessions" :key="session.sessionId">
                <td class="px-3 py-2 whitespace-nowrap">
                  <span class="inline-flex items-center gap-2 text-xs font-medium" :class="isOnline(session) ? 'text-emerald-600' : 'text-slate-500'">
                    <span class="h-2 w-2 rounded-full" :class="isOnline(session) ? 'bg-emerald-500' : 'bg-slate-400'" />
                    {{ isOnline(session) ? 'En línea' : 'Inactivo' }}
                  </span>
                </td>
                <td class="max-w-64 px-3 py-2">
                  <span class="block truncate font-medium text-slate-900">{{ session.name }}</span>
                  <span v-if="session.email" class="block truncate text-xs text-slate-500">{{ session.email }}</span>
                </td>
                <td class="px-3 py-2 whitespace-nowrap"><Badge :tone="typeTone[session.accountType]">{{ accountTypeLabels[session.accountType] }}</Badge></td>
                <td class="max-w-56 px-3 py-2 text-xs text-slate-600"><span class="line-clamp-2" :title="session.teams ?? undefined">{{ session.teams ?? '—' }}</span></td>
                <td class="max-w-56 px-3 py-2 text-xs">
                  <RouterLink v-if="session.path" :to="session.path" class="block truncate text-accent-400 hover:underline" :title="session.path">{{ session.path }}</RouterLink>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="px-3 py-2 whitespace-nowrap text-xs text-slate-600">{{ session.device }}</td>
                <td class="px-3 py-2 text-right whitespace-nowrap text-xs text-slate-600" :title="ago(session.startedAt)">{{ formatTime(session.startedAt) }}</td>
                <td class="px-3 py-2 text-right whitespace-nowrap text-xs tabular-nums text-slate-600">{{ ago(session.lastSeenAt) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="mt-3 text-xs text-slate-500">
          Cada inicio de sesión es una fila: la misma cuenta en dos dispositivos sale dos veces. No se guarda nada: la lista vive en memoria de la API.
          <template v-if="data.matching > data.sessions.length"> Se muestran las {{ data.sessions.length }} más recientes de {{ data.matching }}.</template>
        </p>
      </section>
    </template>
  </div>
</template>
