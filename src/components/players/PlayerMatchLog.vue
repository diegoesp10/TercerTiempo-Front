<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import type { PlayerMatchPointDto } from '@/types/api';
import { formatDate, outcomeLabels, outcomeTone, type Outcome } from '@/utils/format';
import type { MatchOutcome } from '@/types/api';

/**
 * Partido a partido de un jugador: la línea del acta interna si el cuerpo técnico la registró y, si no, la del acta
 * pública (federación o BeSoccer). Indica de cuál sale cada fila.
 */
const toOutcome = (o: MatchOutcome): Outcome => (o === 'Win' ? 'win' : o === 'Draw' ? 'draw' : o === 'Loss' ? 'loss' : null);

const props = defineProps<{ matches: PlayerMatchPointDto[]; squadId: string }>();

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
}

const rows = computed<Row[]>(() =>
  [...props.matches]
    .filter((m) => m.match.status === 'Played')
    .reverse()
    .map((m) => {
      const p = m.performance;
      if (p && p.minutesPlayed > 0)
        return { point: m, source: 'internal', minutes: p.minutesPlayed, started: p.started, goals: p.goals, assists: p.assists, yellow: p.yellowCards, red: p.redCard, fouls: p.fouls ?? 0, rating: p.rating };
      const o = m.official;
      if (o && o.played)
        return { point: m, source: 'official', minutes: o.minutesPlayed, started: o.started, goals: o.goals + o.penaltyGoals, assists: null, yellow: o.yellowCards, red: o.redCard, fouls: null, rating: null };
      return { point: m, source: null, minutes: 0, started: false, goals: 0, assists: null, yellow: 0, red: false, fouls: null, rating: null };
    }),
);
</script>

<template>
  <section class="card">
    <h2 class="font-semibold text-slate-900">Partido a partido</h2>
    <p class="text-xs text-slate-500">Acta interna del cuerpo técnico cuando existe; si no, el acta pública de la federación (sin asistencias, faltas ni nota).</p>
    <p v-if="rows.length === 0" class="mt-3 text-sm text-slate-500">El equipo todavía no ha jugado ningún partido esta temporada.</p>
    <div v-else class="mt-3 overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="py-2 pr-3 text-left">Partido</th>
            <th class="col-sm px-2 py-2 text-center">Resultado</th>
            <th class="px-2 py-2 text-center">Min</th>
            <th class="px-2 py-2 text-center">G</th>
            <th class="col-sm px-2 py-2 text-center">A</th>
            <th class="px-2 py-2 text-center">Tarjetas</th>
            <th class="col-md px-2 py-2 text-center">Faltas</th>
            <th class="col-sm px-2 py-2 text-center">Nota</th>
            <th class="col-md px-2 py-2 text-right">Fuente</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          <tr v-for="r in rows" :key="r.point.match.id" :class="r.source ? '' : 'text-slate-400'">
            <td class="py-2 pr-3">
              <RouterLink :to="{ name: 'sheet', params: { squadId, matchId: r.point.match.id } }" class="font-medium hover:text-brand-500 hover:underline" :class="r.source ? 'text-slate-900' : ''">
                J{{ r.point.match.matchday }} · {{ r.point.home ? 'vs' : 'en' }} {{ r.point.opponentName }}
              </RouterLink>
              <p class="text-xs text-slate-400">{{ formatDate(r.point.match.kickoffAt) }}<template v-if="r.source && r.started"> · titular</template><template v-else-if="r.source"> · suplente</template><template v-else> · no jugó</template></p>
            </td>
            <td class="col-sm px-2 py-2 text-center whitespace-nowrap tabular-nums">
              {{ r.point.goalsFor ?? '—' }}-{{ r.point.goalsAgainst ?? '—' }}
              <Badge v-if="toOutcome(r.point.outcome)" :tone="outcomeTone(toOutcome(r.point.outcome))" class="ml-1">{{ outcomeLabels[toOutcome(r.point.outcome)!] }}</Badge>
            </td>
            <td class="px-2 py-2 text-center tabular-nums">{{ r.source ? `${r.minutes}'` : '—' }}</td>
            <td class="px-2 py-2 text-center font-semibold tabular-nums">{{ r.source ? r.goals : '—' }}</td>
            <td class="col-sm px-2 py-2 text-center tabular-nums">{{ r.assists ?? '—' }}</td>
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
