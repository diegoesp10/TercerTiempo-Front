<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';
import type { SquadPlayerStatsDto } from '@/types/api';
import { formatNumber, formatPct, positionShortLabels } from '@/utils/format';

const { squadId } = useSquad();

const { data, loading, error } = useAsync(() => api.squads.stats(squadId.value));

type SortKey = 'name' | 'matches' | 'starts' | 'minutes' | 'goals' | 'assists' | 'contributions' | 'rating' | 'goalsPer90' | 'participation' | 'pointsWith' | 'pointsWithout';

const columns: { key: SortKey; label: string; title: string }[] = [
  { key: 'matches', label: 'PJ', title: 'Partidos con línea en el acta' },
  { key: 'starts', label: 'Tit', title: 'Titularidades' },
  { key: 'minutes', label: 'Min', title: 'Minutos jugados' },
  { key: 'goals', label: 'G', title: 'Goles' },
  { key: 'assists', label: 'A', title: 'Asistencias' },
  { key: 'contributions', label: 'G+A', title: 'Goles más asistencias' },
  { key: 'rating', label: 'Nota', title: 'Valoración media del cuerpo técnico (1-10)' },
  { key: 'goalsPer90', label: "G/90'", title: 'Goles por 90 minutos' },
  { key: 'participation', label: 'Part.', title: 'Porcentaje de los minutos posibles del equipo' },
  { key: 'pointsWith', label: 'PPP con', title: 'Puntos por partido del equipo cuando juega' },
  { key: 'pointsWithout', label: 'PPP sin', title: 'Puntos por partido del equipo cuando no juega' },
];

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

    <p v-if="data.players.length === 0" class="text-sm text-slate-500">La plantilla no tiene jugadores todavía.</p>

    <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left">
              <button type="button" class="hover:text-slate-800" @click="sortBy('name')">Jugador{{ arrow('name') }}</button>
            </th>
            <th v-for="column in columns" :key="column.key" class="px-2 py-2 text-center" :title="column.title">
              <button type="button" class="whitespace-nowrap hover:text-slate-800" @click="sortBy(column.key)">{{ column.label }}{{ arrow(column.key) }}</button>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="row in sorted" :key="row.player.id" :class="row.stats.matchesLogged === 0 ? 'text-slate-400' : 'hover:bg-slate-50'">
            <td class="px-3 py-2 whitespace-nowrap">
              <span v-if="row.player.shirtNumber" class="mr-1 text-slate-400">{{ row.player.shirtNumber }}</span>
              <span class="font-medium" :class="row.stats.matchesLogged === 0 ? '' : 'text-slate-800'">{{ row.player.fullName }}</span>
              <span v-if="row.player.position" class="ml-1 text-xs text-slate-400">{{ positionShortLabels[row.player.position] }}</span>
            </td>
            <td class="px-2 py-2 text-center tabular-nums">{{ row.stats.matchesLogged }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ row.stats.starts }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ row.stats.minutes }}</td>
            <td class="px-2 py-2 text-center font-semibold tabular-nums">{{ row.stats.goals }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ row.stats.assists }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ row.stats.goalContributions }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ formatNumber(row.stats.averageRating, 1) }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ formatNumber(row.stats.goalsPer90) }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ formatPct(row.impact.participationPct) }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ formatNumber(row.impact.pointsPerMatchWithPlayer) }}</td>
            <td class="px-2 py-2 text-center tabular-nums">{{ formatNumber(row.impact.pointsPerMatchWithoutPlayer) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="mt-3 text-xs text-slate-500">
      Pulsa una columna para ordenar. «Part.» es el porcentaje de los minutos posibles del equipo que ha jugado; «PPP» son los
      puntos por partido del equipo con y sin el jugador en el acta.
    </p>
  </template>
</template>
