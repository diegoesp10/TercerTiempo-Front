<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/api';
import { goalsDonutOption, minutesBarsOption, ratingRankingOption, teamRatingOption, teamResultsOption } from '@/charts/options';
import AppChart from '@/components/charts/AppChart.vue';
import ChartCard from '@/components/charts/ChartCard.vue';
import Alert from '@/components/ui/Alert.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';
import { useSettingsStore } from '@/stores/settings';
import type { SquadPlayerStatsDto } from '@/types/api';
import { formatNumber, formatPct, positionShortLabels } from '@/utils/format';

const { squadId } = useSquad();
const settings = useSettingsStore();

const { data, loading, error } = useAsync(() => api.squads.stats(squadId.value));
const timeline = useAsync(() => api.squads.timeline(squadId.value));

const donutMetric = ref<'goals' | 'goalContributions'>('goals');

const hasRecords = computed(() => (data.value?.matchesRecorded ?? 0) > 0);
const teamResults = computed(() => (timeline.data.value?.matches.length ? teamResultsOption(timeline.data.value.matches) : null));
const teamRating = computed(() =>
  timeline.data.value?.matches.some((m) => m.averageRating !== null) ? teamRatingOption(timeline.data.value.matches) : null,
);
const donut = computed(() => (data.value ? goalsDonutOption(data.value.players, donutMetric.value, settings.resolvedTheme) : null));
const minutes = computed(() => (data.value ? minutesBarsOption(data.value.players, 16, settings.resolvedTheme) : null));
const ranking = computed(() => (data.value ? ratingRankingOption(data.value.players, 12, settings.resolvedTheme) : null));

type SortKey = 'name' | 'matches' | 'starts' | 'minutes' | 'goals' | 'assists' | 'contributions' | 'rating' | 'goalsPer90' | 'participation' | 'pointsWith' | 'pointsWithout';

// `from`: ancho mínimo de pantalla en el que se ve la columna (ver .col-sm/.col-md/.col-lg en style.css).
const columns: { key: SortKey; label: string; title: string; from?: 'sm' | 'md' | 'lg' }[] = [
  { key: 'matches', label: 'PJ', title: 'Partidos con línea en el acta' },
  { key: 'starts', label: 'Tit', title: 'Titularidades', from: 'md' },
  { key: 'minutes', label: 'Min', title: 'Minutos jugados', from: 'sm' },
  { key: 'goals', label: 'G', title: 'Goles' },
  { key: 'assists', label: 'A', title: 'Asistencias' },
  { key: 'contributions', label: 'G+A', title: 'Goles más asistencias', from: 'md' },
  { key: 'rating', label: 'Nota', title: 'Nota media calculada con los datos de las actas' },
  { key: 'goalsPer90', label: "G/90'", title: 'Goles por 90 minutos', from: 'lg' },
  { key: 'participation', label: 'Part.', title: 'Porcentaje de los minutos posibles del equipo', from: 'lg' },
  { key: 'pointsWith', label: 'PPP con', title: 'Puntos por partido del equipo cuando juega', from: 'lg' },
  { key: 'pointsWithout', label: 'PPP sin', title: 'Puntos por partido del equipo cuando no juega', from: 'lg' },
];
const colClass = (from?: 'sm' | 'md' | 'lg') => (from ? `col-${from}` : '');

const getters: Record<SortKey, (row: SquadPlayerStatsDto) => number | string> = {
  name: (r) => r.player.fullName,
  matches: (r) => r.stats.matchesLogged,
  starts: (r) => r.stats.starts,
  minutes: (r) => r.stats.minutes,
  goals: (r) => r.stats.goals,
  assists: (r) => r.stats.assists,
  contributions: (r) => r.stats.goalContributions,
  rating: (r) => r.stats.averageRating ?? -1,
  goalsPer90: (r) => r.stats.goalsPer90 ?? -1,
  participation: (r) => r.impact.participationPct,
  pointsWith: (r) => r.impact.pointsPerMatchWithPlayer ?? -1,
  pointsWithout: (r) => r.impact.pointsPerMatchWithoutPlayer ?? -1,
};

const sortKey = ref<SortKey>('minutes');
const sortAsc = ref(false);

function sortBy(key: SortKey) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortKey.value = key;
    sortAsc.value = key === 'name';
  }
}

const sorted = computed(() => {
  const rows = [...(data.value?.players ?? [])];
  const get = getters[sortKey.value];
  rows.sort((a, b) => {
    const x = get(a);
    const y = get(b);
    const cmp = typeof x === 'string' && typeof y === 'string' ? x.localeCompare(y, 'es') : Number(x) - Number(y);
    return sortAsc.value ? cmp : -cmp;
  });
  return rows;
});

const arrow = (key: SortKey) => (sortKey.value === key ? (sortAsc.value ? ' ▲' : ' ▼') : '');
</script>

<template>
  <Spinner v-if="loading" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <p class="mb-3 text-sm text-slate-600">
      <strong>{{ data.matchesRecorded }}</strong> de {{ data.teamMatchesPlayed }} partidos disputados tienen acta.
      <span v-if="data.matchesRecorded < data.teamMatchesPlayed" class="text-slate-500">Las estadísticas solo cuentan los partidos con acta.</span>
    </p>

    <!-- Gráficos del equipo -->
    <div v-if="hasRecords || teamResults" class="mb-8 grid gap-6 lg:grid-cols-3">
      <ChartCard v-if="teamResults" title="Resultados y puntos" subtitle="Goles a favor y en contra por partido; puntos acumulados en el eje derecho." class="lg:col-span-2">
        <AppChart :option="teamResults" :height="300" label="Resultados del equipo y puntos acumulados" />
      </ChartCard>

      <ChartCard v-if="hasRecords" title="Reparto de goles" subtitle="Según las actas registradas.">
        <template #actions>
          <div class="inline-flex rounded-lg border border-slate-200 p-0.5 text-xs">
            <button
              v-for="option in ([['goals', 'Goles'], ['goalContributions', 'G + A']] as const)"
              :key="option[0]"
              type="button"
              class="rounded-md px-2 py-0.5 font-medium"
              :class="donutMetric === option[0] ? 'bg-action text-white shadow-glow' : 'text-slate-600 hover:bg-slate-100'"
              @click="donutMetric = option[0]"
            >
              {{ option[1] }}
            </button>
          </div>
        </template>
        <AppChart v-if="donut" :option="donut" :height="300" label="Reparto de goles entre los jugadores" />
      </ChartCard>

      <ChartCard v-if="teamRating" title="Nota media del equipo" subtitle="Media de las notas del acta en cada partido y mejor nota (rombo)." class="lg:col-span-2">
        <AppChart :option="teamRating" :height="280" label="Nota media del equipo por partido" />
      </ChartCard>

      <ChartCard v-if="hasRecords" title="Ranking de nota" subtitle="Nota media de los jugadores con 90' o más.">
        <AppChart v-if="ranking" :option="ranking" :height="280" label="Ranking de nota media" />
      </ChartCard>

      <ChartCard v-if="hasRecords" title="Minutos jugados" subtitle="Con el porcentaje de los minutos posibles del equipo." class="lg:col-span-3">
        <AppChart v-if="minutes" :option="minutes" :height="Math.max(220, data.players.filter((r) => r.stats.minutes > 0).slice(0, 16).length * 26)" label="Minutos jugados por jugador" />
      </ChartCard>
    </div>

    <p v-if="data.players.length === 0" class="text-sm text-slate-500">La plantilla no tiene jugadores todavía.</p>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left">
              <button type="button" class="hover:text-slate-800" @click="sortBy('name')">Jugador{{ arrow('name') }}</button>
            </th>
            <th v-for="column in columns" :key="column.key" class="px-2 py-2 text-center" :class="colClass(column.from)" :title="column.title">
              <button type="button" class="whitespace-nowrap hover:text-slate-800" @click="sortBy(column.key)">{{ column.label }}{{ arrow(column.key) }}</button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="row in sorted" :key="row.player.id" :class="row.stats.matchesLogged === 0 ? 'text-slate-400' : 'hover:bg-slate-50'">
            <td class="px-3 py-2 whitespace-nowrap">
              <span v-if="row.player.shirtNumber" class="mr-1 text-slate-400">{{ row.player.shirtNumber }}</span>
              <RouterLink
                :to="{ name: 'squad-player', params: { squadId, squadPlayerId: row.player.id } }"
                class="font-medium hover:text-accent-400 hover:underline"
                :class="row.stats.matchesLogged === 0 ? '' : 'text-slate-800'"
              >{{ row.player.fullName }}</RouterLink>
              <span v-if="row.player.position" class="ml-1 text-xs text-slate-400">{{ positionShortLabels[row.player.position] }}</span>
            </td>
            <td class="px-2 py-2 text-center tabular-nums">{{ row.stats.matchesLogged }}</td>
            <td class="col-md px-2 py-2 text-center tabular-nums">{{ row.stats.starts }}</td>
            <td class="col-sm px-2 py-2 text-center tabular-nums">{{ row.stats.minutes }}</td>
            <td class="px-2 py-2 text-center font-semibold tabular-nums">{{ row.stats.goals }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ row.stats.assists }}</td>
            <td class="col-md px-2 py-2 text-center tabular-nums">{{ row.stats.goalContributions }}</td>
            <td class="px-2 py-2 text-center"><RatingBadge :rating="row.stats.averageRating" size="sm" /></td>
            <td class="col-lg px-2 py-2 text-center tabular-nums">{{ formatNumber(row.stats.goalsPer90) }}</td>
            <td class="col-lg px-2 py-2 text-center tabular-nums">{{ formatPct(row.impact.participationPct) }}</td>
            <td class="col-lg px-2 py-2 text-center tabular-nums">{{ formatNumber(row.impact.pointsPerMatchWithPlayer) }}</td>
            <td class="col-lg px-2 py-2 text-center tabular-nums">{{ formatNumber(row.impact.pointsPerMatchWithoutPlayer) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="content-note mt-3">
      Pulsa una columna para ordenar. «Part.» es el porcentaje de los minutos posibles del equipo que ha jugado; «PPP» son los
      puntos por partido del equipo con y sin el jugador en el acta.
    </p>
  </template>
</template>
