<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import MatchdayFixtures from '@/components/matches/MatchdayFixtures.vue';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import MyClubBadge from '@/components/teams/MyClubBadge.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { useAsync } from '@/composables/useAsync';
import { useMyClub } from '@/composables/useMyClub';
import { groupByLevel, levelLabels } from '@/utils/format';
import { useSeasonStore } from '@/stores/season';

const season = useSeasonStore();

const route = useRoute();
const router = useRouter();

const competitions = useAsync(() => api.competitions.list());
const groups = computed(() => groupByLevel(competitions.data.value ?? []));

const { preferredCompetition, withMyClubFirst, isMine, myTeamIds } = useMyClub();

/** Opciones del desplegable: una por competición, agrupadas por nivel, con las de tu club arriba. */
const competitionOptions = computed(() =>
  withMyClubFirst(groups.value.flatMap((group) => group.competitions.map((c) => ({ value: c.id, label: c.name, group: levelLabels[group.level] })))),
);

const selectedId = ref<string | null>(typeof route.query.competition === 'string' ? route.query.competition : null);

watch(competitions.data, (list) => {
  if (!list || list.length === 0) return;
  if (selectedId.value && list.some((c) => c.id === selectedId.value)) return;
  selectedId.value = preferredCompetition(list) ?? list.find((c) => c.level === 'National')?.id ?? list[0]?.id ?? null;
});

const table = useAsync(() => api.stats.leagueTable(selectedId.value), { immediate: false });
const myRows = computed(() => (table.data.value?.standings ?? []).filter((row) => isMine(row.teamId)));

watch(selectedId, (id) => {
  if (!id) return;
  if (route.query.competition !== id) void router.replace({ query: { ...route.query, competition: id } });
  void table.run();
}, { immediate: true });
</script>

<template>
  <PageHeader
    title="Jornada y clasificación"
    :subtitle="table.data.value?.season ? `${table.data.value.season.competitionName} · ${table.data.value.season.label}` : undefined"
  >
    <template #actions>
      <SearchSelect
        v-if="groups.length > 0"
        v-model="selectedId"
        class="w-full sm:w-72"
        aria-label="Competición"
        placeholder="Elige una competición"
        :options="competitionOptions"
      />
    </template>
  </PageHeader>

  <Skeleton v-if="competitions.loading.value && !competitions.data.value" variant="table" :count="12" label="Cargando las competiciones…" />
  <Alert v-else-if="competitions.error.value" kind="error">{{ competitions.error.value }}</Alert>
  <Alert v-else-if="groups.length === 0" kind="warning">
    {{ season.isCurrent ? 'Todavía no hay ligas sincronizadas.' : `No hay ligas guardadas de la temporada ${season.selected?.label}.` }}
  </Alert>

  <div v-else class="grid items-start gap-6 lg:grid-cols-5">
    <!-- Jornada en curso (o la elegida) -->
    <MatchdayFixtures v-if="selectedId" :competition-id="selectedId" :highlight-team-ids="myTeamIds" class="lg:col-span-2" />

    <!-- Clasificación -->
    <div class="lg:col-span-3">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Clasificación</h2>
      <Skeleton v-if="table.loading.value && !table.data.value" variant="table" :count="12" label="Cargando la clasificación…" />
      <Alert v-else-if="table.error.value" kind="error">{{ table.error.value }}</Alert>
      <Alert v-else-if="table.data.value && table.data.value.standings.length === 0" kind="info">
        {{ table.data.value.notice ?? 'Todavía no hay partidos jugados esta temporada.' }}
      </Alert>

      <div v-else-if="table.data.value" :class="{ 'is-refreshing': table.loading.value }" :aria-busy="table.loading.value">
      <!-- Tu club siempre a la vista, aunque esté abajo en la tabla -->
      <RouterLink
        v-for="row in myRows"
        :key="`mine-${row.teamId}`"
        :to="{ name: 'team', params: { teamId: row.teamId } }"
        class="my-club-row mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-accent-400/40 px-4 py-3 text-sm hover:underline"
      >
        <MyClubBadge />
        <span class="flex min-w-0 items-center gap-2 font-semibold">
          <TeamCrest :src="row.crestUrl" :name="row.teamName" size="xs" />{{ row.teamName }}
        </span>
        <span class="ml-auto flex gap-4 tabular-nums text-slate-600">
          <span><strong class="text-slate-900">{{ row.position }}º</strong></span>
          <span><strong class="text-slate-900">{{ row.points }}</strong> pts</span>
          <span>{{ row.played }} PJ</span>
          <span>{{ row.won }}-{{ row.drawn }}-{{ row.lost }}</span>
        </span>
      </RouterLink>

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-2 py-2 text-left sm:px-3">#</th>
              <th class="px-3 py-2 text-left">Equipo</th>
              <th class="px-3 py-2 text-center">PJ</th>
              <th class="px-3 py-2 text-center">G</th>
              <th class="px-3 py-2 text-center">E</th>
              <th class="px-3 py-2 text-center">P</th>
              <th class="col-md px-3 py-2 text-center">GF</th>
              <th class="col-md px-3 py-2 text-center">GC</th>
              <th class="col-sm px-3 py-2 text-center">DG</th>
              <th class="px-3 py-2 text-center font-semibold">Pts</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="row in table.data.value.standings"
              :key="row.teamId"
              :class="isMine(row.teamId) ? 'my-club-row font-semibold' : 'hover:bg-slate-50'"
            >
              <td class="px-3 py-2 tabular-nums text-slate-500">{{ row.position }}</td>
              <td class="px-3 py-2">
                <RouterLink :to="{ name: 'team', params: { teamId: row.teamId } }" class="flex items-center gap-2 hover:text-accent-400 hover:underline">
                  <TeamCrest :src="row.crestUrl" :name="row.teamName" size="xs" />
                  {{ row.teamName }}
                  <MyClubBadge v-if="isMine(row.teamId)" />
                </RouterLink>
              </td>
              <td class="px-3 py-2 text-center tabular-nums">{{ row.played }}</td>
              <td class="px-3 py-2 text-center tabular-nums">{{ row.won }}</td>
              <td class="px-3 py-2 text-center tabular-nums">{{ row.drawn }}</td>
              <td class="px-3 py-2 text-center tabular-nums">{{ row.lost }}</td>
              <td class="col-md px-3 py-2 text-center tabular-nums">{{ row.goalsFor }}</td>
              <td class="col-md px-3 py-2 text-center tabular-nums">{{ row.goalsAgainst }}</td>
              <td class="col-sm px-3 py-2 text-center tabular-nums">{{ row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference }}</td>
              <td class="px-3 py-2 text-center font-semibold tabular-nums">{{ row.points }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="table.data.value.standings.length === 0" class="p-4 text-sm text-slate-500">El proveedor aún no publica clasificación para esta liga.</p>
      </div>
      </div>
    </div>
  </div>
</template>
