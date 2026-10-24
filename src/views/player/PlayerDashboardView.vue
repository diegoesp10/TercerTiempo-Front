<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import PlayerHeroCard from '@/components/players/PlayerHeroCard.vue';
import PlayerPhotoWizard from '@/components/players/PlayerPhotoWizard.vue';
import type { PlayerDto } from '@/types/api';
import PercentileBar from '@/components/ui/PercentileBar.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StatCard from '@/components/ui/StatCard.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import AppChart from '@/components/charts/AppChart.vue';
import ChartCard from '@/components/charts/ChartCard.vue';
import { profileRadarOption, ratingBreakdownOption, ratingTrendOption } from '@/charts/options';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { confirmDialog } from '@/composables/useConfirm';
import {
  formatDate,
  formatNumber,
  formatPct,
  outcomeFor,
  outcomeLabels,
  outcomeTone,
  positionLabels,
  suggestionStatusLabels,
  suggestionStatusTone,
  visibilityLabels,
} from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';
import { opponentOf } from '@/utils/crests';

const auth = useAuthStore();
const settings = useSettingsStore();
const squad = computed(() => auth.playerSquad);

const { data, loading, error, run } = useAsync(async () => {
  if (!auth.playerSquad) return null;
  const dashboard = await api.players.dashboard();
  auth.setPlayer(dashboard.player);
  return dashboard;
});

// Gráficos: la ficha del jugador en su plantilla (serie partido a partido, perfil por 90' y referencias).
const profile = useAsync(() =>
  auth.playerSquad ? api.squads.playerProfile(auth.playerSquad.squadId, auth.playerSquad.squadPlayerId) : Promise.resolve(null),
);
const trendChart = computed(() =>
  profile.data.value ? ratingTrendOption(profile.data.value.matches, profile.data.value.squadAverage.averageRating, settings.resolvedTheme) : null,
);
const radarChart = computed(() =>
  profile.data.value
    ? profileRadarOption(
        [
          { name: 'Tú', axes: profile.data.value.profile },
          { name: 'Media de la plantilla', axes: profile.data.value.squadAverage, reference: true },
        ],
        profile.data.value.squadBest,
        profile.data.value.player.position === 'Goalkeeper',
        settings.resolvedTheme,
      )
    : null,
);
const breakdownChart = computed(() => (profile.data.value ? ratingBreakdownOption(profile.data.value.matches) : null));
const hasCharts = computed(() => profile.data.value?.matches.some((m) => m.performance) ?? false);

const heroStats = computed(() =>
  data.value
    ? [
        { label: 'Partidos', value: data.value.individual.matchesLogged },
        { label: 'Minutos', value: data.value.individual.minutes },
        { label: 'Goles', value: data.value.individual.goals },
        { label: 'Asistencias', value: data.value.individual.assists },
        { label: 'Nota media', value: data.value.individual.averageRating === null ? '—' : formatNumber(data.value.individual.averageRating, 1) },
      ]
    : [],
);

const impact = computed(() => data.value?.teamImpact ?? null);
const league = computed(() => data.value?.league ?? null);
const hasPercentiles = computed(() => league.value !== null && league.value.playersCompared >= 2);

const suggestions = useAsync(() => (auth.playerSquad ? api.players.suggestions() : Promise.resolve([])));

const photoOpen = ref(false);
function onPhotoSaved(player: PlayerDto) {
  auth.setPlayer(player);
  void profile.run();
}

const leaveError = ref<string | null>(null);

async function leave() {
  if (!(await confirmDialog({ title: 'Desvincularte de la plantilla', message: 'Tus actas siguen en la plantilla; solo se rompe el vínculo con tu cuenta.', confirmLabel: 'Desvincularme', danger: true }))) return;
  leaveError.value = null;
  try {
    auth.setPlayer(await api.players.leaveSquad());
    await run();
  } catch (e) {
    leaveError.value = errorMessage(e);
  }
}
</script>

<template>
  <template v-if="!squad">
    <PageHeader :title="`Hola, ${auth.displayName}`" subtitle="Todavía no estás vinculado a ninguna plantilla." />
    <div class="card max-w-2xl">
      <h2 class="font-semibold text-slate-900">Vincúlate a tu ficha</h2>
      <p class="mt-2 text-sm text-slate-600">
        Tu cuerpo técnico gestiona la plantilla en Tercer Tiempo y registra el acta de cada partido. Pide a tu club o entrenador el
        <strong>código personal</strong> de tu ficha: al introducirlo, tu cuenta pasa a ser esa ficha y verás tus estadísticas, lo que
        aportas al equipo y cómo te comparas con la liga.
      </p>
      <RouterLink to="/invitacion" class="btn-primary mt-4">Tengo un código de invitación</RouterLink>
    </div>
  </template>

  <Spinner v-else-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <PlayerHeroCard
      class="mb-8"
      :team="`${squad.teamName} · ${data.season ? `${data.season.competitionName} · ${data.season.label}` : 'Sin temporada activa'}`"
      :team-crest-url="squad.teamCrestUrl"
      :team-id="squad.teamId"
      :name="data.player.displayName"
      :number="squad.shirtNumber"
      :photo-url="auth.player?.photoUrl ?? profile.data.value?.player.photoUrl ?? null"
      :meta="`${positionLabels[data.player.position]}${squad.shirtNumber ? ` · dorsal ${squad.shirtNumber}` : ''}`"
      :stats="heroStats"
    >
      <template #actions>
        <button type="button" class="btn-primary" @click="photoOpen = true"><Icon icon="camera" class="mr-1.5 h-3.5 w-3.5" />{{ auth.player?.photoUrl ? 'Cambiar mi foto' : 'Subir mi foto' }}</button>
        <RouterLink :to="{ name: 'squad', params: { squadId: squad.squadId } }" class="btn-secondary min-w-0 max-w-full">
          <TeamName :name="squad.teamName" :crest-url="squad.teamCrestUrl" :team-id="squad.teamId" />
          <Badge :tone="squad.visibility === 'Public' ? 'green' : 'slate'">{{ visibilityLabels[squad.visibility] }}</Badge>
        </RouterLink>
      </template>
    </PlayerHeroCard>

    <PlayerPhotoWizard :open="photoOpen" :has-photo="!!auth.player?.photoUrl" @close="photoOpen = false" @saved="onPhotoSaved" />

    <Alert v-if="data.individual.matchesLogged === 0" kind="info" class="mb-6">
      Tu cuerpo técnico todavía no ha registrado ninguna acta con tu ficha. En cuanto lo haga, aquí aparecerán tus números.
    </Alert>

    <!-- Individual -->
    <section class="mb-8">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Tu temporada</h2>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Partidos" :value="data.individual.matchesLogged" :hint="`${data.individual.starts} como titular`" />
        <StatCard label="Minutos" :value="data.individual.minutes" />
        <StatCard label="Goles" :value="data.individual.goals" :hint="`${formatNumber(data.individual.goalsPer90)} por 90'`" accent />
        <StatCard label="Asistencias" :value="data.individual.assists" :hint="`${formatNumber(data.individual.assistsPer90)} por 90'`" />
        <StatCard label="Nota media" :value="formatNumber(data.individual.averageRating, 1)" hint="calculada con los datos del acta" />
        <StatCard label="Precisión tiro" :value="formatPct(data.individual.shotAccuracyPct)" :hint="`${data.individual.shotsOnTarget}/${data.individual.shots} a puerta`" />
      </div>
      <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Acierto en el pase" :value="formatPct(data.individual.passAccuracyPct)" :hint="`${data.individual.passesCompleted}/${data.individual.passesAttempted} completados`" />
        <StatCard label="Recuperaciones" :value="data.individual.recoveries" :hint="`${formatNumber(data.individual.recoveriesPer90)} por 90'`" />
        <StatCard label="Pérdidas de balón" :value="data.individual.ballLosses" :hint="`${data.individual.fouls} faltas cometidas`" />
        <StatCard label="Pases clave" :value="data.individual.keyPasses" :hint="`${data.individual.tackles} entradas · ${data.individual.interceptions} intercepciones`" />
      </div>
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
          {{ data.season?.competitionName }}:
          <template v-if="league.teamPosition">tu equipo es {{ league.teamPosition }}º de {{ league.teamsCount }}.</template>
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
          <h3 class="mb-2 text-sm font-medium text-slate-800">Tú frente a los jugadores con actas visibles</h3>
          <div v-if="hasPercentiles" class="space-y-3">
            <PercentileBar label="Goles por 90'" :value="league.goalsPer90Percentile" />
            <PercentileBar label="Asistencias por 90'" :value="league.assistsPer90Percentile" />
            <PercentileBar label="Nota media" :value="league.ratingPercentile" />
            <PercentileBar label="Minutos jugados" :value="league.minutesPercentile" />
            <p class="text-xs text-slate-500">
              Percentil entre {{ league.playersCompared }} jugadores con minutos en plantillas públicas de la liga (y la tuya). P75 = mejor que el 75%.
            </p>
          </div>
          <p v-else class="text-sm text-slate-500">
            La comparativa se activa cuando al menos dos jugadores de la liga tienen minutos en actas visibles (plantillas públicas o la tuya).
          </p>
        </div>
      </section>
    </div>

    <!-- Gráficos -->
    <section v-if="hasCharts" class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Tus gráficos</h2>
        <RouterLink
          :to="{ name: 'squad-player', params: { squadId: squad.squadId, squadPlayerId: squad.squadPlayerId } }"
          class="text-sm text-accent-400 hover:underline"
        >
          Ver ficha completa
        </RouterLink>
      </div>
      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Tu nota partido a partido" subtitle="Calculada con los datos del acta, frente a tu media y la de la plantilla." class="lg:col-span-2">
          <AppChart v-if="trendChart" :option="trendChart" :height="280" label="Evolución de tu nota" />
        </ChartCard>
        <ChartCard title="Tu perfil por 90 minutos" subtitle="Frente a la media de tu plantilla.">
          <AppChart v-if="radarChart" :option="radarChart" :height="320" label="Radar de tu perfil" />
        </ChartCard>
        <ChartCard title="Cómo se forma tu nota" subtitle="Lo que suma o resta cada bloque sobre 6,0.">
          <AppChart v-if="breakdownChart" :option="breakdownChart" :height="320" label="Desglose de tu nota" />
        </ChartCard>
      </div>
    </section>

    <!-- Sugerencias enviadas -->
    <section class="mt-8">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Tus sugerencias al acta</h2>
        <RouterLink :to="{ name: 'squad-matches', params: { squadId: squad.squadId } }" class="text-sm text-accent-400 hover:underline">Entra en un partido para sugerir una corrección</RouterLink>
      </div>
      <p v-if="!suggestions.data.value?.length" class="text-sm text-slate-500">
        Si llevas la cuenta de lo que hiciste y el acta no coincide, abre el partido y pulsa «Sugerir una corrección»: tu club o tu entrenador lo revisarán.
      </p>
      <ul v-else class="divide-y divide-line rounded-xl border border-line bg-surface shadow-sm">
        <li v-for="s in suggestions.data.value" :key="s.id" class="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm">
          <div class="min-w-0">
            <RouterLink :to="{ name: 'sheet', params: { squadId: squad.squadId, matchId: s.match.id }, query: { tab: 'interna' } }" class="font-medium text-slate-800 hover:text-accent-400">
              J{{ s.match.matchday }} · <TeamName prefix="vs" :name="opponentOf(s.match, squad.teamId).name" :crest-url="opponentOf(s.match, squad.teamId).crestUrl" />
            </RouterLink>
            <p class="text-xs text-slate-500">
              {{ s.current ? 'Corrección' : 'Entrada nueva' }} · {{ s.proposed.minutesPlayed }}' · {{ s.proposed.goals }} G · {{ s.proposed.assists }} A · enviada el {{ formatDate(s.createdAt) }}
              <template v-if="s.resolvedBy"> · {{ suggestionStatusLabels[s.status].toLowerCase() }} por {{ s.resolvedBy }}</template>
              <template v-if="s.resolutionNote">: “{{ s.resolutionNote }}”</template>
            </p>
          </div>
          <Badge :tone="suggestionStatusTone[s.status]">{{ suggestionStatusLabels[s.status] }}</Badge>
        </li>
      </ul>
    </section>

    <!-- Últimos partidos -->
    <section v-if="data.recentPerformances.length > 0" class="mt-8">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Tus últimas actas</h2>
        <RouterLink :to="{ name: 'squad-matches', params: { squadId: squad.squadId } }" class="text-sm text-accent-400 hover:underline">Ver todos los partidos</RouterLink>
      </div>
      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-3 py-2 text-left">Partido</th>
              <th class="px-3 py-2 text-center">Resultado</th>
              <th class="col-sm px-3 py-2 text-center">Min</th>
              <th class="px-3 py-2 text-center">G</th>
              <th class="col-sm px-3 py-2 text-center">A</th>
              <th class="px-3 py-2 text-center">Nota</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in data.recentPerformances" :key="item.performance.id" class="hover:bg-slate-50">
              <td class="px-3 py-2">
                <RouterLink :to="{ name: 'match', params: { matchId: item.match.id } }" class="font-medium text-slate-800 hover:text-accent-400">
                  J{{ item.match.matchday }} · <TeamName prefix="vs" :name="opponentOf(item.match, squad.teamId).name" :crest-url="opponentOf(item.match, squad.teamId).crestUrl" />
                </RouterLink>
                <p class="text-xs text-slate-500">{{ formatDate(item.match.kickoffAt) }}</p>
              </td>
              <td class="px-3 py-2 text-center tabular-nums">
                {{ item.match.homeGoals }}-{{ item.match.awayGoals }}
                <Badge v-if="outcomeFor(item.match, squad.teamId)" :tone="outcomeTone(outcomeFor(item.match, squad.teamId))" class="ml-1">
                  {{ outcomeLabels[outcomeFor(item.match, squad.teamId)!] }}
                </Badge>
              </td>
              <td class="col-sm px-3 py-2 text-center tabular-nums">{{ item.performance.minutesPlayed }}</td>
              <td class="px-3 py-2 text-center tabular-nums">{{ item.performance.goals }}</td>
              <td class="col-sm px-3 py-2 text-center tabular-nums">{{ item.performance.assists }}</td>
              <td class="px-3 py-2 text-center"><RatingBadge :rating="item.performance.rating" size="sm" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="mt-10 border-t border-slate-200 pt-4">
      <Alert v-if="leaveError" kind="error" class="mb-3">{{ leaveError }}</Alert>
      <button type="button" class="btn-ghost text-red-600 hover:bg-red-50" @click="leave">Desvincularme de la plantilla</button>
    </section>
  </template>
</template>
