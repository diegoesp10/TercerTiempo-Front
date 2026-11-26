<script setup lang="ts">
import { computed, defineAsyncComponent, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import MatchdayFixtures from '@/components/matches/MatchdayFixtures.vue';
import Alert from '@/components/ui/Alert.vue';
import ResponsiveTabs from '@/components/ui/ResponsiveTabs.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import MyClubBadge from '@/components/teams/MyClubBadge.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { useAsync } from '@/composables/useAsync';
import { useMyClub } from '@/composables/useMyClub';
import { useSort } from '@/composables/useSort';
import type { StandingDto } from '@/types/api';
import { groupByLevel } from '@/utils/format';
import { competitionOptions as optionsFor } from '@/utils/territories';
import { useSeasonStore } from '@/stores/season';
import { rangeText, zoneRanges, zoneStyle } from '@/utils/zones';

// El previsor (con sus gráficos) solo se descarga al abrir su pestaña: la clasificación no lo necesita.
const LeaguePredictor = defineAsyncComponent(() => import('@/components/league/LeaguePredictor.vue'));

const season = useSeasonStore();

const route = useRoute();
const router = useRouter();

const competitions = useAsync(() => api.competitions.list());
const groups = computed(() => groupByLevel(competitions.data.value ?? []));

const { preferredCompetition, withMyClubFirst, isMine, myTeamIds } = useMyClub();

/** Opciones del desplegable: una por competición, agrupadas por ámbito (Nacional, Asturias…), con las de tu club arriba. */
const competitionOptions = computed(() => withMyClubFirst(optionsFor(competitions.data.value ?? [])));

const selectedId = ref<string | null>(typeof route.query.competition === 'string' ? route.query.competition : null);

watch(competitions.data, (list) => {
  if (!list || list.length === 0) return;
  if (selectedId.value && list.some((c) => c.id === selectedId.value)) return;
  selectedId.value = preferredCompetition(list) ?? list.find((c) => c.level === 'National')?.id ?? list[0]?.id ?? null;
});

// Dos vistas de la liga elegida: la jornada con la clasificación y el previsor de resultados (?vista=previsor).
type LeagueTab = 'clasificacion' | 'previsor';
const tabs: { value: LeagueTab; label: string; icon: string }[] = [
  { value: 'clasificacion', label: 'Jornada y clasificación', icon: 'table-list' },
  { value: 'previsor', label: 'Previsor de resultados', icon: 'chart-line' },
];
const tab = computed<LeagueTab>(() => (route.query.vista === 'previsor' ? 'previsor' : 'clasificacion'));
function showTab(value: LeagueTab) {
  void router.replace({ query: { ...route.query, vista: value === 'previsor' ? 'previsor' : undefined } });
}

const table = useAsync(() => api.stats.leagueTable(selectedId.value), { immediate: false });
const myRows = computed(() => (table.data.value?.standings ?? []).filter((row) => isMine(row.teamId)));
// Los puestos de ascenso, promoción y descenso, con los colores de la clasificación de la liga en futbolasturiano.es.
const zones = computed(() => table.data.value?.zones ?? []);
const ranges = computed(() => zoneRanges(zones.value));

const standings = computed(() => table.data.value?.standings ?? []);
type StandingKey = 'position' | 'team' | 'played' | 'won' | 'drawn' | 'lost' | 'goalsFor' | 'goalsAgainst' | 'goalDifference' | 'points';
const standingGetters: Record<StandingKey, (row: StandingDto) => number | string> = {
  position: (r) => r.position,
  team: (r) => r.teamName,
  played: (r) => r.played,
  won: (r) => r.won,
  drawn: (r) => r.drawn,
  lost: (r) => r.lost,
  goalsFor: (r) => r.goalsFor,
  goalsAgainst: (r) => r.goalsAgainst,
  goalDifference: (r) => r.goalDifference,
  points: (r) => r.points,
};
const { sorted: sortedStandings, sortBy, state } = useSort<StandingDto, StandingKey>(standings, standingGetters, 'position', {
  desc: false,
  ascendingFirst: ['position', 'team'],
});

watch(selectedId, (id) => {
  if (!id) return;
  if (route.query.competition !== id) void router.replace({ query: { ...route.query, competition: id } });
  void table.run();
}, { immediate: true });
</script>

<template>
  <PageHeader
    :title="tab === 'previsor' ? 'Previsor de resultados' : 'Jornada y clasificación'"
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

  <template v-else>
  <ResponsiveTabs
    :items="tabs.map((item) => ({ key: item.value, label: item.label, icon: item.icon }))"
    :model-value="tab"
    label="Vista de la liga"
    variant="pills"
    class="mb-6"
    @update:model-value="(key) => showTab(key as LeagueTab)"
  />

  <LeaguePredictor v-if="tab === 'previsor' && selectedId" :competition-id="selectedId" :highlight-team-ids="myTeamIds" />

  <div v-else class="grid grid-cols-1 items-start gap-6 lg:grid-cols-5">
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
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr>
              <SortHeader class="px-2 py-2 text-left max-[360px]:px-1 sm:px-3" label="#" title="Posición" v-bind="state('position')" @sort="sortBy('position')" />
              <SortHeader class="px-2 py-2 text-left max-[360px]:px-1 sm:px-3" label="Equipo" v-bind="state('team')" @sort="sortBy('team')" />
              <SortHeader class="px-2 py-2 text-center max-[360px]:px-1 sm:px-3" label="PJ" title="Partidos jugados" v-bind="state('played')" @sort="sortBy('played')" />
              <SortHeader class="col-sm px-3 py-2 text-center" label="G" title="Ganados" v-bind="state('won')" @sort="sortBy('won')" />
              <SortHeader class="col-sm px-3 py-2 text-center" label="E" title="Empatados" v-bind="state('drawn')" @sort="sortBy('drawn')" />
              <SortHeader class="col-sm px-3 py-2 text-center" label="P" title="Perdidos" v-bind="state('lost')" @sort="sortBy('lost')" />
              <SortHeader class="col-md px-3 py-2 text-center" label="GF" title="Goles a favor" v-bind="state('goalsFor')" @sort="sortBy('goalsFor')" />
              <SortHeader class="col-md px-3 py-2 text-center" label="GC" title="Goles en contra" v-bind="state('goalsAgainst')" @sort="sortBy('goalsAgainst')" />
              <SortHeader class="col-xs px-2 py-2 text-center sm:px-3" label="DG" title="Diferencia de goles" v-bind="state('goalDifference')" @sort="sortBy('goalDifference')" />
              <SortHeader class="px-2 py-2 text-center font-semibold max-[360px]:px-1 sm:px-3" label="Pts" title="Puntos" v-bind="state('points')" @sort="sortBy('points')" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr
              v-for="row in sortedStandings"
              :key="row.teamId"
              :class="isMine(row.teamId) ? 'my-club-row font-semibold' : 'hover:bg-slate-50'"
            >
              <td class="px-2 py-1.5 max-[360px]:px-1 sm:px-3">
                <span
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold tabular-nums"
                  :class="zoneStyle(zones, row.position) ? '' : 'text-slate-500'"
                  :style="zoneStyle(zones, row.position)"
                  :title="zones.find((z) => z.position === row.position)?.label"
                >{{ row.position }}</span>
              </td>
              <td class="px-2 py-2 max-[360px]:px-1 sm:px-3">
                <RouterLink :to="{ name: 'team', params: { teamId: row.teamId } }" class="flex items-center gap-2 wrap-anywhere hover:text-accent-400 hover:underline">
                  <TeamCrest :src="row.crestUrl" :name="row.teamName" size="xs" />
                  {{ row.teamName }}
                  <MyClubBadge v-if="isMine(row.teamId)" />
                </RouterLink>
              </td>
              <td class="px-2 py-2 text-center tabular-nums max-[360px]:px-1 sm:px-3">{{ row.played }}</td>
              <td class="col-sm px-3 py-2 text-center tabular-nums">{{ row.won }}</td>
              <td class="col-sm px-3 py-2 text-center tabular-nums">{{ row.drawn }}</td>
              <td class="col-sm px-3 py-2 text-center tabular-nums">{{ row.lost }}</td>
              <td class="col-md px-3 py-2 text-center tabular-nums">{{ row.goalsFor }}</td>
              <td class="col-md px-3 py-2 text-center tabular-nums">{{ row.goalsAgainst }}</td>
              <td class="col-xs px-2 py-2 text-center tabular-nums sm:px-3">{{ row.goalDifference > 0 ? `+${row.goalDifference}` : row.goalDifference }}</td>
              <td class="px-2 py-2 text-center font-semibold tabular-nums max-[360px]:px-1 sm:px-3">{{ row.points }}</td>
            </tr>
          </tbody>
        </table>
        <p v-if="table.data.value.standings.length === 0" class="p-4 text-sm text-slate-500">El proveedor aún no publica clasificación para esta liga.</p>
      </div>
      <ul v-if="ranges.length" class="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-600" aria-label="Plazas de la liga">
        <li v-for="range in ranges" :key="`${range.label}-${range.from}`" class="flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-sm ring-1 ring-black/10" :style="{ background: range.color }" />{{ range.label }} ({{ rangeText(range) }})
        </li>
      </ul>
      </div>
    </div>
  </div>
  </template>
</template>
