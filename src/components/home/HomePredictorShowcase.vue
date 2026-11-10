<script setup lang="ts">
import { computed, nextTick, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { palette } from '@/charts/theme';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { useHomeCompetition } from '@/composables/useHomeCompetition';
import type { LeaguePredictionDto, TeamPredictionDto } from '@/types/api';
import { rangeText, zoneRanges, zoneStyle } from '@/utils/zones';

/**
 * El previsor en la portada: el favorito al título y quién pelea por subir y por no bajar en la liga elegida, con la
 * última jornada jugada. Barras en CSS para no cargar ECharts aquí; el previsor completo está en la liga.
 */
const { options, selectedId, ready, select } = useHomeCompetition();

const data = shallowRef<LeaguePredictionDto | null>(null);
const fetching = ref(false);
const loading = computed(() => !ready.value || fetching.value);
// Las barras crecen desde cero cada vez que llegan datos nuevos.
const grown = ref(false);

watch(selectedId, async (id) => {
  if (!id) {
    data.value = null;
    return;
  }
  fetching.value = true;
  try {
    const result = await api.stats.prediction(id);
    if (selectedId.value !== id) return;
    grown.value = false;
    data.value = result;
    await nextTick();
    requestAnimationFrame(() => requestAnimationFrame(() => (grown.value = true)));
  } catch {
    if (selectedId.value === id) data.value = null;
  } finally {
    if (selectedId.value === id) fetching.value = false;
  }
}, { immediate: true });

const teams = computed(() => data.value?.teams ?? []);
const zones = computed(() => data.value?.zones ?? null);
const places = computed(() => zones.value?.places);
const ranges = computed(() => zoneRanges(places.value));
const hasRelegation = computed(() => (zones.value?.relegation.length ?? 0) > 0);

const top = (key: 'champion' | 'promotion' | 'relegation', count = 5) => [...teams.value].sort((a, b) => b[key] - a[key]).slice(0, count);
const favourite = computed<TeamPredictionDto | null>(() => top('champion', 1)[0] ?? null);

const promotionLabel = computed(() => {
  const list = places.value ?? [];
  if (list.length) return list.some((p) => p.kind === 'PromotionPlayoff') ? 'Ascenso o promoción' : 'Ascenso';
  return (zones.value?.promotion.length ?? 0) > 1 ? 'Ascenso o promoción' : 'Ascenso';
});

// Sin descenso (la última categoría), la segunda lista es la del título.
const columns = computed(() => [
  { key: 'promotion' as const, title: 'Pelean por subir', caption: `Probabilidad de ${promotionLabel.value.toLowerCase()}`, icon: 'arrow-trend-up', text: 'text-emerald-700', bar: palette.emerald, teams: top('promotion') },
  hasRelegation.value
    ? { key: 'relegation' as const, title: 'Pelean por no bajar', caption: 'Probabilidad de descenso', icon: 'arrow-trend-down', text: 'text-red-700', bar: palette.rose, teams: top('relegation') }
    : { key: 'champion' as const, title: 'Pelean por el título', caption: 'Probabilidad de acabar campeón', icon: 'trophy', text: 'text-amber-700', bar: palette.amber, teams: top('champion') },
]);

const percent = (value: number) =>
  `${(value * 100).toLocaleString('es-ES', { maximumFractionDigits: value > 0 && value < 0.01 ? 1 : 0 })} %`;
const width = (value: number) => (grown.value ? `${Math.max(value * 100, value > 0 ? 1.5 : 0)}%` : '0%');
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <header class="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 border-b border-line px-5 py-5 sm:px-6">
      <div class="min-w-0 max-w-2xl">
        <p class="eyebrow flex items-center gap-2"><Icon icon="chart-line" class="h-3 w-3" />Previsor de resultados</p>
        <h2 class="mt-2 text-balance text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">¿Quién sube y quién baja? Las cuentas, jornada a jornada.</h2>
        <p class="mt-2 text-sm text-slate-600">
          Con los resultados de cada jornada se mide la fuerza en ataque y en defensa de cada equipo y se juega el resto de la
          liga 10.000 veces. Las plazas de ascenso y descenso son las reales de cada liga.
        </p>
      </div>
      <div class="w-full sm:w-72">
        <SearchSelect
          v-if="options.length"
          :model-value="selectedId"
          :options="options"
          placeholder="Elige la liga"
          aria-label="Liga del previsor"
          @update:model-value="select($event as string | null)"
        />
      </div>
    </header>

    <div v-if="loading && !data" class="grid grid-cols-1 gap-6 p-5 sm:p-6 lg:grid-cols-3" aria-busy="true" aria-label="Calculando el previsor">
      <div v-for="column in 3" :key="column" class="space-y-3">
        <div class="h-3 w-32 animate-pulse rounded bg-surface-2" />
        <div v-for="row in 5" :key="row" class="h-7 animate-pulse rounded bg-surface-2" />
      </div>
    </div>

    <p v-else-if="!favourite" class="px-6 py-10 text-center text-sm text-slate-500">
      {{ data?.notice ?? 'Todavía no hay partidos jugados en esta liga: el previsor arranca con la primera jornada.' }}
    </p>

    <div v-else class="grid grid-cols-1 divide-y divide-line transition-opacity lg:grid-cols-3 lg:divide-x lg:divide-y-0" :class="fetching ? 'opacity-60' : ''">
      <div class="flex flex-col p-5 sm:p-6">
        <p class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <Icon icon="trophy" class="h-3 w-3 text-amber-700" />Favorito al título
        </p>
        <RouterLink :to="{ name: 'team', params: { teamId: favourite.teamId } }" class="group mt-4 flex items-center gap-3">
          <TeamCrest :src="favourite.crestUrl" :name="favourite.teamName" :short-name="favourite.shortName" size="lg" />
          <span class="min-w-0">
            <span class="block truncate text-lg font-bold text-slate-900 group-hover:text-accent-400">{{ favourite.teamName }}</span>
            <span class="block text-xs text-slate-500">{{ favourite.position }}.º con {{ favourite.points }} puntos en {{ favourite.played }} partidos</span>
          </span>
        </RouterLink>
        <p class="mt-6 font-figures text-6xl font-extrabold leading-none tracking-tight text-amber-700">{{ percent(favourite.champion) }}</p>
        <p class="mt-2 text-sm text-slate-600">
          de acabar campeón · <strong class="font-semibold text-emerald-700">{{ percent(favourite.promotion) }}</strong> de {{ promotionLabel.toLowerCase() }}
        </p>
        <dl class="mt-6 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
          <div>
            <dt class="text-[11px] uppercase tracking-wide text-slate-500">Jornada</dt>
            <dd class="font-figures text-xl font-extrabold text-slate-900">{{ data?.matchday }}<span class="text-sm font-semibold text-slate-400">/{{ data?.totalMatchdays }}</span></dd>
          </div>
          <div>
            <dt class="text-[11px] uppercase tracking-wide text-slate-500">Jugados</dt>
            <dd class="font-figures text-xl font-extrabold text-slate-900">{{ data?.knownMatches }}</dd>
          </div>
          <div>
            <dt class="text-[11px] uppercase tracking-wide text-slate-500">Por jugar</dt>
            <dd class="font-figures text-xl font-extrabold text-slate-900">{{ data?.simulatedMatches }}</dd>
          </div>
        </dl>
        <span class="lg:flex-1" aria-hidden="true" />
        <RouterLink :to="{ name: 'league', query: { competition: selectedId ?? undefined, vista: 'previsor' } }" class="btn-primary mt-6 w-full">
          Abrir el previsor completo <Icon icon="chevron-right" class="h-3 w-3" />
        </RouterLink>
      </div>

      <div v-for="column in columns" :key="column.key" class="p-5 sm:p-6">
        <h3 class="flex items-center gap-2 text-base font-bold text-slate-900">
          <Icon :icon="column.icon" class="h-4 w-4" :class="column.text" />{{ column.title }}
        </h3>
        <p class="mt-0.5 text-xs text-slate-500">{{ column.caption }}</p>
        <ol class="mt-5 space-y-4">
          <li v-for="team in column.teams" :key="team.teamId">
            <RouterLink :to="{ name: 'team', params: { teamId: team.teamId } }" class="group block" :title="`${team.teamName}: ${team.position}.º, ${team.points} puntos`">
              <span class="flex items-center gap-2.5 text-sm">
                <span
                  class="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-surface-2 font-figures text-xs font-bold text-slate-600"
                  :style="zoneStyle(places, team.position)"
                >{{ team.position }}</span>
                <TeamCrest :src="team.crestUrl" :name="team.teamName" :short-name="team.shortName" size="xs" />
                <span class="min-w-0 flex-1 truncate font-medium text-slate-700 group-hover:text-slate-900">{{ team.teamName }}</span>
                <span class="shrink-0 font-figures font-bold tabular-nums" :class="column.text">{{ percent(team[column.key]) }}</span>
              </span>
              <span class="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-2">
                <span
                  class="block h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  :style="{ width: width(team[column.key]), background: column.bar }"
                />
              </span>
            </RouterLink>
          </li>
        </ol>
      </div>
    </div>

    <footer v-if="favourite && zones" class="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-xs sm:px-6">
      <template v-if="ranges.length">
        <span
          v-for="range in ranges"
          :key="`${range.label}-${range.from}`"
          class="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1.5 pr-3 text-slate-700 ring-1 ring-line"
        >
          <span class="h-3 w-3 rounded-full ring-1 ring-black/10" :style="{ background: range.color }" />{{ range.label }}: {{ rangeText(range) }}
        </span>
        <span class="text-slate-500">Plazas de la clasificación en futbolasturiano.es · {{ data?.simulations.toLocaleString('es-ES') }} simulaciones</span>
      </template>
      <span v-else class="text-slate-500">Plazas aproximadas: la liga todavía no las publica · {{ data?.simulations.toLocaleString('es-ES') }} simulaciones</span>
    </footer>
  </section>
</template>
