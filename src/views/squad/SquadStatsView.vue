<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { goalsDonutOption, minutesBarsOption, ratingRankingOption, teamRatingOption, teamResultsOption } from '@/charts/options';
import AppChart from '@/components/charts/AppChart.vue';
import ChartCard from '@/components/charts/ChartCard.vue';
import Alert from '@/components/ui/Alert.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import TeamSeasonStats from '@/components/squads/TeamSeasonStats.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';
import { useSettingsStore } from '@/stores/settings';
import type { SquadPlayerStatsDto } from '@/types/api';
import { formatNumber, formatPct, positionShortLabels } from '@/utils/format';
import PlayerName from '@/components/players/PlayerName.vue';

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

/** Vistas de la tabla: cada una agrupa las estadísticas de una faceta para que la tabla siga siendo legible. */
type View = 'general' | 'ataque' | 'pases' | 'defensa';
const views: { id: View; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'ataque', label: 'Ataque' },
  { id: 'pases', label: 'Pases' },
  { id: 'defensa', label: 'Defensa' },
];
const view = ref<View>('general');

type Format = 'int' | 'decimal' | 'pct' | 'rating';
interface Column {
  key: string;
  label: string;
  title: string;
  /** Ancho mínimo de pantalla en el que se ve la columna (ver .col-sm/.col-md/.col-lg en style.css). */
  from?: 'sm' | 'md' | 'lg';
  value: (row: SquadPlayerStatsDto) => number | null;
  format?: Format;
  strong?: boolean;
}

const s = (row: SquadPlayerStatsDto) => row.stats;
const columnsByView: Record<View, Column[]> = {
  general: [
    { key: 'matches', label: 'PJ', title: 'Partidos con línea en el acta', value: (r) => s(r).matchesLogged },
    { key: 'starts', label: 'Tit', title: 'Titularidades', from: 'md', value: (r) => s(r).starts },
    { key: 'minutes', label: 'Min', title: 'Minutos jugados', from: 'sm', value: (r) => s(r).minutes },
    { key: 'goals', label: 'G', title: 'Goles', value: (r) => s(r).goals, strong: true },
    { key: 'assists', label: 'A', title: 'Asistencias de gol', value: (r) => s(r).assists },
    { key: 'contributions', label: 'G+A', title: 'Goles más asistencias', from: 'md', value: (r) => s(r).goalContributions },
    { key: 'rating', label: 'Nota', title: 'Nota media calculada con los datos de las actas', value: (r) => s(r).averageRating, format: 'rating' },
    { key: 'participation', label: 'Part.', title: 'Porcentaje de los minutos posibles del equipo', from: 'lg', value: (r) => r.impact.participationPct, format: 'pct' },
    { key: 'pointsWith', label: 'PPP con', title: 'Puntos por partido del equipo cuando juega', from: 'lg', value: (r) => r.impact.pointsPerMatchWithPlayer, format: 'decimal' },
    { key: 'pointsWithout', label: 'PPP sin', title: 'Puntos por partido del equipo cuando no juega', from: 'lg', value: (r) => r.impact.pointsPerMatchWithoutPlayer, format: 'decimal' },
  ],
  ataque: [
    { key: 'goals', label: 'G', title: 'Goles', value: (r) => s(r).goals, strong: true },
    { key: 'assists', label: 'A', title: 'Asistencias de gol', value: (r) => s(r).assists, strong: true },
    { key: 'shots', label: 'Tiros', title: 'Tiros totales', value: (r) => s(r).shots },
    { key: 'shotsOnTarget', label: 'TP', title: 'Tiros a puerta', value: (r) => s(r).shotsOnTarget },
    { key: 'shotAccuracy', label: '% TP', title: 'Tiros a puerta sobre tiros totales', from: 'sm', value: (r) => s(r).shotAccuracyPct, format: 'pct' },
    { key: 'goalsPer90', label: "G/90'", title: 'Goles por 90 minutos', from: 'md', value: (r) => s(r).goalsPer90, format: 'decimal' },
    { key: 'assistsPer90', label: "A/90'", title: 'Asistencias de gol por 90 minutos', from: 'md', value: (r) => s(r).assistsPer90, format: 'decimal' },
    { key: 'contributionsPer90', label: "G+A/90'", title: 'Goles más asistencias por 90 minutos', from: 'lg', value: (r) => s(r).goalContributionsPer90, format: 'decimal' },
  ],
  pases: [
    { key: 'passesCompleted', label: 'Compl.', title: 'Pases completados', value: (r) => s(r).passesCompleted, strong: true },
    { key: 'passesAttempted', label: 'Intent.', title: 'Pases intentados', value: (r) => s(r).passesAttempted },
    { key: 'passAccuracy', label: '% Acierto', title: 'Pases completados sobre intentados', value: (r) => s(r).passAccuracyPct, format: 'pct' },
    { key: 'assists', label: 'A', title: 'Asistencias de gol', from: 'sm', value: (r) => s(r).assists },
    { key: 'ballLosses', label: 'Pérdidas', title: 'Pérdidas de balón', value: (r) => s(r).ballLosses },
  ],
  defensa: [
    { key: 'recoveries', label: 'Recup.', title: 'Recuperaciones de balón', value: (r) => s(r).recoveries, strong: true },
    { key: 'recoveriesPer90', label: "Rec/90'", title: 'Recuperaciones por 90 minutos', from: 'sm', value: (r) => s(r).recoveriesPer90, format: 'decimal' },
    { key: 'tackles', label: 'Ent', title: 'Entradas', value: (r) => s(r).tackles },
    { key: 'interceptions', label: 'Int', title: 'Intercepciones', value: (r) => s(r).interceptions },
    { key: 'saves', label: 'Par', title: 'Paradas', from: 'sm', value: (r) => s(r).saves },
    { key: 'fouls', label: 'F', title: 'Faltas cometidas', from: 'md', value: (r) => s(r).fouls },
    { key: 'yellow', label: 'TA', title: 'Tarjetas amarillas', from: 'md', value: (r) => s(r).yellowCards },
    { key: 'red', label: 'TR', title: 'Tarjetas rojas', from: 'md', value: (r) => s(r).redCards },
  ],
};
const columns = computed(() => columnsByView[view.value]);
const colClass = (from?: 'sm' | 'md' | 'lg') => (from ? `col-${from}` : '');

const display = (column: Column, row: SquadPlayerStatsDto) => {
  const v = column.value(row);
  if (column.format === 'pct') return formatPct(v);
  if (column.format === 'decimal') return formatNumber(v);
  return v ?? '—';
};

const sortKey = ref<string>('minutes');
const sortAsc = ref(false);

function sortBy(key: string) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortKey.value = key;
    sortAsc.value = key === 'name';
  }
}

// Al cambiar de vista se ordena por su primera columna si la que había no existe en ella.
watch(view, () => {
  if (sortKey.value !== 'name' && !columns.value.some((c) => c.key === sortKey.value)) {
    sortKey.value = columns.value[0].key;
    sortAsc.value = false;
  }
});

const sorted = computed(() => {
  const rows = [...(data.value?.players ?? [])];
  const column = columns.value.find((c) => c.key === sortKey.value);
  rows.sort((a, b) => {
    const cmp = !column
      ? a.player.fullName.localeCompare(b.player.fullName, 'es')
      : (column.value(a) ?? -1) - (column.value(b) ?? -1);
    return sortAsc.value ? cmp : -cmp;
  });
  return rows;
});

const arrow = (key: string) => (sortKey.value === key ? (sortAsc.value ? ' ▲' : ' ▼') : '');
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <p class="mb-3 text-sm text-slate-600">
      <strong>{{ data.matchesRecorded }}</strong> de {{ data.teamMatchesPlayed }} partidos disputados tienen acta.
      <span v-if="data.matchesRecorded < data.teamMatchesPlayed" class="text-slate-500">Las estadísticas solo cuentan los partidos con acta.</span>
    </p>

    <!-- Gráficos del equipo -->
    <div v-if="hasRecords || teamResults" class="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
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

    <!-- Datos del equipo por partido (córners, posesión, tiros…) que apunta el cuerpo técnico -->
    <TeamSeasonStats class="mb-8" :squad-id="squadId" :team-id="data.squad.teamId" />

    <p v-if="data.players.length === 0" class="text-sm text-slate-500">La plantilla no tiene jugadores todavía.</p>

    <div v-else class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Estadísticas por jugador</h2>
      <div class="inline-flex rounded-lg border border-slate-200 p-0.5 text-sm" role="tablist" aria-label="Estadísticas">
        <button
          v-for="item in views"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="view === item.id"
          class="rounded-md px-3 py-1 font-medium"
          :class="view === item.id ? 'bg-action text-white shadow-glow' : 'text-slate-600 hover:bg-slate-100'"
          @click="view = item.id"
        >
          {{ item.label }}
        </button>
      </div>
    </div>

    <div v-if="data.players.length > 0" class="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
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
              ><PlayerName :name="row.player.fullName" :photo-url="row.player.photoUrl" /></RouterLink>
              <span v-if="row.player.position" class="ml-1 text-xs text-slate-400">{{ positionShortLabels[row.player.position] }}</span>
            </td>
            <td
              v-for="column in columns"
              :key="column.key"
              class="px-2 py-2 text-center tabular-nums"
              :class="[colClass(column.from), column.strong ? 'font-semibold' : '']"
            >
              <RatingBadge v-if="column.format === 'rating'" :rating="column.value(row)" size="sm" />
              <template v-else>{{ display(column, row) }}</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="content-note mt-3">
      Pulsa una columna para ordenar. «Part.» es el porcentaje de los minutos posibles del equipo que ha jugado; «PPP» son los
      puntos por partido del equipo con y sin el jugador en el acta. Tiros, pases, pérdidas, recuperaciones, entradas y faltas
      salen de lo que el cuerpo técnico apunta en el acta interna de cada partido.
    </p>
  </template>
</template>
