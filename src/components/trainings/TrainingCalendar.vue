<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import type { TrainingSummaryDto } from '@/types/api';
import { formatDayHeading, formatDurationMinutes, formatTime, toDateKey } from '@/utils/format';

/**
 * Calendario mensual de la plantilla: una casilla por día (semanas de lunes a domingo) con sus sesiones. El padre
 * carga las sesiones del rango visible y decide qué pasa al pulsar un día o una sesión.
 *
 * En pantallas anchas cada casilla lista sus sesiones; en el móvil la rejilla es compacta (un punto por sesión) y las
 * sesiones del día elegido se leen enteras debajo.
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

interface Cell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  sessions: TrainingSummaryDto[];
}

/** Del lunes de la semana del día 1 al domingo de la semana del último día. */
const days = computed<Cell[]>(() => {
  const first = monthDate.value;
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const byDay = new Map<string, TrainingSummaryDto[]>();
  for (const session of props.sessions) {
    const key = toDateKey(new Date(session.startsAt));
    byDay.set(key, [...(byDay.get(key) ?? []), session]);
  }
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    cells.push({ key, day: date.getDate(), inMonth: date.getMonth() === first.getMonth(), isToday: key === todayKey, sessions: byDay.get(key) ?? [] });
  }
  // Si la última fila es toda del mes siguiente se quita (meses de cinco semanas).
  return cells.slice(35).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
});

// En el móvil se elige un día: hoy si está en el mes a la vista; si no, el primer día del mes con sesiones (o el 1).
const selectedDay = ref<string>(todayKey);
watch(
  () => [props.month, props.sessions] as const,
  () => {
    const cells = days.value;
    if (cells.some((c) => c.key === selectedDay.value && c.inMonth)) return;
    const today = cells.find((c) => c.isToday && c.inMonth);
    const firstWithSessions = cells.find((c) => c.inMonth && c.sessions.length > 0);
    selectedDay.value = (today ?? firstWithSessions ?? cells.find((c) => c.inMonth) ?? cells[0]!).key;
  },
  { immediate: true },
);
const selected = computed(() => days.value.find((c) => c.key === selectedDay.value) ?? null);

const kindClass: Record<TrainingSummaryDto['kind'], string> = {
  Season: 'border-brand-500/40 bg-brand-500/10 text-brand-600',
  Preseason: 'border-amber-400/50 bg-amber-400/10 text-amber-700',
  Recovery: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-700',
  MatchPreparation: 'border-accent-400/50 bg-accent-400/10 text-accent-500',
  Other: 'border-slate-300 bg-surface-2 text-slate-600',
};

const dotClass: Record<TrainingSummaryDto['kind'], string> = {
  Season: 'bg-brand-500',
  Preseason: 'bg-amber-400',
  Recovery: 'bg-emerald-400',
  MatchPreparation: 'bg-accent-400',
  Other: 'bg-slate-400',
};
</script>

<template>
  <div>
    <!-- Pantallas anchas: cada día con sus sesiones -->
    <div class="hidden overflow-hidden rounded-xl border border-line bg-surface sm:block">
      <div class="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <div v-for="h in weekdayHeaders" :key="h" class="py-1.5">{{ h }}</div>
      </div>
      <div class="grid grid-cols-7">
        <div
          v-for="cell in days"
          :key="cell.key"
          class="min-h-[6rem] border-b border-r border-line p-1.5"
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
                class="block w-full truncate rounded border px-1 py-0.5 text-left text-xs font-medium leading-tight transition hover:brightness-110"
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

    <!-- Móvil: rejilla compacta con un punto por sesión y el día elegido entero debajo -->
    <div class="sm:hidden">
      <div class="overflow-hidden rounded-xl border border-line bg-surface">
        <div class="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <div v-for="h in weekdayHeaders" :key="h" class="py-1.5">{{ h }}</div>
        </div>
        <div class="grid grid-cols-7 gap-px bg-line p-px">
          <button
            v-for="cell in days"
            :key="cell.key"
            type="button"
            class="flex aspect-square flex-col items-center justify-center gap-1 bg-surface transition"
            :class="[
              cell.inMonth ? 'text-slate-800' : 'bg-surface-2/70 text-slate-400',
              cell.key === selectedDay ? 'bg-brand-500/10 ring-2 ring-inset ring-brand-500' : 'hover:bg-surface-2',
            ]"
            :aria-pressed="cell.key === selectedDay"
            :aria-label="`${formatDayHeading(`${cell.key}T12:00:00`)}${cell.sessions.length ? `, ${cell.sessions.length} ${cell.sessions.length === 1 ? 'sesión' : 'sesiones'}` : ''}`"
            @click="selectedDay = cell.key"
          >
            <span class="flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold tabular-nums" :class="cell.isToday ? 'bg-brand-500 text-white' : ''">{{ cell.day }}</span>
            <span class="flex h-1.5 items-center gap-0.5">
              <span v-for="session in cell.sessions.slice(0, 3)" :key="session.id" class="h-1.5 w-1.5 rounded-full" :class="dotClass[session.kind]"></span>
            </span>
          </button>
        </div>
      </div>

      <div v-if="selected" class="mt-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-slate-900">{{ selected.isToday ? 'Hoy' : formatDayHeading(`${selected.key}T12:00:00`) }}</h3>
          <button v-if="canPlan" type="button" class="btn-ghost px-2 py-1 text-xs text-brand-500" @click="emit('plan', selected.key)"><Icon icon="plus" class="mr-1 h-3 w-3" />Entrenamiento este día</button>
        </div>
        <p v-if="selected.sessions.length === 0" class="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-slate-500">Nada preparado este día.</p>
        <ul v-else class="space-y-2">
          <li v-for="session in selected.sessions" :key="session.id">
            <button
              type="button"
              class="card w-full border-l-4 p-3 text-left transition hover:border-brand-400/60 sm:p-3"
              :class="[kindClass[session.kind].split(' ')[0], session.id === selectedId ? 'ring-2 ring-brand-400' : '']"
              @click="emit('select', session)"
            >
              <p class="flex flex-wrap items-center gap-2">
                <span class="text-base font-semibold tabular-nums text-slate-900">{{ formatTime(session.startsAt) }}</span>
                <span class="min-w-0 flex-1 truncate font-medium text-slate-900">{{ session.title }}</span>
              </p>
              <p class="mt-0.5 text-xs text-slate-500">
                {{ session.kindLabel }} · {{ formatDurationMinutes(session.durationMinutes) }}
                <template v-if="session.location"> · {{ session.location }}</template>
              </p>
              <p class="mt-1.5 flex flex-wrap gap-1 text-xs">
                <Badge tone="slate">{{ session.itemsCount }} ejercicios</Badge>
                <Badge v-if="session.counts.willMiss" tone="amber">{{ session.counts.willMiss }} faltan</Badge>
                <Badge v-if="session.started && session.counts.attended" tone="green">{{ session.counts.attended }} vinieron</Badge>
                <Badge v-if="session.mine?.status === 'WillMiss'" tone="amber">Has avisado</Badge>
              </p>
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
