<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import {
  contributionsOption,
  profileRadarOption,
  ratingBreakdownOption,
  ratingTrendOption,
} from '@/charts/options';
import AppChart from '@/components/charts/AppChart.vue';
import ChartCard from '@/components/charts/ChartCard.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PlayerHeroCard from '@/components/players/PlayerHeroCard.vue';
import PlayerMatchLog from '@/components/players/PlayerMatchLog.vue';
import PlayerPhotoWizard from '@/components/players/PlayerPhotoWizard.vue';
import PositionSummaryPicker from '@/components/players/PositionSummaryPicker.vue';
import PlayerTrainingTallyCard from '@/components/trainings/PlayerTrainingTallyCard.vue';
import InjuryPanel from '@/components/squads/InjuryPanel.vue';
import DisciplineBadge from '@/components/squads/DisciplineBadge.vue';
import { useViewer } from '@/composables/useViewer';
import ShirtNumberUsage from '@/components/players/ShirtNumberUsage.vue';
import { useBackFallback } from '@/composables/useBackFallback';
import { useSquad } from '@/composables/useSquad';
import { useAuthStore } from '@/stores/auth';
import type { DisciplineDto, PlayerDto } from '@/types/api';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StatCard from '@/components/ui/StatCard.vue';
import { useAsync } from '@/composables/useAsync';
import { useSummaryPosition } from '@/composables/useSummaryPosition';
import { useSettingsStore } from '@/stores/settings';
import { formatDate, formatNumber, formatPct, positionLabels } from '@/utils/format';
import { keyStatsFor, keyTotals, matchesOfTeam } from '@/utils/keyStats';

const props = defineProps<{ squadId: string; squadPlayerId: string }>();
const settings = useSettingsStore();

const { data, loading, error, run } = useAsync(() => api.squads.playerProfile(props.squadId, props.squadPlayerId));
useBackFallback(() => ({ to: { name: 'squad', params: { squadId: props.squadId } }, label: 'Volver a la plantilla' }));
watch(() => props.squadPlayerId, () => void run());

// Si llega apercibido o sancionado al próximo partido de liga; si no se puede saber, la ficha sale sin la marca.
const discipline = ref<DisciplineDto | null>(null);
watch(
  () => [props.squadId, props.squadPlayerId] as const,
  async ([squadId, squadPlayerId]) => {
    discipline.value = null;
    try {
      discipline.value = (await api.squads.discipline(squadId)).players.find((p) => p.squadPlayerId === squadPlayerId)?.next ?? null;
    } catch {
      /* sin marca */
    }
  },
  { immediate: true },
);

const played = computed(() => data.value?.matches.filter((m) => m.performance) ?? []);
// Cifras de la cabecera: por partido, el acta interna si existe y, si no, la oficial (así no salen ceros cuando el
// cuerpo técnico aún no lleva sus actas pero la federación sí ha publicado las suyas).
const combined = computed(() => {
  const totals = { matches: 0, starts: 0, minutes: 0, goals: 0, assists: 0, yellow: 0, red: 0 };
  for (const m of data.value?.matches ?? []) {
    const p = m.performance;
    const o = m.official;
    if (p && p.minutesPlayed > 0) {
      totals.matches++; if (p.started) totals.starts++; totals.minutes += p.minutesPlayed; totals.goals += p.goals; totals.assists += p.assists;
      totals.yellow += p.yellowCards; if (p.redCard) totals.red++;
    } else if (o && o.played) {
      totals.matches++; if (o.started) totals.starts++; totals.minutes += o.minutesPlayed; totals.goals += o.goals + o.penaltyGoals;
      totals.yellow += o.yellowCards; if (o.redCard) totals.red++;
    }
  }
  return totals;
});
// Además de lo de todos, el dato del puesto (paradas, despejes, pases...), que solo sale de las actas internas: el suyo
// o el que se elija en «Resumen como».
const summaryPosition = useSummaryPosition(() => data.value?.player);
const heroStats = computed(() => {
  if (!data.value) return [];
  const totals = keyTotals({ ...data.value.stats, assists: combined.value.assists });
  return [
    { label: 'Partidos', ...matchesOfTeam(combined.value.matches, data.value.impact.teamMatchesPlayed) },
    { label: 'Titular', value: combined.value.starts },
    { label: 'Minutos', value: combined.value.minutes },
    { label: 'Goles', value: combined.value.goals },
    ...keyStatsFor(summaryPosition.value).map((stat) => ({ label: stat.label, value: stat.value(totals), title: stat.title })),
    { label: 'Tarjetas', value: `${combined.value.yellow}/${combined.value.red}`, title: 'Amarillas / rojas' },
    { label: 'Nota media', value: data.value.stats.averageRating === null ? '—' : formatNumber(data.value.stats.averageRating, 1) },
  ];
});

// El propio jugador puede subir su foto desde su ficha.
const auth = useAuthStore();
const isMe = computed(() => auth.playerSquad?.squadPlayerId === props.squadPlayerId);
// Sus entrenamientos los ven el club, el cuerpo técnico y él mismo; el resto de la plantilla, no.
const { detail: squadDetail } = useSquad();
const showTrainings = computed(() => isMe.value || (squadDetail.value?.canManage ?? false));
// Sus lesiones (datos de salud): el club, el cuerpo técnico, él mismo y el administrador, que solo mira.
const { isAdmin } = useViewer();
const showInjuries = computed(() => showTrainings.value || isAdmin.value);
const photoOpen = ref(false);
function onPhotoSaved(player: PlayerDto) {
  auth.setPlayer(player);
  void run();
}
const isGoalkeeper = computed(() => data.value?.player.position === 'Goalkeeper');

const trend = computed(() => (data.value ? ratingTrendOption(data.value.matches, data.value.squadAverage.averageRating, settings.resolvedTheme) : null));
const radar = computed(() =>
  data.value
    ? profileRadarOption(
        [
          { name: data.value.player.fullName, axes: data.value.profile },
          { name: 'Media de la plantilla', axes: data.value.squadAverage, reference: true },
        ],
        data.value.squadBest,
        isGoalkeeper.value,
        settings.resolvedTheme,
      )
    : null,
);
const breakdown = computed(() => (data.value ? ratingBreakdownOption(data.value.matches) : null));
const contributions = computed(() => (data.value ? contributionsOption(data.value.matches) : null));
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <PlayerHeroCard
      class="mb-6"
      :team="`${data.squad.teamName} · ${data.squad.seasonLabel}`"
      :team-crest-url="data.squad.teamCrestUrl"
      :team-id="data.squad.teamId"
      :name="data.player.fullName"
      :number="data.shirtNumbers[0]?.number ?? null"
      :photo-url="data.player.photoUrl"
      :meta="`${data.player.position ? positionLabels[data.player.position] : 'Posición sin indicar'}${data.shirtNumbers[0] ? ` · dorsal más usado: ${data.shirtNumbers[0].number}` : ''} · nota media calculada con los datos de sus actas`"
      :stats="heroStats"
    >
      <template #actions>
        <RatingBadge :rating="data.stats.averageRating" size="lg" />
        <Badge v-if="data.player.status !== 'Active'" :title="'Ya no está en la plantilla: lo suyo se consulta, pero no entra en convocatorias, entrenamientos ni actas nuevas'">
          De baja<template v-if="data.player.leftOn"> desde el {{ formatDate(data.player.leftOn) }}</template>
        </Badge>
        <Badge v-else-if="data.player.linked" tone="green">Cuenta vinculada</Badge>
        <DisciplineBadge v-if="data.player.status === 'Active'" :discipline="discipline" reason />
        <button v-if="isMe" type="button" class="btn-primary" @click="photoOpen = true"><Icon icon="camera" class="mr-1.5 h-3.5 w-3.5" />{{ data.player.photoUrl ? 'Cambiar mi foto' : 'Subir mi foto' }}</button>
        <RouterLink :to="{ name: 'squad-compare', params: { squadId }, query: { ids: squadPlayerId } }" class="btn-secondary">Comparar con…</RouterLink>
      </template>
      <template #summary>
        <PositionSummaryPicker v-model="summaryPosition" :own="data.player.position" :you="isMe" />
      </template>
    </PlayerHeroCard>

    <!-- Dorsales que ha llevado de verdad, partido a partido; el de la ficha es solo el habitual que le pone el cuerpo técnico -->
    <section v-if="data.shirtNumbers.length" class="card mb-6">
      <h2 class="font-semibold text-slate-900">Dorsales</h2>
      <p class="text-xs text-slate-500">Los que ha llevado esta temporada: en cada partido, el apuntado en el acta interna y, si no, el del acta de la federación.</p>
      <ShirtNumberUsage :usage="data.shirtNumbers" class="mt-3 max-w-md" />
    </section>

    <PlayerTrainingTallyCard v-if="showTrainings" class="mb-6" :squad-id="squadId" :squad-player-id="squadPlayerId" />

    <InjuryPanel
      v-if="showInjuries && squadDetail"
      class="mb-6"
      :squad-id="squadId"
      :players="squadDetail.players"
      :can-manage="squadDetail.canManage"
      :player-id="squadPlayerId"
      :player-left="data.player.status !== 'Active'"
    />

    <PlayerMatchLog class="mb-6" :matches="data.matches" :squad-id="squadId" :position="data.player.position" />
    <PlayerPhotoWizard v-if="isMe" :open="photoOpen" :has-photo="!!auth.player?.photoUrl" @close="photoOpen = false" @saved="onPhotoSaved" />

    <Alert v-if="played.length === 0" kind="info" class="mb-6">
      Los gráficos de nota y perfil aparecerán cuando el cuerpo técnico registre el acta interna de sus partidos.
    </Alert>

    <template v-else>
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Partidos" :value="data.stats.matchesLogged" :hint="`${data.stats.starts} como titular`" />
        <StatCard label="Minutos" :value="data.stats.minutes" :hint="`${formatPct(data.impact.participationPct)} de los posibles`" />
        <StatCard label="Goles" :value="data.stats.goals" :hint="`${formatNumber(data.stats.goalsPer90)} por 90'`" accent />
        <StatCard label="Asistencias de gol" :value="data.stats.assists" :hint="`${formatNumber(data.stats.assistsPer90)} por 90'`" />
        <StatCard
          label="Puntos/partido"
          :value="formatNumber(data.impact.pointsPerMatchWithPlayer)"
          :hint="`sin él: ${formatNumber(data.impact.pointsPerMatchWithoutPlayer)}`"
        />
        <StatCard label="Precisión tiro" :value="formatPct(data.stats.shotAccuracyPct)" :hint="`${data.stats.shotsOnTarget}/${data.stats.shots} a puerta`" />
      </div>
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Acierto en el pase" :value="formatPct(data.stats.passAccuracyPct)" :hint="`${data.stats.passesCompleted}/${data.stats.passesAttempted} completados`" />
        <StatCard label="Recuperaciones" :value="data.stats.recoveries" :hint="`${formatNumber(data.stats.recoveriesPer90)} por 90'`" />
        <StatCard label="Pérdidas de balón" :value="data.stats.ballLosses" :hint="`${data.stats.fouls} faltas cometidas`" />
        <StatCard label="Entradas" :value="data.stats.tackles" :hint="`${data.stats.interceptions} intercepciones · ${data.stats.clearances ?? 0} despejes`" />
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard
          title="Nota partido a partido"
          subtitle="Calculada con los datos del acta; color según el tramo. Línea discontinua: su media y la de la plantilla."
          class="lg:col-span-2"
        >
          <AppChart v-if="trend" :option="trend" :height="300" label="Evolución de la nota del jugador" />
        </ChartCard>

        <ChartCard title="Perfil por 90 minutos" subtitle="Frente a la media de la plantilla (jugadores con 90' o más).">
          <AppChart v-if="radar" :option="radar" :height="340" label="Radar del perfil del jugador" />
        </ChartCard>

        <ChartCard title="Cómo se forma su nota" subtitle="Lo que suma o resta cada bloque sobre la base de 6,0 en cada partido.">
          <AppChart v-if="breakdown" :option="breakdown" :height="340" label="Desglose de la nota por partido" />
        </ChartCard>

        <ChartCard title="Goles, asistencias y minutos" subtitle="Todos los partidos del equipo; sin barras ni minutos donde no jugó." class="lg:col-span-2">
          <AppChart v-if="contributions" :option="contributions" :height="280" label="Goles, asistencias y minutos por partido" />
        </ChartCard>
      </div>
    </template>
  </template>
</template>
