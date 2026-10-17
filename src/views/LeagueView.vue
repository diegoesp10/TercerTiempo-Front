<script setup lang="ts">
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const { data, loading, error } = useAsync(() => api.stats.leagueTable());
</script>

<template>
  <PageHeader
    title="Clasificación"
    :subtitle="data ? `${data.season.competitionName} · ${data.season.label}` : undefined"
  />

  <Spinner v-if="loading" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <div v-else-if="data" class="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-2 text-left">#</th>
          <th class="px-3 py-2 text-left">Equipo</th>
          <th class="px-3 py-2 text-center">PJ</th>
          <th class="px-3 py-2 text-center">G</th>
          <th class="px-3 py-2 text-center">E</th>
          <th class="px-3 py-2 text-center">P</th>
          <th class="px-3 py-2 text-center">GF</th>
          <th class="px-3 py-2 text-center">GC</th>
          <th class="px-3 py-2 text-center">DG</th>
          <th class="px-3 py-2 text-center font-semibold">Pts</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr
          v-for="row in data.standings"
          :key="row.teamId"
          :class="row.teamId === auth.membership?.teamId ? 'bg-emerald-50 font-medium' : 'hover:bg-slate-50'"
        >
          <td class="px-3 py-2 tabular-nums text-slate-500">{{ row.position }}</td>
          <td class="px-3 py-2">
            <RouterLink :to="{ name: 'team', params: { teamId: row.teamId } }" class="hover:text-emerald-700 hover:underline">
              {{ row.teamName }}
            </RouterLink>
          </td>
          <td class="px-3 py-2 text-center tabular-nums">{{ row.played }}</td>
          <td class="px-3 py-2 text-center tabular-nums">{{ row.won }}</td>
          <td class="px-3 py-2 text-center tabular-nums">{{ row.drawn }}</td>
          <td class="px-3 py-2 text-center tabular-nums">{{ row.lost }}</td>
          <td class="px-3 py-2 text-center tabular-nums">{{ row.goalsFor }}</td>
          <td class="px-3 py-2 text-center tabular-nums">{{ row.goalsAgainst }}</td>
          <td class="px-3 py-2 text-center tabular-nums">{{ row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference }}</td>
          <td class="px-3 py-2 text-center font-semibold tabular-nums">{{ row.points }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
