<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue';
import { useRouter } from 'vue-router';
import { onClickOutside, onKeyStroke } from '@vueuse/core';
import { useAlertsStore } from '@/stores/alerts';
import type { AlertDto, AlertKind } from '@/types/api';
import { formatDate, formatKickoff } from '@/utils/format';

/**
 * Campanita de la cabecera: avisos de la app (licencia y solicitudes del club; convocatorias de partido y citaciones a
 * entrenar del jugador; ausencias a entrenamientos para el cuerpo técnico). Cada aviso dice de qué es: partido o entrenamiento no se mezclan.
 *
 * Como en las redes sociales: al abrirla, los nuevos quedan vistos (el número se va) y, la próxima vez, pasan a
 * «Anteriores», plegados para que no hagan ruido. Mientras está abierta se siguen enseñando arriba.
 */
const store = useAlertsStore();
const router = useRouter();

const open = ref(false);
const root = useTemplateRef<HTMLElement>('root');
onClickOutside(root, () => { open.value = false; });
onKeyStroke('Escape', () => { open.value = false; });

// Los nuevos que se enseñan en esta apertura: siguen arriba aunque ya estén vistos, hasta que se cierre.
const shownIds = ref<Set<string>>(new Set());
const showEarlier = ref(false);
const shown = computed(() => store.alerts.filter((a) => shownIds.value.has(a.id)));
const earlier = computed(() => store.earlier.filter((a) => !shownIds.value.has(a.id)));

function keepShown(alerts: readonly AlertDto[]) {
  if (alerts.length === 0) return;
  shownIds.value = new Set([...shownIds.value, ...alerts.map((a) => a.id)]);
}

async function toggle() {
  open.value = !open.value;
  if (!open.value) return;
  shownIds.value = new Set();
  showEarlier.value = false;
  keepShown(store.fresh);
  await store.load();
  if (!open.value) return;
  keepShown(store.fresh);
  const unseen = store.alerts.filter((a) => shownIds.value.has(a.id) && !a.seen).map((a) => a.id);
  void store.markSeen(unseen);
}

/** Días que quedan hasta el día al que se refiere el aviso (hoy cuenta como 0). */
function daysLeft(alert: AlertDto) {
  if (!alert.dueOn) return null;
  const today = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((Date.parse(`${alert.dueOn}T00:00:00Z`) - today) / 86_400_000);
}

const kindInfo: Record<AlertKind, { icon: string; label: string }> = {
  LicenseExpiring: { icon: 'credit-card', label: 'Licencia' },
  PassRequest: { icon: 'ticket', label: 'Solicitud de acceso' },
  MatchCallUp: { icon: 'futbol', label: 'Convocatoria · partido' },
  MatchNotCalledUp: { icon: 'futbol', label: 'Convocatoria · partido' },
  TrainingCall: { icon: 'calendar-check', label: 'Entrenamiento · citación' },
  TrainingAbsence: { icon: 'calendar-check', label: 'Entrenamiento · ausencia' },
  CallUpShort: { icon: 'user-group', label: 'Convocatoria · incompleta' },
  LeagueSuspension: { icon: 'ban', label: 'Sanción · comité de competición' },
};

const remaining = (days: number) => (days <= 0 ? 'Acaba hoy' : days === 1 ? 'Acaba mañana' : `Quedan ${days} días`);

async function openAlert(alert: AlertDto) {
  // Marcarlo como leído no frena la navegación: si falla, el aviso sigue sin leer y se reintenta la próxima vez.
  if (!alert.read) void store.markRead(alert.id).catch(() => {});
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

    <!-- En el móvil la campana no está en el borde (a su derecha va el menú): el panel se fija bajo la cabecera, centrado y
         con margen a los dos lados, para que no se salga por la izquierda. Desde sm cuelga de la campana. -->
    <div
      v-if="open"
      class="fixed left-3 right-3 top-[4.5rem] z-30 mx-auto max-w-md overflow-hidden rounded-xl border border-line bg-surface shadow-card sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mx-0 sm:mt-2 sm:w-[22rem] sm:max-w-none"
      role="dialog"
      aria-label="Avisos"
    >
      <div class="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <p class="font-semibold text-slate-900">Avisos</p>
      </div>

      <div class="max-h-[min(24rem,calc(100dvh-9rem))] overflow-y-auto">
        <p v-if="shown.length === 0" class="px-4 py-6 text-center text-sm text-slate-500">
          {{ earlier.length ? 'No tienes avisos nuevos.' : 'No tienes avisos.' }}
        </p>
        <ul class="divide-y divide-line">
          <li
            v-for="alert in showEarlier ? [...shown, ...earlier] : shown"
            :key="alert.id"
            :class="!shownIds.has(alert.id) ? (alert.resolved ? 'opacity-50' : 'opacity-70') : ''"
          >
            <button type="button" class="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-surface-2" @click="openAlert(alert)">
              <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="shownIds.has(alert.id) && !alert.read ? 'bg-red-500' : 'bg-transparent'" aria-hidden="true" />
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
                <span class="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-accent-400">
                  <Icon :icon="kindInfo[alert.kind]?.icon ?? 'bell'" class="h-2.5 w-2.5" />{{ kindInfo[alert.kind]?.label ?? 'Aviso' }}
                </span>
                <span class="mt-0.5 block text-xs leading-relaxed text-slate-600">{{ alert.message }}</span>
                <span class="mt-1 block text-[11px] text-slate-400">
                  {{ formatKickoff(alert.createdAt) }}<template v-if="alert.dueOn"> · último día {{ formatDate(alert.dueOn) }}</template>
                </span>
              </span>
            </button>
          </li>
        </ul>
        <button
          v-if="earlier.length"
          type="button"
          class="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2.5 text-xs font-medium text-slate-500 transition hover:bg-surface-2 hover:text-slate-700"
          :aria-expanded="showEarlier"
          @click="showEarlier = !showEarlier"
        >
          <Icon icon="chevron-down" class="h-3 w-3 transition-transform" :class="showEarlier ? 'rotate-180' : ''" />
          {{ showEarlier ? 'Ocultar anteriores' : `Ver anteriores (${earlier.length})` }}
        </button>
      </div>
    </div>
  </div>
</template>
