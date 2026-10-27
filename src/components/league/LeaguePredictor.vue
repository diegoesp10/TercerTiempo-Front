<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import AppChart from '@/components/charts/AppChart.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import Alert from '@/components/ui/Alert.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import {
  metricColors,
  metricLabels,
  positionHeatmapOption,
  predictionBarsOption,
  predictionEvolutionOption,
  type PredictionMetric,
} from '@/charts/predictions';
import { useSettingsStore } from '@/stores/settings';
import type { LeaguePredictionDto, LeaguePredictionEvolutionDto, TeamPredictionDto } from '@/types/api';

/**
 * Previsor de resultados: probabilidad de cada equipo de ser campeón, acabar en ascenso o promoción y descender, con lo
 * que se sabía en la jornada elegida. Es una estimación matemática, solo para ver: la fuerza de ataque y defensa de cada
 * equipo sale de sus goles hasta esa jornada y el resto de la liga se juega miles de veces. Público y sin token.
 */
const props = defineProps<{ competitionId: string; highlightTeamIds?: string[] }>();
const settings = useSettingsStore();

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
const pct = (value: number) => `${(value * 100).toLocaleString('es-ES', { maximumFractionDigits: value > 0 && value < 0.01 ? 1 : 0 })} %`;
const num = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 1 });

const favourite = computed(() => [...teams.value].sort((a, b) => b.champion - a.champion)[0] ?? null);
const promotionPick = computed(() => [...teams.value].filter((t) => t.teamId !== favourite.value?.teamId).sort((a, b) => b.promotion - a.promotion)[0] ?? null);
const danger = computed(() => (zones.value?.relegationFrom ? [...teams.value].sort((a, b) => b.relegation - a.relegation)[0] ?? null : null));
const promotionLabel = computed(() => (zones.value?.promotionUntil === 1 ? 'Ascenso' : 'Ascenso o promoción'));

const barsOption = computed(() => (zones.value && teams.value.length ? predictionBarsOption(teams.value, zones.value, settings.resolvedTheme) : null));
const heatmapOption = computed(() => (zones.value && teams.value.length ? positionHeatmapOption(teams.value, zones.value, settings.resolvedTheme) : null));
const metrics = computed<PredictionMetric[]>(() => (zones.value?.relegationFrom ? ['champion', 'promotion', 'relegation'] : ['champion', 'promotion']));
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
        <div v-if="data && data.matchdays.length" class="flex items-center gap-2">
          <label class="text-xs font-semibold uppercase tracking-wide text-slate-500" for="predictor-matchday">Con los datos de la</label>
          <select id="predictor-matchday" v-model.number="matchday" class="input w-auto py-1.5 text-sm font-semibold">
            <option v-for="day in [...data.matchdays].reverse()" :key="day" :value="day">
              Jornada {{ day }}{{ day === data.matchdays.at(-1) ? ' (la última)' : '' }}
            </option>
          </select>
        </div>
      </div>

      <div v-if="data?.matchday && zones" class="mt-4 flex flex-wrap gap-2 text-xs">
        <span class="rounded-full bg-surface-2 px-3 py-1 text-slate-600 ring-1 ring-line">{{ data.knownMatches }} partidos jugados hasta la jornada {{ data.matchday }}</span>
        <span class="rounded-full bg-surface-2 px-3 py-1 text-slate-600 ring-1 ring-line">{{ data.simulatedMatches }} por jugar, simulados</span>
        <span class="rounded-full px-3 py-1 font-semibold ring-1" :style="{ color: metricColors.promotion, borderColor: metricColors.promotion }">
          {{ promotionLabel }}: {{ zones.promotionUntil === 1 ? '1.º' : `1.º–${zones.promotionUntil}.º` }}
        </span>
        <span v-if="zones.relegationFrom" class="rounded-full px-3 py-1 font-semibold ring-1" :style="{ color: metricColors.relegation }">
          Descenso: {{ zones.relegationFrom }}.º–{{ zones.teams }}.º
        </span>
        <span class="self-center text-slate-500">Plazas habituales de la categoría; pueden variar con los arrastres.</span>
      </div>
    </section>

    <Skeleton v-if="loading && !data" variant="table" :count="10" label="Simulando el resto de la liga…" />
    <Alert v-else-if="error" kind="error">{{ error }}</Alert>
    <Alert v-else-if="data && data.notice" kind="info">{{ data.notice }}</Alert>

    <template v-else-if="data && zones">
      <div class="grid grid-cols-1 gap-4 md:grid-cols-3" :class="{ 'is-refreshing': loading }">
        <article v-if="favourite" class="card relative overflow-hidden">
          <div class="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl" :style="{ background: metricColors.champion }" />
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
        <article v-if="promotionPick" class="card relative overflow-hidden">
          <div class="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl" :style="{ background: metricColors.promotion }" />
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
        <article v-if="danger" class="card relative overflow-hidden">
          <div class="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-20 blur-2xl" :style="{ background: metricColors.relegation }" />
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
        <p class="text-xs text-slate-500">Ordenados por el puesto final esperado. Pasa por encima de un equipo para ver sus puntos esperados.</p>
        <AppChart v-if="barsOption" class="mt-3" :option="barsOption" :height="teams.length * 34 + 60" label="Probabilidad de cada equipo de ser campeón, ascender o promocionar y descender" />
      </section>

      <section class="card" :class="{ 'is-refreshing': loading }">
        <h3 class="font-semibold text-slate-900">¿En qué puesto acabará cada uno?</h3>
        <p class="text-xs text-slate-500">
          Probabilidad de cada puesto final (en %). En verde, {{ promotionLabel.toLowerCase() }}<template v-if="zones.relegationFrom">; en rojo, descenso</template>.
        </p>
        <div class="mt-3 overflow-x-auto">
          <div class="min-w-[680px]">
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
            >{{ metricLabels[option] }}</button>
          </div>
        </div>
        <AppChart v-if="evolutionOption" class="mt-3" :option="evolutionOption" :height="360" :label="`Evolución de la probabilidad de ${metricLabels[metric].toLowerCase()} por jornada`" />
        <p v-else-if="evolution && evolution.matchdays.length <= 1" class="mt-3 text-sm text-slate-500">Hará falta más de una jornada con resultados para ver la evolución.</p>
        <Skeleton v-else variant="table" :count="4" label="Simulando cada jornada…" class="mt-3" />
      </section>

      <section class="card overflow-hidden p-0" :class="{ 'is-refreshing': loading }">
        <h3 class="px-4 pt-4 font-semibold text-slate-900">En números</h3>
        <div class="mt-3 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="border-y border-line bg-surface-2 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left">Equipo</th>
                <th class="px-3 py-2 text-center" title="Puesto en la jornada elegida">Ahora</th>
                <th class="px-3 py-2 text-center">Pts</th>
                <th class="px-3 py-2 text-center" title="Puntos al final de la liga, de media">Pts final</th>
                <th class="px-3 py-2 text-center" title="Puesto final medio">Puesto final</th>
                <th v-for="option in metrics" :key="option" class="px-3 py-2 text-center" :style="{ color: metricColors[option] }">{{ metricLabels[option] }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr v-for="team in teams" :key="team.teamId" :class="isMine(team) ? 'bg-accent-500/10' : ''">
                <td class="px-3 py-2">
                  <RouterLink :to="{ name: 'team', params: { teamId: team.teamId } }" class="flex items-center gap-2 font-medium text-slate-900 hover:text-accent-400">
                    <TeamCrest :src="team.crestUrl" :name="team.teamName" :short-name="team.shortName" size="xs" />
                    <span class="truncate">{{ team.teamName }}</span>
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
