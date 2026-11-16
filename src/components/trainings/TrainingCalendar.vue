<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import TeamName from '@/components/teams/TeamName.vue';
import type { MatchDto, SquadAgendaItemDto, TrainingSummaryDto } from '@/types/api';
import { opponentOf } from '@/utils/crests';
import { formatDayHeading, formatDurationMinutes, formatTime, toDateKey } from '@/utils/format';

/**
 * Calendario mensual de la plantilla: una casilla por día (semanas de lunes a domingo) con sus entrenamientos y sus
 * partidos. El padre carga la agenda del rango visible y decide qué pasa al pulsar un día, una sesión o un partido.
 *
 * Los partidos van rellenos y con balón; los entrenamientos, con borde del color de su tipo. Lo ya realizado se atenúa
 * y lleva un check, para distinguirlo de un vistazo de lo pendiente.
 *
 * En pantallas anchas cada casilla lista lo suyo; en el móvil la rejilla es compacta (un punto por elemento) y el día
 * elegido se lee entero debajo.
 */
const props = withDefaults(
  defineProps<{
    /** Primer día del mes que se muestra (YYYY-MM-DD). */
    month: string;
    items: SquadAgendaItemDto[];
    /** Equipo de la plantilla, para saber quién es el rival. */
    teamId: string;
    canPlan?: boolean;
    selectedId?: string | null;
  }>(),
  { canPlan: false, selectedId: null },
);
const emit = defineEmits<{ select: [session: TrainingSummaryDto]; match: [match: MatchDto]; plan: [dateKey: string] }>();

const weekdayHeaders = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const todayKey = toDateKey(new Date());

const monthDate = computed(() => new Date(`${props.month}T00:00:00`));

interface Cell {
  key: string;
  day: number;
  inMonth: boolean;
  isToday: boolean;
  items: SquadAgendaItemDto[];
}

const itemKey = (item: SquadAgendaItemDto) => (item.kind === 'Match' ? `m:${item.match!.id}` : `t:${item.training!.id}`);

/** Del lunes de la semana del día 1 al domingo de la semana del último día. */
const days = computed<Cell[]>(() => {
  const first = monthDate.value;
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7));
  const byDay = new Map<string, SquadAgendaItemDto[]>();
  for (const item of props.items) {
    const key = toDateKey(new Date(item.startsAt));
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }
  const cells: Cell[] = [];
  for (let i = 0; i < 42; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const key = toDateKey(date);
    cells.push({ key, day: date.getDate(), inMonth: date.getMonth() === first.getMonth(), isToday: key === todayKey, items: byDay.get(key) ?? [] });
  }
  // Si la última fila es toda del mes siguiente se quita (meses de cinco semanas).
  return cells.slice(35).every((c) => !c.inMonth) ? cells.slice(0, 35) : cells;
});

// En el móvil se elige un día: hoy si está en el mes a la vista; si no, el primer día del mes con algo (o el 1).
const selectedDay = ref<string>(todayKey);
watch(
  () => [props.month, props.items] as const,
  () => {
    const cells = days.value;
    if (cells.some((c) => c.key === selectedDay.value && c.inMonth)) return;
    const today = cells.find((c) => c.isToday && c.inMonth);
    const firstWithItems = cells.find((c) => c.inMonth && c.items.length > 0);
    selectedDay.value = (today ?? firstWithItems ?? cells.find((c) => c.inMonth) ?? cells[0]!).key;
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

// Lo realizado pierde el color: borde discontinuo, fondo apagado y texto gris, con su check delante.
const doneClass = 'border-dashed border-slate-300 bg-surface-2/70 text-slate-500';
const matchClass = 'border-brand-500 bg-brand-500 text-white shadow-sm';
const matchDoneClass = 'border-dashed border-brand-500/40 bg-brand-500/10 text-slate-500';

function chipClass(item: SquadAgendaItemDto) {
  if (item.kind === 'Match') return item.done ? matchDoneClass : matchClass;
  return item.done ? doneClass : kindClass[item.training!.kind];
}

const rival = (match: MatchDto) => opponentOf(match, props.teamId);
const score = (match: MatchDto) => (match.homeGoals !== null && match.awayGoals !== null ? `${match.homeGoals}-${match.awayGoals}` : null);

function open(item: SquadAgendaItemDto) {
  if (item.kind === 'Match') emit('match', item.match!);
  else emit('select', item.training!);
}

function title(item: SquadAgendaItemDto) {
  const state = item.done ? ' · ya realizado' : '';
  if (item.kind === 'Match') return `J${item.match!.matchday} vs ${rival(item.match!).name} · ${formatTime(item.startsAt)}${state}`;
  return `${item.training!.title} · ${formatTime(item.startsAt)}${state}`;
}

function countLabel(cell: Cell) {
  const matches = cell.items.filter((i) => i.kind === 'Match').length;
  const sessions = cell.items.length - matches;
  const parts = [];
  if (sessions) parts.push(`${sessions} ${sessions === 1 ? 'entrenamiento' : 'entrenamientos'}`);
  if (matches) parts.push(`${matches} ${matches === 1 ? 'partido' : 'partidos'}`);
  return parts.length ? `, ${parts.join(' y ')}` : '';
}
</script>

<template>
  <div>
    <!-- Pantallas anchas: cada día con sus entrenamientos y partidos -->
    <div class="hidden overflow-hidden rounded-xl border border-line bg-surface sm:block">
      <div class="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <div v-for="h in weekdayHeaders" :key="h" class="py-1.5">{{ h }}</div>
      </div>
      <div class="grid grid-cols-7">
        <div
          v-for="cell in days"
          :key="cell.key"
          class="min-h-[6rem] min-w-0 border-b border-r border-line p-1.5"
          :class="[cell.inMonth ? '' : 'bg-surface-2/60 text-slate-400', cell.isToday ? 'bg-brand-500/5' : '']"
        >
          <div class="mb-1 flex items-center justify-between">
            <span class="text-xs font-semibold" :class="cell.isToday ? 'rounded-full bg-brand-500 px-1.5 text-white' : cell.inMonth ? 'text-slate-700' : ''">{{ cell.day }}</span>
            <button v-if="canPlan && cell.inMonth" type="button" class="btn-ghost -mr-1 px-1 py-0 text-slate-400 hover:text-brand-500" :aria-label="`Nuevo entrenamiento el día ${cell.day}`" @click="emit('plan', cell.key)">
              <Icon icon="plus" class="h-3 w-3" />
            </button>
          </div>
          <ul class="space-y-1">
            <li v-for="item in cell.items" :key="itemKey(item)">
              <button
                type="button"
                class="flex w-full min-w-0 items-center gap-1 rounded border px-1 py-0.5 text-left text-xs font-medium leading-tight transition hover:brightness-110"
                :class="[chipClass(item), item.kind === 'Training' && item.training!.id === selectedId ? 'ring-2 ring-brand-400' : '']"
                :title="title(item)"
                @click="open(item)"
              >
                <Icon v-if="item.done" icon="check" class="h-2.5 w-2.5 shrink-0" aria-label="Realizado" />
                <Icon v-else-if="item.kind === 'Match'" icon="futbol" class="h-2.5 w-2.5 shrink-0" />
                <span class="shrink-0 tabular-nums">{{ formatTime(item.startsAt) }}</span>
                <template v-if="item.kind === 'Match'">
                  <span class="shrink-0 font-semibold">J{{ item.match!.matchday }}</span>
                  <TeamName class="min-w-0" :name="rival(item.match!).name" :crest-url="rival(item.match!).crestUrl" :short-name="rival(item.match!).shortName" />
                  <span v-if="item.done && score(item.match!)" class="ml-auto shrink-0 tabular-nums">{{ score(item.match!) }}</span>
                </template>
                <template v-else>
                  <span class="truncate">{{ item.training!.title }}</span>
                  <span v-if="item.training!.mine?.status === 'WillMiss'" class="ml-0.5 text-amber-600" title="Has avisado de que faltas">·</span>
                </template>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Móvil: rejilla compacta con un punto por elemento y el día elegido entero debajo -->
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
            :aria-label="`${formatDayHeading(`${cell.key}T12:00:00`)}${countLabel(cell)}`"
            @click="selectedDay = cell.key"
          >
            <span class="flex h-6 w-6 items-center justify-center rounded-full text-sm font-semibold tabular-nums" :class="cell.isToday ? 'bg-brand-500 text-white' : ''">{{ cell.day }}</span>
            <span class="flex h-2 items-center gap-0.5">
              <span
                v-for="item in cell.items.slice(0, 3)"
                :key="itemKey(item)"
                :class="[
                  item.kind === 'Match' ? 'h-2 w-2 rounded-sm bg-white ring-2 ring-brand-500' : `h-1.5 w-1.5 rounded-full ${dotClass[item.training!.kind]}`,
                  item.done ? 'opacity-35' : '',
                ]"
              ></span>
            </span>
          </button>
        </div>
      </div>

      <div v-if="selected" class="mt-3">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h3 class="text-sm font-semibold text-slate-900">{{ selected.isToday ? 'Hoy' : formatDayHeading(`${selected.key}T12:00:00`) }}</h3>
          <button v-if="canPlan" type="button" class="btn-ghost px-2 py-1 text-xs text-brand-500" @click="emit('plan', selected.key)"><Icon icon="plus" class="mr-1 h-3 w-3" />Entrenamiento este día</button>
        </div>
        <p v-if="selected.items.length === 0" class="rounded-lg border border-dashed border-line px-3 py-4 text-center text-sm text-slate-500">Nada preparado este día.</p>
        <ul v-else class="space-y-2">
          <li v-for="item in selected.items" :key="itemKey(item)">
            <button
              v-if="item.kind === 'Match'"
              type="button"
              class="card w-full border-l-4 p-3 text-left transition hover:border-brand-400/60 sm:p-3"
              :class="item.done ? 'border-l-brand-500/30 opacity-70' : 'border-l-brand-500'"
              @click="open(item)"
            >
              <p class="flex flex-wrap items-center gap-2">
                <span class="text-base font-semibold tabular-nums text-slate-900">{{ formatTime(item.startsAt) }}</span>
                <span class="min-w-0 flex-1 truncate font-medium text-slate-900">
                  J{{ item.match!.matchday }} · <TeamName prefix="vs" :name="rival(item.match!).name" :crest-url="rival(item.match!).crestUrl" :short-name="rival(item.match!).shortName" />
                </span>
              </p>
              <p class="mt-0.5 text-xs text-slate-500">Partido<template v-if="item.match!.venue"> · {{ item.match!.venue }}</template></p>
              <p class="mt-1.5 flex flex-wrap gap-1 text-xs">
                <Badge v-if="item.done" tone="slate"><Icon icon="check" class="mr-1 h-2.5 w-2.5" />Ya realizado<template v-if="score(item.match!)"> · {{ score(item.match!) }}</template></Badge>
                <Badge v-else-if="item.callUp?.status === 'Published'" tone="green">Convocatoria publicada</Badge>
                <Badge v-else-if="item.callUp" tone="amber">Convocatoria en borrador</Badge>
                <Badge v-else tone="slate">Sin convocatoria</Badge>
              </p>
            </button>
            <button
              v-else
              type="button"
              class="card w-full border-l-4 p-3 text-left transition hover:border-brand-400/60 sm:p-3"
              :class="[item.done ? 'border-l-slate-300 opacity-70' : kindClass[item.training!.kind].split(' ')[0], item.training!.id === selectedId ? 'ring-2 ring-brand-400' : '']"
              @click="open(item)"
            >
              <p class="flex flex-wrap items-center gap-2">
                <span class="text-base font-semibold tabular-nums text-slate-900">{{ formatTime(item.startsAt) }}</span>
                <span class="min-w-0 flex-1 truncate font-medium text-slate-900">{{ item.training!.title }}</span>
              </p>
              <p class="mt-0.5 text-xs text-slate-500">
                {{ item.training!.kindLabel }} · {{ formatDurationMinutes(item.training!.durationMinutes) }}
                <template v-if="item.training!.location"> · {{ item.training!.location }}</template>
              </p>
              <p class="mt-1.5 flex flex-wrap gap-1 text-xs">
                <Badge v-if="item.done" tone="slate"><Icon icon="check" class="mr-1 h-2.5 w-2.5" />Ya realizado</Badge>
                <Badge tone="slate">{{ item.training!.itemsCount }} ejercicios</Badge>
                <Badge v-if="!item.done && item.training!.counts.willMiss" tone="amber">{{ item.training!.counts.willMiss }} faltan</Badge>
                <Badge v-if="item.training!.started && item.training!.counts.attended" tone="green">{{ item.training!.counts.attended }} vinieron</Badge>
                <Badge v-if="item.training!.mine?.status === 'WillMiss'" tone="amber">Has avisado</Badge>
              </p>
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- Leyenda: qué es cada cosa y qué está ya hecho -->
    <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span class="inline-flex items-center gap-1.5"><span class="inline-flex h-3.5 w-5 items-center justify-center rounded border border-brand-500 bg-brand-500 text-white"><Icon icon="futbol" class="h-2 w-2" /></span>Partido (convocatoria)</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-3.5 w-5 rounded border border-brand-500/40 bg-brand-500/10"></span>Entrenamiento (citación)</span>
      <span class="inline-flex items-center gap-1.5"><span class="inline-flex h-3.5 w-5 items-center justify-center rounded border border-dashed border-slate-300 bg-surface-2/70 text-slate-500"><Icon icon="check" class="h-2 w-2" /></span>Ya realizado</span>
    </p>
  </div>
</template>
