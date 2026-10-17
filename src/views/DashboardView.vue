<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import PercentileBar from '@/components/ui/PercentileBar.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StatCard from '@/components/ui/StatCard.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { formatDate, formatNumber, formatPct, membershipStatusLabels, outcomeFor, outcomeLabels, positionLabels } from '@/utils/format';

const auth = useAuthStore();
const { data, loading, error } = useAsync(async () => {
  const dashboard = await api.stats.dashboard();
  auth.setPlayer(dashboard.player);
  return dashboard;
});

const membership = computed(() => data.value?.player.membership ?? null);
const impact = computed(() => data.value?.teamImpact ?? null);
const league = computed(() => data.value?.league ?? null);
const hasPercentiles = computed(() => league.value !== null && league.value.playersOnPlatform >= 2);

function opponentOf(match: { homeTeam: { id: string; name: string }; awayTeam: { id: string; name: string } }) {
  const teamId = membership.value?.teamId;
  return match.homeTeam.id === teamId ? `vs ${match.awayTeam.name}` : `@ ${match.homeTeam.name}`;
}
</script>

<template>
  <Spinner v-if="loading" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <PageHeader
      :title="`Hola, ${data.player.displayName}`"
      :subtitle="data.season ? `${data.season.competitionName} · ${data.season.label}` : 'Sin temporada activa'"
    >
      <template #actions>
        <Badge>{{ positionLabels[data.player.position] }}</Badge>
        <Badge v-if="membership" :tone="membership.status === 'Active' ? 'green' : 'amber'">
          {{ membership.teamName }} · {{ membershipStatusLabels[membership.status] }}
        </Badge>
      </template>
    </PageHeader>

    <Alert v-if="!membership" kind="info" class="mb-6">
      Todavía no perteneces a ningún equipo.
      <RouterLink to="/equipos" class="font-medium underline">Elige tu equipo y reclama tu ficha</RouterLink> para empezar a registrar partidos.
    </Alert>

    <Alert v-else-if="data.individual.matchesLogged === 0" kind="info" class="mb-6">
      Aún no has registrado ningún partido.
      <RouterLink to="/partidos" class="font-medium underline">Ve a tus partidos</RouterLink> y registra tu rendimiento en los ya disputados.
    </Alert>

    <!-- Individual -->
    <section class="mb-8">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Tu temporada</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Partidos" :value="data.individual.matchesLogged" :hint="`${data.individual.starts} como titular`" />
        <StatCard label="Minutos" :value="data.individual.minutes" />
        <StatCard label="Goles" :value="data.individual.goals" :hint="`${formatNumber(data.individual.goalsPer90)} por 90'`" accent />
        <StatCard label="Asistencias" :value="data.individual.assists" :hint="`${formatNumber(data.individual.assistsPer90)} por 90'`" />
        <StatCard label="Nota media" :value="formatNumber(data.individual.averageRating, 1)" hint="autoevaluación 1-10" />
        <StatCard label="Precisión tiro" :value="formatPct(data.individual.shotAccuracyPct)" :hint="`${data.individual.shotsOnTarget}/${data.individual.shots} a puerta`" />
      </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- Impacto en el equipo -->
      <section v-if="impact" class="card">
        <h2 class="font-semibold text-slate-900">Tu aporte al equipo</h2>
        <p class="mb-4 text-xs text-slate-500">{{ impact.teamMatchesPlayed }} partidos disputados por el equipo · {{ impact.teamGoalsFor }} goles a favor · {{ impact.teamPoints }} puntos</p>

        <div class="grid grid-cols-3 gap-3 text-center">
          <div><p class="text-2xl font-semibold text-slate-900">{{ formatPct(impact.participationPct) }}</p><p class="text-xs text-slate-500">de los minutos posibles</p></div>
          <div><p class="text-2xl font-semibold text-slate-900">{{ formatPct(impact.goalSharePct) }}</p><p class="text-xs text-slate-500">de los goles del equipo</p></div>
          <div><p class="text-2xl font-semibold text-slate-900">{{ formatPct(impact.goalContributionSharePct) }}</p><p class="text-xs text-slate-500">goles + asistencias</p></div>
        </div>

        <table class="mt-5 w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr><th class="py-1 text-left"></th><th class="py-1 text-center">Contigo</th><th class="py-1 text-center">Sin ti</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr><td class="py-2 text-slate-600">Partidos</td><td class="py-2 text-center tabular-nums">{{ impact.matchesWithPlayer }}</td><td class="py-2 text-center tabular-nums">{{ impact.matchesWithoutPlayer }}</td></tr>
            <tr><td class="py-2 text-slate-600">Balance (V-E-D)</td><td class="py-2 text-center tabular-nums">{{ impact.winsWithPlayer }}-{{ impact.drawsWithPlayer }}-{{ impact.lossesWithPlayer }}</td><td class="py-2 text-center text-slate-400">—</td></tr>
            <tr><td class="py-2 text-slate-600">Puntos por partido</td><td class="py-2 text-center font-semibold tabular-nums">{{ formatNumber(impact.pointsPerMatchWithPlayer) }}</td><td class="py-2 text-center tabular-nums">{{ formatNumber(impact.pointsPerMatchWithoutPlayer) }}</td></tr>
            <tr><td class="py-2 text-slate-600">Goles a favor / partido</td><td class="py-2 text-center tabular-nums">{{ formatNumber(impact.goalsForPerMatchWithPlayer) }}</td><td class="py-2 text-center tabular-nums">{{ formatNumber(impact.goalsForPerMatchWithoutPlayer) }}</td></tr>
            <tr><td class="py-2 text-slate-600">Goles en contra / partido</td><td class="py-2 text-center tabular-nums">{{ formatNumber(impact.goalsAgainstPerMatchWithPlayer) }}</td><td class="py-2 text-center tabular-nums">{{ formatNumber(impact.goalsAgainstPerMatchWithoutPlayer) }}</td></tr>
          </tbody>
        </table>
      </section>

      <!-- Liga -->
      <section v-if="league" class="card">
        <h2 class="font-semibold text-slate-900">Frente a la liga</h2>
        <p class="mb-4 text-xs text-slate-500">
          <template v-if="league.teamPosition">Tu equipo es {{ league.teamPosition }}º de {{ league.teamsCount }}.</template>
          <template v-else>{{ league.teamsCount }} equipos en la competición.</template>
        </p>

        <table class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr><th class="py-1 text-left"></th><th class="py-1 text-center">Tu equipo</th><th class="py-1 text-center">Media liga</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr><td class="py-2 text-slate-600">Goles a favor / partido</td><td class="py-2 text-center font-semibold tabular-nums">{{ formatNumber(league.teamGoalsForPerMatch) }}</td><td class="py-2 text-center tabular-nums">{{ formatNumber(league.leagueAvgGoalsForPerMatch) }}</td></tr>
            <tr><td class="py-2 text-slate-600">Goles en contra / partido</td><td class="py-2 text-center font-semibold tabular-nums">{{ formatNumber(league.teamGoalsAgainstPerMatch) }}</td><td class="py-2 text-center tabular-nums">{{ formatNumber(league.leagueAvgGoalsForPerMatch) }}</td></tr>
            <tr><td class="py-2 text-slate-600">Puntos / partido</td><td class="py-2 text-center font-semibold tabular-nums">{{ formatNumber(league.teamPointsPerMatch) }}</td><td class="py-2 text-center tabular-nums">{{ formatNumber(league.leagueAvgPointsPerMatch) }}</td></tr>
          </tbody>
        </table>

        <div class="mt-5">
          <h3 class="mb-2 text-sm font-medium text-slate-800">Tú frente a los jugadores de la liga registrados</h3>
          <div v-if="hasPercentiles" class="space-y-3">
            <PercentileBar label="Goles por 90'" :value="league.goalsPer90Percentile" />
            <PercentileBar label="Asistencias por 90'" :value="league.assistsPer90Percentile" />
            <PercentileBar label="Nota media" :value="league.ratingPercentile" />
            <PercentileBar label="Minutos jugados" :value="league.minutesPercentile" />
            <p class="text-xs text-slate-500">Percentil entre {{ league.playersOnPlatform }} jugadores con minutos registrados. P75 = mejor que el 75%.</p>
          </div>
          <p v-else class="text-sm text-slate-500">
            La comparativa se activa cuando al menos dos jugadores de la liga registran minutos en la plataforma.
          </p>
        </div>
      </section>
    </div>

    <!-- Últimos partidos -->
    <section v-if="data.recentPerformances.length > 0" class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Últimos partidos registrados</h2>
        <RouterLink to="/partidos" class="text-sm text-emerald-700 hover:underline">Ver todos</RouterLink>
      </div>
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-3 py-2 text-left">Partido</th>
              <th class="px-3 py-2 text-center">Resultado</th>
              <th class="px-3 py-2 text-center">Min</th>
              <th class="px-3 py-2 text-center">G</th>
              <th class="px-3 py-2 text-center">A</th>
              <th class="px-3 py-2 text-center">Nota</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in data.recentPerformances" :key="item.performance.id" class="hover:bg-slate-50">
              <td class="px-3 py-2">
                <RouterLink :to="{ name: 'match', params: { matchId: item.match.id } }" class="font-medium text-slate-800 hover:text-emerald-700">
                  J{{ item.match.matchday }} · {{ opponentOf(item.match) }}
                </RouterLink>
                <p class="text-xs text-slate-500">{{ formatDate(item.match.kickoffAt) }}</p>
              </td>
              <td class="px-3 py-2 text-center tabular-nums">
                {{ item.match.homeGoals }}-{{ item.match.awayGoals }}
                <Badge v-if="membership && outcomeFor(item.match, membership.teamId)" :tone="outcomeFor(item.match, membership.teamId) === 'win' ? 'green' : outcomeFor(item.match, membership.teamId) === 'draw' ? 'amber' : 'red'" class="ml-1">
                  {{ outcomeLabels[outcomeFor(item.match, membership.teamId)!] }}
                </Badge>
              </td>
              <td class="px-3 py-2 text-center tabular-nums">{{ item.performance.minutesPlayed }}</td>
              <td class="px-3 py-2 text-center tabular-nums">{{ item.performance.goals }}</td>
              <td class="px-3 py-2 text-center tabular-nums">{{ item.performance.assists }}</td>
              <td class="px-3 py-2 text-center font-semibold tabular-nums">{{ item.performance.selfRating }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
