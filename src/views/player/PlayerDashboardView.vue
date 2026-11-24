<script setup lang="ts">
import { computed, watch } from 'vue';
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import GroundCard from '@/components/trainings/GroundCard.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import PlayerHeroCard from '@/components/players/PlayerHeroCard.vue';
import PositionSummaryPicker from '@/components/players/PositionSummaryPicker.vue';
import ShirtNumberUsage from '@/components/players/ShirtNumberUsage.vue';
import type { MyCallUpDto, MyTrainingDto, PerformanceWithMatchDto } from '@/types/api';
import PercentileBar from '@/components/ui/PercentileBar.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StatCard from '@/components/ui/StatCard.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import AppChart from '@/components/charts/AppChart.vue';
import ChartCard from '@/components/charts/ChartCard.vue';
import { profileRadarOption, ratingBreakdownOption, ratingTrendOption } from '@/charts/options';
import { useAsync } from '@/composables/useAsync';
import { useSort } from '@/composables/useSort';
import { useSummaryPosition } from '@/composables/useSummaryPosition';
import { markCallUpsSeen } from '@/composables/useCallUpSeen';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import {
  callUpResponseLabels,
  callUpResponseTone,
  formatDate,
  formatDayHeading,
  formatKickoff,
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
import MyTrainingTallyCard from '@/components/trainings/MyTrainingTallyCard.vue';
import MyAttendanceBadge from '@/components/trainings/MyAttendanceBadge.vue';
import DisciplineBadge from '@/components/squads/DisciplineBadge.vue';
import DashboardSearch from '@/components/search/DashboardSearch.vue';
import { keyStatsFor, keyTotals, matchesOfTeam } from '@/utils/keyStats';

const auth = useAuthStore();
const settings = useSettingsStore();
const squad = computed(() => auth.playerSquad);

const { data, loading, error } = useAsync(async () => {
  if (!auth.playerSquad) return null;
  const dashboard = await api.players.dashboard();
  auth.setPlayer(dashboard.player);
  return dashboard;
});

// Gráficos: la ficha del jugador en su plantilla (serie partido a partido, perfil por 90' y referencias).
const profile = useAsync(() =>
  auth.playerSquad ? api.squads.playerProfile(auth.playerSquad.squadId, auth.playerSquad.squadPlayerId) : Promise.resolve(null),
  { redirectOnError: false },
);
// Si llega apercibido o sancionado al próximo partido de liga.
const discipline = useAsync(() => (auth.playerSquad ? api.squads.discipline(auth.playerSquad.squadId) : Promise.resolve(null)), { redirectOnError: false });
const myDiscipline = computed(() => discipline.data.value?.players.find((p) => p.squadPlayerId === auth.playerSquad?.squadPlayerId)?.next ?? null);
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

// Además de lo de todos, el dato del puesto (paradas, despejes, pases...): el suyo o el que elija en «Resumen como».
const summaryPosition = useSummaryPosition(() => data.value?.player);
const heroStats = computed(() => {
  if (!data.value) return [];
  const individual = data.value.individual;
  return [
    { label: 'Partidos', ...matchesOfTeam(individual.matchesLogged, data.value.teamImpact?.teamMatchesPlayed) },
    { label: 'Titular', value: individual.starts },
    { label: 'Minutos', value: individual.minutes },
    { label: 'Goles', value: individual.goals },
    ...keyStatsFor(summaryPosition.value).map((stat) => ({ label: stat.label, value: stat.value(keyTotals(individual)), title: stat.title })),
    { label: 'Nota media', value: individual.averageRating === null ? '—' : formatNumber(individual.averageRating, 1) },
  ];
});

// Últimas actas: llegan de la más reciente a la más antigua y se ordenan por cualquier columna.
type RecentKey = 'match' | 'result' | 'minutes' | 'goals' | 'assists' | 'rating';
const recentRows = computed(() => data.value?.recentPerformances ?? []);
const recentGetters: Record<RecentKey, (item: PerformanceWithMatchDto) => number | null> = {
  match: (i) => new Date(i.match.kickoffAt).getTime(),
  // Primero las victorias (y entre ellas, las de más diferencia).
  result: (i) => {
    const { homeGoals, awayGoals } = i.match;
    if (homeGoals === null || awayGoals === null) return null;
    const diff = i.match.homeTeam.id === squad.value?.teamId ? homeGoals - awayGoals : awayGoals - homeGoals;
    return (diff > 0 ? 3 : diff === 0 ? 1 : 0) * 100 + diff;
  },
  minutes: (i) => i.performance.minutesPlayed,
  goals: (i) => i.performance.goals,
  assists: (i) => i.performance.assists,
  rating: (i) => i.performance.rating,
};
const { sorted: recentSorted, sortBy: sortRecent, state: recentState } = useSort<PerformanceWithMatchDto, RecentKey>(recentRows, recentGetters, 'match');

const impact = computed(() => data.value?.teamImpact ?? null);
const league = computed(() => data.value?.league ?? null);
const hasPercentiles = computed(() => league.value !== null && league.value.playersCompared >= 2);

const suggestions = useAsync(() => (auth.playerSquad ? api.players.suggestions() : Promise.resolve([])), { redirectOnError: false });

// Lo que el jugador tiene que contestar: convocatorias publicadas sin firmar y los próximos entrenamientos.
const callUps = useAsync(() => (auth.playerSquad ? api.trainings.myCallUps() : Promise.resolve([] as MyCallUpDto[])), { redirectOnError: false });
const trainings = useAsync(() => (auth.playerSquad ? api.trainings.mine() : Promise.resolve([] as MyTrainingDto[])), { redirectOnError: false });
const pendingCallUps = computed(() => (callUps.data.value ?? []).filter((c) => !c.closed && c.mine.response === 'Pending'));
const nextCallUp = computed(() => (callUps.data.value ?? []).find((c) => !c.closed) ?? null);
// La próxima se lee entera en la tarjeta: cuenta como vista.
watch(nextCallUp, (c) => { if (c) markCallUpsSeen([c]); }, { immediate: true });
const nextTrainings = computed(() => (trainings.data.value ?? []).slice(0, 3));

</script>

<template>
  <template v-if="!squad">
    <PageHeader :title="`Hola, ${auth.displayName}`" subtitle="Todavía no estás vinculado a ninguna plantilla.">
      <template #actions><DashboardSearch /></template>
    </PageHeader>
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
      :number="null"
      :photo-url="auth.player?.photoUrl ?? profile.data.value?.player.photoUrl ?? null"
      :meta="positionLabels[data.player.position]"
      :stats="heroStats"
    >
      <template #actions>
        <DashboardSearch />
        <RouterLink :to="{ name: 'squad', params: { squadId: squad.squadId } }" class="btn-secondary min-w-0 max-w-full">
          <TeamName :name="squad.teamName" :crest-url="squad.teamCrestUrl" :team-id="squad.teamId" />
          <Badge :tone="squad.visibility === 'Public' ? 'green' : 'slate'">{{ visibilityLabels[squad.visibility] }}</Badge>
        </RouterLink>
        <DisciplineBadge :discipline="myDiscipline" reason />
      </template>
      <template #summary>
        <PositionSummaryPicker v-model="summaryPosition" :own="data.player.position" you />
      </template>
    </PlayerHeroCard>

    <!-- Convocatorias y entrenamientos: lo que el jugador tiene que contestar esta semana -->
    <section class="mb-8 grid gap-4 lg:grid-cols-2">
      <div class="card" :class="pendingCallUps.length > 0 ? 'border-brand-500/50' : ''">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="futbol" class="h-4 w-4 text-accent-400" />Convocatorias de partido</h2>
          <RouterLink to="/mis-convocatorias" class="text-sm text-accent-400 hover:underline">Ver todas</RouterLink>
        </div>
        <p v-if="!nextCallUp" class="text-sm text-slate-500">Ninguna convocatoria enviada para los próximos partidos.</p>
        <template v-else>
          <p class="text-sm text-slate-700">
            <strong>{{ nextCallUp.mine.called ? 'Vas convocado' : 'No vas convocado' }}</strong> · J{{ nextCallUp.match.matchday }}
            <TeamName prefix="vs" :name="opponentOf(nextCallUp.match, squad.teamId).name" :crest-url="opponentOf(nextCallUp.match, squad.teamId).crestUrl" /> · {{ formatKickoff(nextCallUp.match.kickoffAt) }}
          </p>
          <p v-if="nextCallUp.mine.called && nextCallUp.meetAt" class="mt-1 text-xs text-slate-600">Cita: {{ formatKickoff(nextCallUp.meetAt) }}</p>
          <GroundCard v-if="nextCallUp.mine.called && (nextCallUp.meetGround || nextCallUp.meetPlace)" :ground="nextCallUp.meetGround" :place="nextCallUp.meetPlace" compact class="mt-1.5" />
          <p class="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <Badge :tone="nextCallUp.mine.called ? callUpResponseTone[nextCallUp.mine.response] : nextCallUp.mine.response === 'Acknowledged' ? 'slate' : 'amber'">
              {{ nextCallUp.mine.called ? callUpResponseLabels[nextCallUp.mine.response] : nextCallUp.mine.response === 'Acknowledged' ? 'Enterado' : 'Sin firmar' }}
            </Badge>
            <RouterLink v-if="nextCallUp.mine.response === 'Pending'" to="/mis-convocatorias" class="btn-primary px-3 py-1 text-xs">{{ nextCallUp.mine.called ? 'Firmar' : 'Darme por enterado' }}</RouterLink>
          </p>
        </template>
      </div>
      <div class="card">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="calendar-check" class="h-4 w-4 text-accent-400" />Próximos entrenamientos</h2>
          <RouterLink :to="{ name: 'squad-trainings', params: { squadId: squad.squadId } }" class="text-sm text-accent-400 hover:underline">Calendario</RouterLink>
        </div>
        <p v-if="nextTrainings.length === 0" class="text-sm text-slate-500">Tu cuerpo técnico no ha preparado todavía ningún entrenamiento.</p>
        <ul v-else class="space-y-1.5 text-sm">
          <li v-for="t in nextTrainings" :key="t.session.id" class="flex flex-wrap items-center justify-between gap-2">
            <RouterLink :to="{ name: 'squad-trainings', params: { squadId: t.squadId }, query: { sesion: t.session.id } }" class="min-w-0 text-slate-700 hover:text-accent-400">
              {{ formatDayHeading(t.session.startsAt) }} · {{ t.session.title }}
            </RouterLink>
            <Badge v-if="t.session.mine?.injured" tone="red">Lesionado</Badge>
            <MyAttendanceBadge v-else-if="t.session.mine" :status="t.session.mine.status" />
          </li>
        </ul>
      </div>
    </section>

    <MyTrainingTallyCard class="mb-8" :current-squad-id="squad.squadId" />

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
        <StatCard label="Asistencias de gol" :value="data.individual.assists" :hint="`${formatNumber(data.individual.assistsPer90)} por 90'`" />
        <StatCard label="Nota media" :value="formatNumber(data.individual.averageRating, 1)" hint="calculada con los datos del acta" />
        <StatCard label="Precisión tiro" :value="formatPct(data.individual.shotAccuracyPct)" :hint="`${data.individual.shotsOnTarget}/${data.individual.shots} a puerta`" />
      </div>
      <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Acierto en el pase" :value="formatPct(data.individual.passAccuracyPct)" :hint="`${data.individual.passesCompleted}/${data.individual.passesAttempted} completados`" />
        <StatCard label="Recuperaciones" :value="data.individual.recoveries" :hint="`${formatNumber(data.individual.recoveriesPer90)} por 90'`" />
        <StatCard label="Pérdidas de balón" :value="data.individual.ballLosses" :hint="`${data.individual.fouls} faltas cometidas`" />
        <StatCard label="Entradas" :value="data.individual.tackles" :hint="`${data.individual.interceptions} intercepciones · ${data.individual.clearances ?? 0} despejes`" />
      </div>
    </section>

    <!-- Dorsales: no hay uno fijo; el de cada partido sale de su acta. -->
    <section v-if="profile.data.value" class="card mb-8">
      <h2 class="font-semibold text-slate-900">Tus dorsales</h2>
      <p class="text-xs text-slate-500">Los que has llevado esta temporada: en cada partido, el que apuntó tu cuerpo técnico en el acta interna y, si no, el del acta oficial.</p>
      <p v-if="profile.data.value.shirtNumbers.length === 0" class="mt-3 text-sm text-slate-500">Todavía no apareces con dorsal en ningún acta de esta temporada.</p>
      <ShirtNumberUsage v-else :usage="profile.data.value.shirtNumbers" class="mt-3 max-w-md" />
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
            <tr><td class="py-2 text-slate-600">Goles en contra / partido</td><td class="py-2 text-center font-semibold tabular-nums">{{ formatNumber(league.teamGoalsAgainstPerMatch) }}</td><td class="py-2 text-center tabular-nums">{{ formatNumber(league.leagueAvgGoalsAgainstPerMatch) }}</td></tr>
            <tr><td class="py-2 text-slate-600">Puntos / partido</td><td class="py-2 text-center font-semibold tabular-nums">{{ formatNumber(league.teamPointsPerMatch) }}</td><td class="py-2 text-center tabular-nums">{{ formatNumber(league.leagueAvgPointsPerMatch) }}</td></tr>
          </tbody>
        </table>

        <div class="mt-5">
          <h3 class="mb-2 text-sm font-medium text-slate-800">Tú frente a los jugadores con actas visibles</h3>
          <div v-if="hasPercentiles" class="space-y-3">
            <PercentileBar label="Goles por 90'" :value="league.goalsPer90Percentile" />
            <PercentileBar label="Asistencias de gol por 90'" :value="league.assistsPer90Percentile" />
            <PercentileBar label="Nota media" :value="league.ratingPercentile" />
            <PercentileBar label="Minutos jugados" :value="league.minutesPercentile" />
            <p class="text-xs text-slate-500">
              Percentil entre {{ league.playersCompared }} jugadores con minutos en las plantillas de la liga abiertas a solicitudes (y la tuya); solo se usan sus cifras agregadas. P75 = mejor que el 75%.
            </p>
          </div>
          <p v-else class="text-sm text-slate-500">
            La comparativa se activa cuando al menos dos jugadores de la liga tienen minutos en actas registradas (de plantillas abiertas a solicitudes o de la tuya).
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
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <SortHeader class="px-3 py-2 text-left" label="Partido" title="Fecha del partido" v-bind="recentState('match')" @sort="sortRecent('match')" />
              <SortHeader class="px-3 py-2 text-center" label="Resultado" v-bind="recentState('result')" @sort="sortRecent('result')" />
              <SortHeader class="col-sm px-3 py-2 text-center" label="Min" title="Minutos" v-bind="recentState('minutes')" @sort="sortRecent('minutes')" />
              <SortHeader class="px-3 py-2 text-center" label="G" title="Goles" v-bind="recentState('goals')" @sort="sortRecent('goals')" />
              <SortHeader class="col-sm px-3 py-2 text-center" label="A" title="Asistencias de gol" v-bind="recentState('assists')" @sort="sortRecent('assists')" />
              <SortHeader class="px-3 py-2 text-center" label="Nota" v-bind="recentState('rating')" @sort="sortRecent('rating')" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="item in recentSorted" :key="item.performance.id" class="hover:bg-slate-50">
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

  </template>
</template>
