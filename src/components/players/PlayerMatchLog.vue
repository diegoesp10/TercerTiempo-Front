<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import { useSort } from '@/composables/useSort';
import type { MatchOutcome, PlayerMatchPointDto, Position } from '@/types/api';
import { formatDate, outcomeLabels, outcomeTone, type Outcome } from '@/utils/format';
import { keyColumnsFor, keyTotals, type KeyStat, type KeyTotals } from '@/utils/keyStats';
import TeamName from '@/components/teams/TeamName.vue';

/**
 * Partido a partido de un jugador: la línea del acta interna si el cuerpo técnico la registró y, si no, la del acta
 * pública de la federación. Indica de cuál sale cada fila, lleva el dato de su puesto (paradas, despejes, pases...) y se
 * ordena por cualquier columna.
 */
const toOutcome = (o: MatchOutcome): Outcome => (o === 'Win' ? 'win' : o === 'Draw' ? 'draw' : o === 'Loss' ? 'loss' : null);

const props = defineProps<{ matches: PlayerMatchPointDto[]; squadId: string; position?: Position | null }>();

interface Row {
  point: PlayerMatchPointDto;
  source: 'internal' | 'official' | null;
  minutes: number;
  started: boolean;
  goals: number;
  assists: number | null;
  yellow: number;
  red: boolean;
  fouls: number | null;
  rating: number | null;
  /** Lo del acta interna para el dato del puesto; null sin ella. */
  stats: KeyTotals | null;
}

const rows = computed<Row[]>(() =>
  [...props.matches]
    .filter((m) => m.match.status === 'Played')
    .reverse()
    .map((m) => {
      const p = m.performance;
      if (p && p.minutesPlayed > 0)
        return { point: m, source: 'internal', minutes: p.minutesPlayed, started: p.started, goals: p.goals, assists: p.assists, yellow: p.yellowCards, red: p.redCard, fouls: p.fouls ?? 0, rating: p.rating, stats: keyTotals(p) };
      const o = m.official;
      if (o && o.played)
        return { point: m, source: 'official', minutes: o.minutesPlayed, started: o.started, goals: o.goals + o.penaltyGoals, assists: null, yellow: o.yellowCards, red: o.redCard, fouls: null, rating: null, stats: null };
      return { point: m, source: null, minutes: 0, started: false, goals: 0, assists: null, yellow: 0, red: false, fouls: null, rating: null, stats: null };
    }),
);

const columns = computed(() => {
  const { stats, withAssists } = keyColumnsFor(props.position);
  return { stats: stats.map((stat) => ({ stat, sortKey: `key-${stat.key}` as const })), withAssists };
});

type SortKey = 'match' | 'result' | 'minutes' | 'goals' | 'assists' | 'cards' | 'fouls' | 'rating' | 'source' | `key-${KeyStat['key']}`;
const getters = computed(() => {
  const played = (r: Row, value: number | null) => (r.source ? value : null);
  const base: Partial<Record<SortKey, (row: Row) => number | string | null>> = {
    match: (r) => r.point.match.matchday,
    result: (r) =>
      r.point.goalsFor === null || r.point.goalsAgainst === null
        ? null
        : (r.point.outcome === 'Win' ? 3 : r.point.outcome === 'Draw' ? 1 : 0) * 100 + r.point.goalsFor - r.point.goalsAgainst,
    minutes: (r) => played(r, r.minutes),
    goals: (r) => played(r, r.goals),
    assists: (r) => r.assists,
    // La roja pesa más que cualquier número de amarillas.
    cards: (r) => played(r, (r.red ? 10 : 0) + r.yellow),
    fouls: (r) => r.fouls,
    rating: (r) => r.rating,
    source: (r) => (r.source === 'internal' ? 'Acta interna' : r.source === 'official' ? 'Acta oficial' : null),
  };
  for (const { stat, sortKey } of columns.value.stats) base[sortKey] = (r) => (r.stats ? stat.sort(r.stats) : null);
  return base as Record<SortKey, (row: Row) => number | string | null>;
});
const { sorted, sortBy, state } = useSort<Row, SortKey>(rows, getters, 'match', { ascendingFirst: ['source'] });
</script>

<template>
  <section class="card">
    <h2 class="font-semibold text-slate-900">Partido a partido</h2>
    <p class="text-xs text-slate-500">
      Acta interna del cuerpo técnico cuando existe; si no, el acta pública de la federación (sin asistencias, faltas, nota ni el dato de su puesto). Pulsa en
      una columna para ordenar por ella.
    </p>
    <p v-if="rows.length === 0" class="mt-3 text-sm text-slate-500">El equipo todavía no ha jugado ningún partido esta temporada.</p>
    <div v-else class="mt-3 overflow-x-auto">
      <table class="table-sticky min-w-full text-sm">
        <thead class="text-xs text-slate-500">
          <tr>
            <SortHeader class="py-2 pr-3 text-left" label="Partido" title="Jornada" v-bind="state('match')" @sort="sortBy('match')" />
            <SortHeader class="col-sm px-2 py-2 text-center" label="Resultado" v-bind="state('result')" @sort="sortBy('result')" />
            <SortHeader class="px-2 py-2 text-center" label="Min" title="Minutos" v-bind="state('minutes')" @sort="sortBy('minutes')" />
            <SortHeader class="px-2 py-2 text-center" label="G" title="Goles" v-bind="state('goals')" @sort="sortBy('goals')" />
            <SortHeader
              v-for="{ stat, sortKey } in columns.stats"
              :key="stat.key"
              class="px-2 py-2 text-center"
              :label="stat.short"
              :title="stat.title"
              v-bind="state(sortKey)"
              @sort="sortBy(sortKey)"
            />
            <SortHeader v-if="columns.withAssists" class="col-sm px-2 py-2 text-center" label="A" title="Asistencias de gol" v-bind="state('assists')" @sort="sortBy('assists')" />
            <SortHeader class="px-2 py-2 text-center" label="Tarjetas" title="Tarjetas (la roja pesa más)" v-bind="state('cards')" @sort="sortBy('cards')" />
            <SortHeader class="col-md px-2 py-2 text-center" label="Faltas" title="Faltas cometidas" v-bind="state('fouls')" @sort="sortBy('fouls')" />
            <SortHeader class="col-sm px-2 py-2 text-center" label="Nota" v-bind="state('rating')" @sort="sortBy('rating')" />
            <SortHeader class="col-md px-2 py-2 text-right" label="Fuente" v-bind="state('source')" @sort="sortBy('source')" />
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="r in sorted" :key="r.point.match.id" :class="r.source ? '' : 'text-slate-400'">
            <td class="py-2 pr-3">
              <RouterLink :to="{ name: 'sheet', params: { squadId, matchId: r.point.match.id } }" class="font-medium hover:text-brand-500 hover:underline" :class="r.source ? 'text-slate-900' : ''">
                J{{ r.point.match.matchday }} ·
                <TeamName
                  :prefix="r.point.home ? 'vs' : 'en'"
                  :name="r.point.opponentName"
                  :crest-url="(r.point.home ? r.point.match.awayTeam : r.point.match.homeTeam).crestUrl"
                />
              </RouterLink>
              <p class="text-xs text-slate-400">{{ formatDate(r.point.match.kickoffAt) }}<template v-if="r.source && r.started"> · titular</template><template v-else-if="r.source"> · suplente</template><template v-else> · no jugó</template></p>
            </td>
            <td class="col-sm px-2 py-2 text-center whitespace-nowrap tabular-nums">
              {{ r.point.goalsFor ?? '—' }}-{{ r.point.goalsAgainst ?? '—' }}
              <Badge v-if="toOutcome(r.point.outcome)" :tone="outcomeTone(toOutcome(r.point.outcome))" class="ml-1">{{ outcomeLabels[toOutcome(r.point.outcome)!] }}</Badge>
            </td>
            <td class="px-2 py-2 text-center tabular-nums">{{ r.source ? `${r.minutes}'` : '—' }}</td>
            <td class="px-2 py-2 text-center font-semibold tabular-nums">{{ r.source ? r.goals : '—' }}</td>
            <td v-for="{ stat } in columns.stats" :key="stat.key" class="px-2 py-2 text-center whitespace-nowrap tabular-nums">{{ r.stats ? stat.value(r.stats) : '—' }}</td>
            <td v-if="columns.withAssists" class="col-sm px-2 py-2 text-center tabular-nums">{{ r.assists ?? '—' }}</td>
            <td class="px-2 py-2 text-center"><CardMarks v-if="r.source" :yellow-cards="r.yellow" :red-card="r.red" /></td>
            <td class="col-md px-2 py-2 text-center tabular-nums">{{ r.fouls ?? '—' }}</td>
            <td class="col-sm px-2 py-2 text-center"><RatingBadge v-if="r.source === 'internal'" :rating="r.rating" size="sm" /><span v-else class="text-slate-400">—</span></td>
            <td class="col-md px-2 py-2 text-right text-xs text-slate-500">{{ r.source === 'internal' ? 'Acta interna' : r.source === 'official' ? 'Acta oficial' : '' }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
