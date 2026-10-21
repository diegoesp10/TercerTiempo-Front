<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import MatchdayFixtures from '@/components/matches/MatchdayFixtures.vue';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { groupByLevel, levelLabels } from '@/utils/format';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const competitions = useAsync(() => api.competitions.list());
const groups = computed(() => groupByLevel(competitions.data.value ?? []));

const selectedId = ref<string | null>(typeof route.query.competition === 'string' ? route.query.competition : null);

const preferredCompetitionId = computed(() => auth.playerSquad?.competitionId ?? auth.coachSquads[0]?.competitionId ?? null);

watch(competitions.data, (list) => {
  if (!list || list.length === 0) return;
  if (selectedId.value && list.some((c) => c.id === selectedId.value)) return;
  selectedId.value = preferredCompetitionId.value ?? list.find((c) => c.level === 'National')?.id ?? list[0]?.id ?? null;
});

const table = useAsync(() => api.stats.leagueTable(selectedId.value), { immediate: false });

/** Equipos del usuario (sus plantillas como técnico o la suya como jugador), para resaltarlos. */
const myTeamIds = computed(() => [
  ...auth.coachSquads.map((s) => s.teamId),
  ...(auth.playerSquad ? [auth.playerSquad.teamId] : []),
]);

watch(selectedId, (id) => {
  if (!id) return;
  if (route.query.competition !== id) void router.replace({ query: { ...route.query, competition: id } });
  void table.run();
}, { immediate: true });
</script>

<template>
  <PageHeader
    title="Jornada y clasificación"
    :subtitle="table.data.value ? `${table.data.value.season.competitionName} · ${table.data.value.season.label}` : undefined"
  >
    <template #actions>
      <select v-if="groups.length > 0" v-model="selectedId" class="input w-auto min-w-64" aria-label="Competición">
        <optgroup v-for="group in groups" :key="group.level" :label="levelLabels[group.level]">
          <option v-for="competition in group.competitions" :key="competition.id" :value="competition.id">
            {{ competition.name }}
          </option>
        </optgroup>
      </select>
    </template>
  </PageHeader>

  <Spinner v-if="competitions.loading.value" />
  <Alert v-else-if="competitions.error.value" kind="error">{{ competitions.error.value }}</Alert>
  <Alert v-else-if="groups.length === 0" kind="warning">Todavía no hay ligas sincronizadas.</Alert>

  <div v-else class="grid items-start gap-6 lg:grid-cols-5">
    <!-- Jornada en curso (o la elegida) -->
    <MatchdayFixtures v-if="selectedId" :competition-id="selectedId" :highlight-team-ids="myTeamIds" class="lg:col-span-2" />

    <!-- Clasificación -->
    <div class="lg:col-span-3">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Clasificación</h2>
      <Spinner v-if="table.loading.value" />
      <Alert v-else-if="table.error.value" kind="error">{{ table.error.value }}</Alert>

      <div v-else-if="table.data.value" class="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
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
              v-for="row in table.data.value.standings"
              :key="row.teamId"
              :class="auth.isMyTeam(row.teamId) ? 'bg-brand-500/10 font-medium' : 'hover:bg-slate-50'"
            >
              <td class="px-3 py-2 tabular-nums text-slate-500">{{ row.position }}</td>
              <td class="px-3 py-2">
                <RouterLink :to="{ name: 'team', params: { teamId: row.teamId } }" class="flex items-center gap-2 hover:text-accent-400 hover:underline">
                  <img v-if="row.crestUrl" :src="row.crestUrl" :alt="''" class="h-5 w-5 object-contain" loading="lazy" />
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
        <p v-if="table.data.value.standings.length === 0" class="p-4 text-sm text-slate-500">El proveedor aún no publica clasificación para esta liga.</p>
      </div>
    </div>
  </div>
</template>
