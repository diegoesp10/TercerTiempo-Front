<script setup lang="ts">
import { computed } from 'vue';
import { teamStatsApi } from '@/api/teamStats';
import Alert from '@/components/ui/Alert.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import type { MatchDto, TeamStatsAveragesDto } from '@/types/api';
import { formatNumber, formatPct } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';
import { opponentOf } from '@/utils/crests';

/**
 * Datos del equipo en la temporada que apunta el cuerpo técnico: medias por partido frente a los rivales y, salvo en
 * modo compacto (previa), la tabla partido a partido.
 */
const props = defineProps<{ squadId: string; teamId: string; compact?: boolean }>();

const { data, loading, error } = useAsync(() => teamStatsApi.season(props.squadId));

const averageRows: { label: string; mine: keyof TeamStatsAveragesDto; theirs: keyof TeamStatsAveragesDto; total?: boolean }[] = [
  { label: 'Córners', mine: 'cornersFor', theirs: 'cornersAgainst' },
  { label: 'Tiros', mine: 'shotsFor', theirs: 'shotsAgainst' },
  { label: 'Tiros a puerta', mine: 'shotsOnTargetFor', theirs: 'shotsOnTargetAgainst' },
  { label: 'Fueras de juego', mine: 'offsidesFor', theirs: 'offsidesAgainst' },
  { label: 'Faltas (cometidas / recibidas)', mine: 'foulsCommitted', theirs: 'foulsReceived' },
  { label: 'Goles a balón parado (total)', mine: 'setPieceGoalsFor', theirs: 'setPieceGoalsAgainst', total: true },
];

/** Ancho de la barra de cada lado, sobre la suma de ambos (nunca se desborda). */
const share = (mine: number, theirs: number) => (mine + theirs > 0 ? (mine / (mine + theirs)) * 100 : 50);

const venue = (match: MatchDto) => (match.homeTeam.id === props.teamId ? 'Casa' : 'Fuera');
const score = (match: MatchDto) => {
  if (match.homeGoals === null || match.awayGoals === null) return '—';
  return match.homeTeam.id === props.teamId ? `${match.homeGoals}-${match.awayGoals}` : `${match.awayGoals}-${match.homeGoals}`;
};

const averages = computed(() => data.value?.averages ?? null);
/** Redondeada antes de restar, para que la de tu equipo y la del rival sumen siempre 100. */
const possession = computed(() => (averages.value?.possessionPct == null ? null : Math.round(averages.value.possessionPct)));
</script>

<template>
  <section class="card">
    <div class="mb-3">
      <h2 class="font-semibold text-slate-900">Datos del equipo</h2>
      <p class="text-xs text-slate-500">
        Media por partido de lo que apunta el cuerpo técnico en cada acta interna<template v-if="data"> · {{ data.matchesRecorded }} {{ data.matchesRecorded === 1 ? 'partido' : 'partidos' }} con datos</template>.
      </p>
    </div>

    <Spinner v-if="loading && !data" />
    <Alert v-else-if="error" kind="error">{{ error }}</Alert>
    <p v-else-if="!averages" class="text-sm text-slate-500">
      Todavía no hay datos del equipo: se apuntan en la pestaña «Acta interna» de cada partido disputado.
    </p>

    <template v-else>
      <div class="space-y-3">
        <div v-if="averages.possessionPct !== null">
          <div class="mb-1 flex justify-between text-xs"><span class="font-semibold text-accent-400">{{ formatPct(possession) }}</span><span class="text-slate-600">Posesión media</span><span class="text-slate-500">{{ formatPct(possession === null ? null : 100 - possession) }}</span></div>
          <div class="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div class="h-full bg-accent-400" :style="{ width: `${Math.min(100, Math.max(0, averages.possessionPct))}%` }" />
          </div>
        </div>
        <div v-for="row in averageRows" :key="row.mine">
          <div class="mb-1 flex justify-between text-xs">
            <span class="font-semibold tabular-nums text-accent-400">{{ row.total ? averages[row.mine] : formatNumber(averages[row.mine] as number, 1) }}</span>
            <span class="text-center text-slate-600">{{ row.label }}</span>
            <span class="tabular-nums text-slate-500">{{ row.total ? averages[row.theirs] : formatNumber(averages[row.theirs] as number, 1) }}</span>
          </div>
          <div class="flex h-2 w-full overflow-hidden rounded-full bg-surface-3">
            <div class="h-full bg-accent-400" :style="{ width: `${share(averages[row.mine] as number, averages[row.theirs] as number)}%` }" />
          </div>
        </div>
      </div>
      <p class="mt-2 text-xs text-slate-500">Izquierda: tu equipo. Derecha: los rivales.</p>

      <div v-if="!compact && data" class="mt-5 overflow-x-auto rounded-lg border border-slate-200">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-3 py-2 text-left">Partido</th>
              <th class="px-2 py-2 text-center" title="Resultado (tu equipo primero)">Res.</th>
              <th class="px-2 py-2 text-center" title="Posesión de tu equipo">Pos.</th>
              <th class="px-2 py-2 text-center" title="Córners a favor - en contra">Córners</th>
              <th class="px-2 py-2 text-center" title="Tiros (a puerta) a favor - en contra">Tiros</th>
              <th class="col-md px-2 py-2 text-center" title="Fueras de juego tuyos - del rival">FdJ</th>
              <th class="col-md px-2 py-2 text-center" title="Faltas cometidas - recibidas">Faltas</th>
              <th class="col-sm px-2 py-2 text-center" title="Goles a balón parado a favor - en contra">B. parado</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in data.matches" :key="row.match.id">
              <td class="px-3 py-2 whitespace-nowrap">
                <span class="text-xs text-slate-400">J{{ row.match.matchday }} · {{ venue(row.match) }}</span>
                <TeamName
                  class="ml-1 font-medium text-slate-800"
                  :name="opponentOf(row.match, teamId).name"
                  :crest-url="opponentOf(row.match, teamId).crestUrl"
                  :short-name="opponentOf(row.match, teamId).shortName"
                />
              </td>
              <td class="px-2 py-2 text-center tabular-nums">{{ score(row.match) }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ formatPct(row.stats.possessionPct) }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ row.stats.cornersFor }}-{{ row.stats.cornersAgainst }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ row.stats.shotsFor }} ({{ row.stats.shotsOnTargetFor }})-{{ row.stats.shotsAgainst }} ({{ row.stats.shotsOnTargetAgainst }})</td>
              <td class="col-md px-2 py-2 text-center tabular-nums">{{ row.stats.offsidesFor }}-{{ row.stats.offsidesAgainst }}</td>
              <td class="col-md px-2 py-2 text-center tabular-nums">{{ row.stats.foulsCommitted }}-{{ row.stats.foulsReceived }}</td>
              <td class="col-sm px-2 py-2 text-center tabular-nums">{{ row.stats.setPieceGoalsFor }}-{{ row.stats.setPieceGoalsAgainst }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
