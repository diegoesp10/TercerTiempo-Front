<script setup lang="ts">
import { ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import { onClickOutside, onKeyStroke } from '@vueuse/core';
import { useAlertsStore } from '@/stores/alerts';
import type { AlertDto } from '@/types/api';
import { formatDate, formatKickoff } from '@/utils/format';

/** Campanita del club en la cabecera: avisos de la app (de momento, que su licencia va a acabar). */
const store = useAlertsStore();
const router = useRouter();

const open = ref(false);
const root = useTemplateRef<HTMLElement>('root');
onClickOutside(root, () => { open.value = false; });
onKeyStroke('Escape', () => { open.value = false; });

function toggle() {
  open.value = !open.value;
  if (open.value) void store.load();
}

/** Días que quedan hasta el día al que se refiere el aviso (hoy cuenta como 0). */
function daysLeft(alert: AlertDto) {
  if (!alert.dueOn) return null;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((Date.parse(`${alert.dueOn}T00:00:00Z`) - today) / 86_400_000);
}

const remaining = (days: number) => (days <= 0 ? 'Acaba hoy' : days === 1 ? 'Acaba mañana' : `Quedan ${days} días`);

async function openAlert(alert: AlertDto) {
  if (!alert.read) await store.markRead(alert.id);
  open.value = false;
  if (alert.link) await router.push(alert.link);
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="btn-ghost relative px-2"
      :aria-label="store.unread ? `Avisos: ${store.unread} sin leer` : 'Avisos'"
      :aria-expanded="open"
      aria-haspopup="dialog"
      @click="toggle"
    >
      <Icon icon="bell" class="h-4 w-4" />
      <span
        v-if="store.unread"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold leading-none text-white"
      >{{ store.unread > 9 ? '9+' : store.unread }}</span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-surface shadow-card"
      role="dialog"
      aria-label="Avisos del club"
    >
      <div class="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <p class="font-semibold text-slate-900">Avisos</p>
        <button v-if="store.unread" type="button" class="text-xs font-medium text-accent-400 hover:underline" @click="store.markAllRead()">
          Marcar todo como leído
        </button>
      </div>

      <p v-if="store.alerts.length === 0" class="px-4 py-6 text-center text-sm text-slate-500">No tienes avisos.</p>
      <ul v-else class="max-h-96 divide-y divide-line overflow-y-auto">
        <li v-for="alert in store.alerts" :key="alert.id" :class="alert.resolved ? 'opacity-60' : ''">
          <button type="button" class="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface-2" @click="openAlert(alert)">
            <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="!alert.read && !alert.resolved ? 'bg-red-500' : 'bg-transparent'" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="flex items-baseline justify-between gap-2">
                <span class="text-sm font-semibold text-slate-900">{{ alert.title }}</span>
                <span v-if="alert.resolved" class="shrink-0 text-[11px] font-medium text-emerald-600">Resuelto</span>
                <span
                  v-else-if="daysLeft(alert) !== null"
                  class="shrink-0 text-[11px] font-semibold"
                  :class="daysLeft(alert)! <= 5 ? 'text-red-500' : 'text-amber-500'"
                >{{ remaining(daysLeft(alert)!) }}</span>
              </span>
              <span class="mt-0.5 block text-xs leading-relaxed text-slate-600">{{ alert.message }}</span>
              <span class="mt-1 block text-[11px] text-slate-400">
                {{ formatKickoff(alert.createdAt) }}<template v-if="alert.dueOn"> · último día {{ formatDate(alert.dueOn) }}</template>
              </span>
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
