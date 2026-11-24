<script setup lang="ts">
import { computed } from 'vue';
import { MIN_MINUTES_FOR_REFERENCE } from '@/charts/axes';
import type { SquadPlayerStatsDto } from '@/types/api';
import { formatNumber, formatPct } from '@/utils/format';
import { keyStatsFor, keyTotals } from '@/utils/keyStats';

/**
 * Lo primero que ve el jugador en las estadísticas de su plantilla: sus cifras, el puesto en que le dejan entre los
 * compañeros que han jugado y la media de la plantilla. La tabla de todos sigue debajo.
 */
const props = defineProps<{ me: SquadPlayerStatsDto; players: SquadPlayerStatsDto[] }>();

interface Metric {
  key: string;
  label: string;
  value: (r: SquadPlayerStatsDto) => number | null;
  format: (v: number) => string;
  /** Solo entran quienes llegan a estos minutos (la nota, con 90' o más, como en el ranking de nota). */
  minMinutes?: number;
}

const count = (v: number) => String(v);
const metrics = computed<Metric[]>(() => {
  const byPosition = keyStatsFor(props.me.player.position).map<Metric>((stat) => ({
    key: stat.key,
    label: stat.label,
    value: (r) => stat.sort(keyTotals(r.stats)),
    format: count,
  }));
  return [
    { key: 'minutes', label: 'Minutos', value: (r) => r.stats.minutes, format: count },
    { key: 'goals', label: 'Goles', value: (r) => r.stats.goals, format: count },
    ...(byPosition.some((m) => m.key === 'assists')
      ? []
      : [{ key: 'assists', label: 'Asistencias de gol', value: (r: SquadPlayerStatsDto) => r.stats.assists, format: count }]),
    ...byPosition,
    { key: 'rating', label: 'Nota media', value: (r) => r.stats.averageRating, format: (v) => formatNumber(v, 1), minMinutes: MIN_MINUTES_FOR_REFERENCE },
    { key: 'participation', label: 'Participación', value: (r) => r.impact.participationPct, format: (v) => formatPct(v) },
  ];
});

const tiles = computed(() =>
  metrics.value.map((metric) => {
    const pool = props.players.filter((r) => r.stats.minutes > 0 && r.stats.minutes >= (metric.minMinutes ?? 0) && metric.value(r) !== null);
    const mine = metric.value(props.me);
    const inPool = mine !== null && pool.some((r) => r.player.id === props.me.player.id);
    const values = pool.map((r) => metric.value(r) ?? 0);
    const average = values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
    return {
      key: metric.key,
      label: metric.label,
      value: mine === null ? '—' : metric.format(mine),
      // Puesto con empates compartidos: 1 + los que tienen más.
      rank: inPool ? 1 + pool.filter((r) => (metric.value(r) ?? 0) > mine!).length : null,
      of: pool.length,
      average: average === null ? null : metric.key === 'participation' ? formatPct(average) : formatNumber(average, 1),
      outOfRanking: !inPool && metric.minMinutes !== undefined ? `Con ${metric.minMinutes}' entras en este puesto` : null,
    };
  }),
);
</script>

<template>
  <section class="card">
    <div class="mb-3">
      <h2 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="user" class="h-4 w-4 text-accent-400" />Tú en la plantilla</h2>
      <p class="text-xs text-slate-500">Tus cifras, en qué puesto quedas entre los compañeros que han jugado y su media. Debajo, las de todos.</p>
    </div>
    <p v-if="me.stats.minutes === 0" class="text-sm text-slate-600">
      Aún no tienes minutos en las actas: en cuanto juegues, aquí verás en qué puesto quedas en cada cifra.
    </p>
    <!-- Columnas según el ancho real: de una en una si dos no dejan sitio a «Participación» entera; el rótulo parte línea
         entre palabras, nunca «…». -->
    <div v-else class="@container">
      <div class="grid grid-cols-1 gap-3 @[15rem]:grid-cols-2 @lg:grid-cols-3 @4xl:grid-cols-[repeat(auto-fit,minmax(9rem,1fr))]">
        <div v-for="tile in tiles" :key="tile.key" class="relative min-w-0 rounded-xl border border-line bg-surface px-3 pb-3 pt-2.5 shadow-card">
          <span v-if="tile.rank === 1" class="absolute inset-x-3 top-0 h-0.5 rounded-b bg-brand-500" aria-hidden="true" />
          <p class="break-words font-display text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 @lg:text-[11px] @lg:tracking-[0.1em]">{{ tile.label }}</p>
          <p class="mt-1 font-figures text-2xl font-extrabold leading-none tabular-nums text-slate-900">{{ tile.value }}</p>
          <p v-if="tile.rank !== null" class="mt-1.5 text-xs font-semibold" :class="tile.rank <= 3 ? 'text-brand-500' : 'text-slate-700'">{{ tile.rank }}.º de {{ tile.of }}</p>
          <p v-else-if="tile.outOfRanking" class="mt-1.5 text-xs text-slate-500">{{ tile.outOfRanking }}</p>
          <p v-if="tile.average !== null" class="text-xs text-slate-500">Media: {{ tile.average }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
