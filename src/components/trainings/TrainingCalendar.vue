<script setup lang="ts">
import { computed } from 'vue';
import type { TrainingSummaryDto } from '@/types/api';
import { formatTime, toDateKey } from '@/utils/format';

/**
 * Calendario mensual de la plantilla: una casilla por día (semanas de lunes a domingo) con sus sesiones. El padre
 * carga las sesiones del rango visible y decide qué pasa al pulsar un día o una sesión.
 */
const props = withDefaults(
  defineProps<{
    /** Primer día del mes que se muestra (YYYY-MM-DD). */
    month: string;
    sessions: TrainingSummaryDto[];
    canPlan?: boolean;
    selectedId?: string | null;
  }>(),
  { canPlan: false, selectedId: null },
);
const emit = defineEmits<{ select: [session: TrainingSummaryDto]; plan: [dateKey: string] }>();

const weekdayHeaders = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const todayKey = toDateKey(new Date());

const monthDate = computed(() => new Date(`${props.month}T00:00:00`));

/** Del lunes de la semana del día 1 al domingo de la semana del último día. */
const days = computed(() => {
  const first = monthDate.value;
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const byDay = new Map<string, TrainingSummaryDto[]>();
  for (const session of props.sessions) {
    const key = toDateKey(new Date(session.startsAt));
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    cells.push({ key, day: date.getDate(), inMonth: date.getMonth() === first.getMonth(), isToday: key === todayKey, sessions: byDay.get(key) ?? [] });
  }
  // Si la última fila es toda del mes siguiente se quita (meses de cinco semanas).
  return cells.slice(35).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
});

const kindClass: Record<TrainingSummaryDto['kind'], string> = {
  Season: 'border-brand-500/40 bg-brand-500/10 text-brand-600',
  Preseason: 'border-amber-400/50 bg-amber-400/10 text-amber-700',
  Recovery: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-700',
  MatchPreparation: 'border-accent-400/50 bg-accent-400/10 text-accent-500',
  Other: 'border-slate-300 bg-surface-2 text-slate-600',
};
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-line bg-surface">
    <div class="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      <div v-for="h in weekdayHeaders" :key="h" class="py-1.5">{{ h }}</div>
    </div>
    <div class="grid grid-cols-7">
      <div
        v-for="cell in days"
        :key="cell.key"
        class="min-h-[4.5rem] border-b border-r border-line p-1 sm:min-h-[6rem] sm:p-1.5"
        :class="[cell.inMonth ? '' : 'bg-surface-2/60 text-slate-400', cell.isToday ? 'bg-brand-500/5' : '']"
      >
        <div class="mb-1 flex items-center justify-between">
          <span class="text-xs font-semibold" :class="cell.isToday ? 'rounded-full bg-brand-500 px-1.5 text-white' : cell.inMonth ? 'text-slate-700' : ''">{{ cell.day }}</span>
          <button v-if="canPlan && cell.inMonth" type="button" class="btn-ghost -mr-1 px-1 py-0 text-slate-400 hover:text-brand-500" :aria-label="`Nuevo entrenamiento el día ${cell.day}`" @click="emit('plan', cell.key)">
            <Icon icon="plus" class="h-3 w-3" />
          </button>
        </div>
        <ul class="space-y-1">
          <li v-for="session in cell.sessions" :key="session.id">
            <button
              type="button"
              class="block w-full truncate rounded border px-1 py-0.5 text-left text-[11px] font-medium leading-tight transition hover:brightness-110 sm:text-xs"
              :class="[kindClass[session.kind], session.id === selectedId ? 'ring-2 ring-brand-400' : '']"
              :title="`${session.title} · ${formatTime(session.startsAt)}`"
              @click="emit('select', session)"
            >
              <span class="tabular-nums">{{ formatTime(session.startsAt) }}</span> {{ session.title }}
              <span v-if="session.mine?.status === 'WillMiss'" class="ml-0.5 text-amber-600" title="Has avisado de que faltas">·</span>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
