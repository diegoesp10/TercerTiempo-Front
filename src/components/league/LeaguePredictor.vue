<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useMediaQuery } from '@vueuse/core';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import AppChart from '@/components/charts/AppChart.vue';
import PredictionList from '@/components/league/PredictionList.vue';
import TeamForecast from '@/components/league/TeamForecast.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import Alert from '@/components/ui/Alert.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import {
  metricColors,
  metricLabels,
  percent as pct,
  positionHeatmapOption,
  predictionBarsOption,
  predictionEvolutionOption,
  type PredictionMetric,
} from '@/charts/predictions';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import type { LeaguePredictionDto, LeaguePredictionEvolutionDto, TeamPredictionDto } from '@/types/api';
import { rangeText, zoneRanges } from '@/utils/zones';

/**
 * Previsor de resultados: probabilidad de cada equipo de ser campeón, acabar en ascenso o promoción y descender, con lo
 * que se sabía en la jornada elegida. Es una estimación matemática, solo para ver: la fuerza de ataque y defensa de cada
 * equipo sale de sus goles hasta esa jornada y el resto de la liga se juega miles de veces. Público y sin token.
 */
const props = defineProps<{ competitionId: string; highlightTeamIds?: string[] }>();
const settings = useSettingsStore();
const auth = useAuthStore();
// En pantallas estrechas el gráfico de barras agrupadas no cabe: se cambia por una lista (PredictionList).
const wide = useMediaQuery('(min-width: 768px)');

const matchday = ref<number | null>(null);
const data = shallowRef<LeaguePredictionDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let latest = 0;

async function load() {
  const call = ++latest;
  loading.value = true;
  error.value = null;
  try {
    const result = await api.stats.prediction(props.competitionId, matchday.value);
    if (call !== latest) return;
    data.value = result;
    if (matchday.value === null && result.matchday !== null) matchday.value = result.matchday;
  } catch (e) {
    if (call === latest) error.value = errorMessage(e);
  } finally {
    if (call === latest) loading.value = false;
  }
}

// La evolución (todas las jornadas) se pide aparte: tarda más y no cambia al elegir jornada.
const evolution = shallowRef<LeaguePredictionEvolutionDto | null>(null);
const metric = ref<PredictionMetric>('champion');
async function loadEvolution() {
  const competition = props.competitionId;
  evolution.value = null;
  try {
    const result = await api.stats.predictionEvolution(competition);
    if (competition === props.competitionId) evolution.value = result;
  } catch {
    evolution.value = null;
  }
}

watch(() => props.competitionId, () => {
  matchday.value = null;
  data.value = null;
  void load();
  void loadEvolution();
}, { immediate: true });
watch(matchday, (value, old) => {
  if (old !== null && value !== null && value !== data.value?.matchday) void load();
});

const zones = computed(() => data.value?.zones ?? null);
const teams = computed(() => data.value?.teams ?? []);
const highlighted = computed(() => props.highlightTeamIds ?? []);
const isMine = (team: TeamPredictionDto) => highlighted.value.includes(team.teamId);
const myTeams = computed(() => teams.value.filter(isMine));
const myTitle = computed(() => (auth.isClub ? 'Tu club' : 'Tu equipo'));
const num = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 1 });

const favourite = computed(() => [...teams.value].sort((a, b) => b.champion - a.champion)[0] ?? null);
const promotionPick = computed(() => [...teams.value].filter((t) => t.teamId !== favourite.value?.teamId).sort((a, b) => b.promotion - a.promotion)[0] ?? null);
const danger = computed(() => (zones.value?.relegation.length ? [...teams.value].sort((a, b) => b.relegation - a.relegation)[0] ?? null : null));
// «Ascenso» si la liga solo tiene ascenso directo; «Ascenso o promoción» si además hay promoción de ascenso.
const promotionLabel = computed(() => {
  const places = zones.value?.places ?? [];
  if (places.length) return places.some((p) => p.kind === 'PromotionPlayoff') ? 'Ascenso o promoción' : 'Ascenso';
  return (zones.value?.promotion.length ?? 0) > 1 ? 'Ascenso o promoción' : 'Ascenso';
});
const labels = computed(() => ({ ...metricLabels, promotion: promotionLabel.value }));
const ranges = computed(() => zoneRanges(zones.value?.places));
const matchdayOptions = computed(() => {
  const days = data.value?.matchdays ?? [];
  return [...days].reverse().map((day) => ({ value: day, label: `Jornada ${day}${day === days.at(-1) ? ' (la última)' : ''}` }));
});
const span = (positions: number[]) => (positions.length === 1 ? `${positions[0]}.º` : `${positions[0]}.º–${positions.at(-1)}.º`);

const barsOption = computed(() => (zones.value && teams.value.length ? predictionBarsOption(teams.value, zones.value, settings.resolvedTheme, labels.value) : null));
const heatmapOption = computed(() =>
  zones.value && teams.value.length ? positionHeatmapOption(teams.value, zones.value, settings.resolvedTheme, wide.value ? 150 : 92) : null);
// Ancho mínimo del mapa de puestos: una casilla legible por puesto más la columna de nombres; lo que no quepa se desplaza.
const heatmapWidth = computed(() => `${(zones.value?.teams ?? 20) * 28 + (wide.value ? 170 : 104)}px`);
const metrics = computed<PredictionMetric[]>(() => (zones.value?.relegation.length ? ['champion', 'promotion', 'relegation'] : ['champion', 'promotion']));
const evolutionOption = computed(() =>
  evolution.value && evolution.value.teams.length && evolution.value.matchdays.length > 1
    ? predictionEvolutionOption(evolution.value, metric.value, highlighted.value, settings.resolvedTheme)
    : null);
</script>

<template>
  <div class="space-y-6">
    <section class="card overflow-hidden">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="max-w-3xl">
          <p class="eyebrow flex items-center gap-1.5"><Icon icon="chart-line" class="h-3 w-3" />Previsor de resultados</p>
          <h2 class="mt-1 text-xl font-bold text-slate-900">¿Quién gana la liga, quién asciende y quién baja?</h2>
          <p class="mt-1 text-sm text-slate-500">
            Una estimación matemática, solo informativa: con los resultados hasta la jornada elegida se calcula la fuerza de ataque y de defensa
            de cada equipo (y la ventaja de jugar en casa) y se juega el resto de la liga {{ data?.simulations ? data.simulations.toLocaleString('es-ES') : 'miles de' }} veces.
          </p>
        </div>
        <div v-if="data && data.matchdays.length" class="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
          <span class="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-500">Con los datos de la</span>
          <SearchSelect
            class="w-full sm:w-48"
            size="sm"
            :model-value="matchday ?? data.matchday"
            :options="matchdayOptions"
            aria-label="Jornada del previsor"
            @update:model-value="matchday = ($event as number | null)"
          />
        </div>
      </div>

      <div v-if="data?.matchday && zones" class="mt-4 flex flex-wrap items-center gap-2 text-xs">
        <span class="rounded-full bg-surface-2 px-3 py-1 text-slate-600 ring-1 ring-line">{{ data.knownMatches }} partidos jugados hasta la jornada {{ data.matchday }}</span>
        <span class="rounded-full bg-surface-2 px-3 py-1 text-slate-600 ring-1 ring-line">{{ data.simulatedMatches }} por jugar, simulados</span>
        <template v-if="ranges.length">
          <span v-for="range in ranges" :key="`${range.label}-${range.from}`" class="flex items-center gap-1.5 rounded-full bg-surface-2 py-1 pl-1.5 pr-3 text-slate-700 ring-1 ring-line">
            <span class="h-3 w-3 rounded-full ring-1 ring-black/10" :style="{ background: range.color }" />{{ range.label }}: {{ rangeText(range) }}
          </span>
          <span class="text-slate-500">Plazas de la clasificación de la liga en futbolasturiano.es.</span>
        </template>
        <template v-else>
          <span class="rounded-full px-3 py-1 font-semibold ring-1" :style="{ color: metricColors.promotion }">{{ promotionLabel }}: {{ span(zones.promotion) }}</span>
          <span v-if="zones.relegation.length" class="rounded-full px-3 py-1 font-semibold ring-1" :style="{ color: metricColors.relegation }">Descenso: {{ span(zones.relegation) }}</span>
          <span class="text-slate-500">Plazas aproximadas: la liga todavía no las publica.</span>
        </template>
      </div>
    </section>

    <Skeleton v-if="loading && !data" variant="table" :count="10" label="Simulando el resto de la liga…" />
    <Alert v-else-if="error" kind="error">{{ error }}</Alert>
    <Alert v-else-if="data && data.notice" kind="info">{{ data.notice }}</Alert>

    <template v-else-if="data && zones">
      <TeamForecast
        v-for="team in myTeams"
        :key="team.teamId"
        :team="team"
        :zones="zones"
        :labels="labels"
        :title="myTitle"
        :class="{ 'is-refreshing': loading }"
      />

      <p v-if="myTeams.length" class="eyebrow -mb-3 pt-2">Toda la liga</p>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3" :class="{ 'is-refreshing': loading }">
        <article v-if="favourite" class="card border-t-[3px]" :style="{ borderTopColor: metricColors.champion }">
          <p class="text-xs font-semibold uppercase tracking-wide" :style="{ color: metricColors.champion }"><Icon icon="trophy" class="mr-1 h-3 w-3" />Favorito al título</p>
          <div class="mt-2 flex items-center gap-3">
            <TeamCrest :src="favourite.crestUrl" :name="favourite.teamName" :short-name="favourite.shortName" size="lg" />
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-900">{{ favourite.teamName }}</p>
              <p class="font-figures text-3xl font-extrabold text-slate-900">{{ pct(favourite.champion) }}</p>
            </div>
          </div>
          <p class="mt-1 text-xs text-slate-500">Ahora {{ favourite.position }}.º con {{ favourite.points }} pts · acabaría con unos {{ num(favourite.expectedPoints) }}</p>
        </article>
        <article v-if="promotionPick" class="card border-t-[3px]" :style="{ borderTopColor: metricColors.promotion }">
          <p class="text-xs font-semibold uppercase tracking-wide" :style="{ color: metricColors.promotion }"><Icon icon="arrow-trend-up" class="mr-1 h-3 w-3" />{{ promotionLabel }}</p>
          <div class="mt-2 flex items-center gap-3">
            <TeamCrest :src="promotionPick.crestUrl" :name="promotionPick.teamName" :short-name="promotionPick.shortName" size="lg" />
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-900">{{ promotionPick.teamName }}</p>
              <p class="font-figures text-3xl font-extrabold text-slate-900">{{ pct(promotionPick.promotion) }}</p>
            </div>
          </div>
          <p class="mt-1 text-xs text-slate-500">El más probable en {{ promotionLabel.toLowerCase() }} después del favorito</p>
        </article>
        <article v-if="danger" class="card border-t-[3px]" :style="{ borderTopColor: metricColors.relegation }">
          <p class="text-xs font-semibold uppercase tracking-wide" :style="{ color: metricColors.relegation }"><Icon icon="arrow-trend-down" class="mr-1 h-3 w-3" />Más riesgo de descenso</p>
          <div class="mt-2 flex items-center gap-3">
            <TeamCrest :src="danger.crestUrl" :name="danger.teamName" :short-name="danger.shortName" size="lg" />
            <div class="min-w-0">
              <p class="truncate font-semibold text-slate-900">{{ danger.teamName }}</p>
              <p class="font-figures text-3xl font-extrabold text-slate-900">{{ pct(danger.relegation) }}</p>
            </div>
          </div>
          <p class="mt-1 text-xs text-slate-500">Ahora {{ danger.position }}.º con {{ danger.points }} pts</p>
        </article>
      </div>

      <section class="card" :class="{ 'is-refreshing': loading }">
        <h3 class="font-semibold text-slate-900">Probabilidades de cada equipo</h3>
        <p class="text-xs text-slate-500">
          Ordenados por el puesto final esperado.<template v-if="wide"> Pasa por encima de un equipo para ver sus puntos esperados.</template>
        </p>
        <AppChart v-if="barsOption && wide" class="mt-3" :option="barsOption" :height="teams.length * 34 + 60" label="Probabilidad de cada equipo de ser campeón, ascender o promocionar y descender" />
        <PredictionList v-else-if="!wide" :teams="teams" :metrics="metrics" :labels="labels" :highlight-team-ids="highlighted" />
      </section>

      <section class="card" :class="{ 'is-refreshing': loading }">
        <h3 class="font-semibold text-slate-900">¿En qué puesto acabará cada uno?</h3>
        <p class="text-xs text-slate-500">
          Probabilidad de cada puesto final (en %). Los puestos van con el color de su plaza<template v-if="!ranges.length"> (en verde, {{ promotionLabel.toLowerCase() }}<template v-if="zones.relegation.length">; en rojo, descenso</template>)</template>.
        </p>
        <p v-if="!wide" class="mt-1 text-xs text-slate-500">Desliza a los lados para ver todos los puestos.</p>
        <div class="mt-3 overflow-x-auto">
          <div :style="{ minWidth: heatmapWidth }">
            <AppChart v-if="heatmapOption" :option="heatmapOption" :height="teams.length * 30 + 120" label="Probabilidad de cada puesto final por equipo" />
          </div>
        </div>
      </section>

      <section class="card">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 class="font-semibold text-slate-900">Cómo ha cambiado, jornada a jornada</h3>
            <p class="text-xs text-slate-500">Cada punto es la previsión con los datos de esa jornada. Toca un equipo en la leyenda para mostrarlo u ocultarlo.</p>
          </div>
          <div class="inline-flex rounded-full border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Qué probabilidad">
            <button
              v-for="option in metrics"
              :key="option"
              type="button"
              role="radio"
              :aria-checked="metric === option"
              class="rounded-full px-3 py-1 text-xs font-semibold transition"
              :class="metric === option ? 'text-white' : 'text-slate-600 hover:text-slate-900'"
              :style="metric === option ? { background: metricColors[option] } : undefined"
              @click="metric = option"
            >{{ labels[option] }}</button>
          </div>
        </div>
        <AppChart v-if="evolutionOption" class="mt-3" :option="evolutionOption" :height="360" :label="`Evolución de la probabilidad de ${labels[metric].toLowerCase()} por jornada`" />
        <p v-else-if="evolution && evolution.matchdays.length <= 1" class="mt-3 text-sm text-slate-500">Hará falta más de una jornada con resultados para ver la evolución.</p>
        <Skeleton v-else variant="table" :count="4" label="Simulando cada jornada…" class="mt-3" />
      </section>

      <section class="card overflow-hidden p-0" :class="{ 'is-refreshing': loading }">
        <h3 class="px-4 pt-4 font-semibold text-slate-900">En números</h3>
        <div class="mt-3 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="border-y border-line bg-surface-2 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="sticky left-0 z-10 bg-surface-2 px-3 py-2 text-left">Equipo</th>
                <th class="px-3 py-2 text-center" title="Puesto en la jornada elegida">Ahora</th>
                <th class="px-3 py-2 text-center">Pts</th>
                <th class="px-3 py-2 text-center" title="Puntos al final de la liga, de media">Pts final</th>
                <th class="px-3 py-2 text-center" title="Puesto final medio">Puesto final</th>
                <th v-for="option in metrics" :key="option" class="px-3 py-2 text-center" :style="{ color: metricColors[option] }">{{ labels[option] }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="team in teams" :key="team.teamId" :class="{ 'my-club-row': isMine(team) }">
                <!-- Columna fija al desplazar la tabla en el móvil: necesita un fondo opaco (el de su fila, mezclado). -->
                <td
                  class="sticky left-0 z-10 px-3 py-2"
                  :class="isMine(team) ? 'bg-[color-mix(in_srgb,var(--color-brand-500)_15%,var(--color-surface))]' : 'bg-surface'"
                >
                  <RouterLink :to="{ name: 'team', params: { teamId: team.teamId } }" class="flex items-center gap-2 font-medium text-slate-900 hover:text-accent-400">
                    <TeamCrest :src="team.crestUrl" :name="team.teamName" :short-name="team.shortName" size="xs" />
                    <span class="max-w-[8.5rem] truncate sm:max-w-none">{{ team.teamName }}</span>
                  </RouterLink>
                </td>
                <td class="px-3 py-2 text-center font-figures">{{ team.position }}.º</td>
                <td class="px-3 py-2 text-center font-figures">{{ team.points }}</td>
                <td class="px-3 py-2 text-center font-figures">{{ num(team.expectedPoints) }}</td>
                <td class="px-3 py-2 text-center font-figures">{{ num(team.expectedPosition) }}.º</td>
                <td v-for="option in metrics" :key="option" class="px-3 py-2">
                  <div class="flex items-center gap-2">
                    <div class="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                      <div class="h-full rounded-full" :style="{ width: `${team[option] * 100}%`, background: metricColors[option] }" />
                    </div>
                    <span class="w-12 text-right font-figures text-xs font-semibold text-slate-800">{{ pct(team[option]) }}</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>
