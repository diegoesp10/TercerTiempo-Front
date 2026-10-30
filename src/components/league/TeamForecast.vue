<script setup lang="ts">
import { computed } from 'vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { metricColors, percent, type PredictionMetric } from '@/charts/predictions';
import type { LeagueZonesDto, TeamPredictionDto } from '@/types/api';
import { zoneRanges } from '@/utils/zones';

/**
 * La previsión de tu equipo, arriba y en grande: sus probabilidades de ganar la liga, ascender y descender dichas en
 * palabras, en cuántas simulaciones de cada 10 pasa cada cosa, en qué plaza de la liga puede acabar (sumando sus puestos)
 * y la probabilidad de cada puesto final.
 */
const props = defineProps<{
  team: TeamPredictionDto;
  zones: LeagueZonesDto;
  labels: Record<PredictionMetric, string>;
  /** «Tu club» o «Tu equipo». */
  title: string;
}>();

// Los puestos sin plaza en la liga (ni de ascenso, ni de promoción, ni de descenso).
const NEUTRAL = 'var(--t-slate-300)';
const MIDDLE = 'Mitad de la tabla';

interface Outcome { label: string; color: string; from: number; to: number; probability: number }

const odds = computed(() => props.team.positionOdds);
const chance = (from: number, to: number) => odds.value.slice(from - 1, to).reduce((sum, value) => sum + value, 0);

/** Lo que puede pasar al final, de arriba abajo de la tabla: las plazas de la liga y los puestos que quedan entre ellas. */
const outcomes = computed<Outcome[]>(() => {
  const total = props.zones.teams || odds.value.length;
  const published = zoneRanges(props.zones.places);
  const ranges = published.length
    ? published
    : [
        ...(props.zones.promotion.length
          ? [{ label: props.labels.promotion, color: metricColors.promotion, from: Math.min(...props.zones.promotion), to: Math.max(...props.zones.promotion) }]
          : []),
        ...(props.zones.relegation.length
          ? [{ label: props.labels.relegation, color: metricColors.relegation, from: Math.min(...props.zones.relegation), to: Math.max(...props.zones.relegation) }]
          : []),
      ];
  const result: Outcome[] = [];
  let next = 1;
  for (const range of ranges) {
    if (range.from > next) result.push({ label: MIDDLE, color: NEUTRAL, from: next, to: range.from - 1, probability: chance(next, range.from - 1) });
    result.push({ ...range, probability: chance(range.from, range.to) });
    next = range.to + 1;
  }
  if (next <= total) result.push({ label: MIDDLE, color: NEUTRAL, from: next, to: total, probability: chance(next, total) });
  return result;
});

const headline = computed(() => [
  { key: 'champion', label: 'Ganar la liga', icon: 'trophy', color: metricColors.champion, value: props.team.champion },
  { key: 'promotion', label: props.labels.promotion, icon: 'arrow-trend-up', color: metricColors.promotion, value: props.team.promotion },
  ...(props.zones.relegation.length
    ? [{ key: 'relegation', label: 'Descender', icon: 'arrow-trend-down', color: metricColors.relegation, value: props.team.relegation }]
    : []),
]);

const zoneColor = (position: number) => outcomes.value.find((o) => position >= o.from && position <= o.to)?.color ?? NEUTRAL;
const mostLikely = computed(() => odds.value.reduce((best, value, index) => (value > odds.value[best]! ? index : best), 0) + 1);
const highestOdds = computed(() => Math.max(...odds.value, 0.0001));

/** Puestos entre los que acaba 8 de cada 10 veces (sin el 10 % de arriba ni el 10 % de abajo). */
const likelyRange = computed(() => {
  let cumulative = 0;
  let low = 1;
  let high = odds.value.length;
  let lowFound = false;
  for (const [index, value] of odds.value.entries()) {
    cumulative += value;
    if (!lowFound && cumulative >= 0.1) { low = index + 1; lowFound = true; }
    if (cumulative >= 0.9) { high = index + 1; break; }
  }
  return { low, high };
});

function verdict(value: number) {
  if (value >= 0.9) return 'Casi seguro';
  if (value >= 0.7) return 'Muy probable';
  if (value >= 0.5) return 'Probable';
  if (value >= 0.3) return 'Posible';
  if (value >= 0.1) return 'Poco probable';
  if (value >= 0.01) return 'Difícil';
  return 'Casi imposible';
}

function frequency(value: number) {
  if (value >= 0.995) return 'En casi todas las simulaciones';
  if (value >= 0.1) return `En ${Math.round(value * 10)} de cada 10 simulaciones`;
  if (value >= 0.001) return `En 1 de cada ${Math.round(1 / value).toLocaleString('es-ES')} simulaciones`;
  return 'En casi ninguna simulación';
}

const span = (o: Outcome) => (o.from === o.to ? `${o.from}.º` : `${o.from}.º–${o.to}.º`);
const num = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
</script>

<template>
  <section class="card border-brand-500/50" :aria-label="`${title}: previsión de ${team.teamName}`">
    <div class="flex items-center gap-3">
      <TeamCrest :src="team.crestUrl" :name="team.teamName" :short-name="team.shortName" size="lg" />
      <div class="min-w-0 flex-1">
        <p class="eyebrow flex items-center gap-1.5"><Icon icon="shield-halved" class="h-3 w-3" />{{ title }} · tu previsión</p>
        <h3 class="truncate text-lg font-bold text-slate-900">{{ team.teamName }}</h3>
        <p class="text-xs text-slate-500">
          Ahora {{ team.position }}.º con {{ team.points }} pts · acabaría {{ num(team.expectedPosition) }}.º con unos {{ num(team.expectedPoints) }} pts
        </p>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-1 gap-3" :class="headline.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'">
      <div
        v-for="item in headline"
        :key="item.key"
        class="rounded-xl border-l-[3px] bg-surface-2 p-3 sm:border-l-0 sm:border-t-[3px]"
        :style="{ borderColor: item.color }"
      >
        <div class="flex items-start justify-between gap-3 sm:block">
          <div class="min-w-0">
            <p class="text-xs font-semibold uppercase tracking-wide" :style="{ color: item.color }">
              <Icon :icon="item.icon" class="mr-1 h-3 w-3" />{{ item.label }}
            </p>
            <p class="mt-0.5 text-sm font-semibold text-slate-800">{{ verdict(item.value) }}</p>
          </div>
          <p class="shrink-0 font-figures text-3xl font-extrabold text-slate-900 sm:mt-1">{{ percent(item.value) }}</p>
        </div>
        <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
          <div class="h-full rounded-full" :style="{ width: `${item.value > 0 ? Math.max(item.value * 100, 2) : 0}%`, background: item.color }" />
        </div>
        <p class="mt-1.5 text-[11px] text-slate-500">{{ frequency(item.value) }}</p>
      </div>
    </div>

    <div class="mt-5 grid gap-5 lg:grid-cols-2">
      <div>
        <h4 class="text-sm font-semibold text-slate-900">En qué plaza puede acabar</h4>
        <div class="mt-2 flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" :aria-label="outcomes.map((o) => `${o.label}: ${percent(o.probability)}`).join(', ')">
          <div
            v-for="outcome in outcomes"
            :key="`${outcome.label}-${outcome.from}`"
            class="h-full first:rounded-l-full last:rounded-r-full"
            :style="{ width: `${outcome.probability * 100}%`, background: outcome.color }"
            :title="`${outcome.label}: ${percent(outcome.probability)}`"
          />
        </div>
        <ul class="mt-3 space-y-1.5">
          <li v-for="outcome in outcomes" :key="`${outcome.label}-${outcome.from}`" class="flex items-center gap-2 text-sm">
            <span class="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" :style="{ background: outcome.color }" />
            <span class="min-w-0 flex-1 text-slate-700">{{ outcome.label }} <span class="text-xs text-slate-500">({{ span(outcome) }})</span></span>
            <span class="font-figures font-semibold text-slate-900">{{ percent(outcome.probability) }}</span>
          </li>
        </ul>
      </div>

      <div>
        <div class="flex flex-wrap items-baseline justify-between gap-x-3">
          <h4 class="text-sm font-semibold text-slate-900">Puesto final</h4>
          <p class="text-xs text-slate-500">Lo más probable: <b class="text-slate-800">{{ mostLikely }}.º</b> ({{ percent(odds[mostLikely - 1] ?? 0) }})</p>
        </div>
        <div class="mt-2 flex h-20 items-end gap-[2px]" role="img" :aria-label="`Probabilidad de cada puesto final de ${team.teamName}`">
          <div
            v-for="(value, index) in odds"
            :key="index"
            class="flex-1 rounded-t-sm"
            :class="index + 1 === mostLikely ? '' : 'opacity-75'"
            :style="{ height: `${value > 0 ? Math.max((value / highestOdds) * 100, 3) : 0}%`, background: zoneColor(index + 1) }"
            :title="`${index + 1}.º: ${percent(value)}`"
          />
        </div>
        <div class="mt-1 flex gap-[2px] text-center font-figures text-[9px] leading-none text-slate-500">
          <span v-for="(_, index) in odds" :key="index" class="flex-1" :class="{ 'font-bold text-slate-900': index + 1 === mostLikely }">{{ index + 1 }}</span>
        </div>
        <p class="mt-2 text-xs text-slate-500">
          En 8 de cada 10 simulaciones acaba entre el <b class="text-slate-700">{{ likelyRange.low }}.º</b> y el <b class="text-slate-700">{{ likelyRange.high }}.º</b>.
        </p>
      </div>
    </div>
  </section>
</template>
