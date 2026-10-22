<script setup lang="ts">
import { computed, watch } from 'vue';
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
import RatingBadge from '@/components/ui/RatingBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StatCard from '@/components/ui/StatCard.vue';
import { useAsync } from '@/composables/useAsync';
import { useSettingsStore } from '@/stores/settings';
import { formatNumber, formatPct, positionLabels } from '@/utils/format';

const props = defineProps<{ squadId: string; squadPlayerId: string }>();

const { data, loading, error, run } = useAsync(() => api.squads.playerProfile(props.squadId, props.squadPlayerId));
watch(() => props.squadPlayerId, () => void run());

const played = computed(() => data.value?.matches.filter((m) => m.performance) ?? []);
const heroStats = computed(() =>
  data.value
    ? [
        { label: 'Partidos', value: data.value.stats.matchesLogged },
        { label: 'Minutos', value: data.value.stats.minutes },
        { label: 'Goles', value: data.value.stats.goals },
        { label: 'Asistencias', value: data.value.stats.assists },
        { label: 'Nota media', value: data.value.stats.averageRating === null ? '—' : formatNumber(data.value.stats.averageRating, 1) },
      ]
    : [],
);
const isGoalkeeper = computed(() => data.value?.player.position === 'Goalkeeper');

const settings = useSettingsStore();
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
    <RouterLink :to="{ name: 'squad-stats', params: { squadId } }" class="text-sm text-slate-500 hover:text-slate-800">← Estadísticas de la plantilla</RouterLink>

    <PlayerHeroCard
      class="mt-3 mb-6"
      :team="`${data.squad.teamName} · ${data.squad.seasonLabel}`"
      :name="data.player.fullName"
      :number="data.player.shirtNumber"
      :photo-url="data.player.photoUrl"
      :meta="`${data.player.position ? positionLabels[data.player.position] : 'Posición sin indicar'}${data.player.shirtNumber ? ` · dorsal ${data.player.shirtNumber}` : ''} · nota media calculada con los datos de sus actas`"
      :stats="heroStats"
    >
      <template #actions>
        <RatingBadge :rating="data.stats.averageRating" size="lg" />
        <Badge v-if="data.player.linked" tone="green">Cuenta vinculada</Badge>
        <RouterLink :to="{ name: 'squad-compare', params: { squadId }, query: { ids: squadPlayerId } }" class="btn-secondary">Comparar con…</RouterLink>
      </template>
    </PlayerHeroCard>

    <Alert v-if="played.length === 0" kind="info" class="mb-6">
      Todavía no hay ninguna acta con minutos de este jugador. Los gráficos aparecerán cuando el cuerpo técnico registre sus partidos.
    </Alert>

    <template v-else>
      <div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Partidos" :value="data.stats.matchesLogged" :hint="`${data.stats.starts} como titular`" />
        <StatCard label="Minutos" :value="data.stats.minutes" :hint="`${formatPct(data.impact.participationPct)} de los posibles`" />
        <StatCard label="Goles" :value="data.stats.goals" :hint="`${formatNumber(data.stats.goalsPer90)} por 90'`" accent />
        <StatCard label="Asistencias" :value="data.stats.assists" :hint="`${formatNumber(data.stats.assistsPer90)} por 90'`" />
        <StatCard
          label="Puntos/partido"
          :value="formatNumber(data.impact.pointsPerMatchWithPlayer)"
          :hint="`sin él: ${formatNumber(data.impact.pointsPerMatchWithoutPlayer)}`"
        />
        <StatCard label="Precisión tiro" :value="formatPct(data.stats.shotAccuracyPct)" :hint="`${data.stats.shotsOnTarget}/${data.stats.shots} a puerta`" />
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
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
