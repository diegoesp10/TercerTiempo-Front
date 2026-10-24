<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import { MIN_MINUTES_FOR_REFERENCE, averageAxes, axesFromStats, maxAxes } from '@/charts/axes';
import { per90BarsOption, profileRadarOption, ratingComparisonOption, type RadarEntry } from '@/charts/options';
import { seriesColors, seriesTextColors, textOnColor } from '@/charts/theme';
import AppChart from '@/components/charts/AppChart.vue';
import ChartCard from '@/components/charts/ChartCard.vue';
import Alert from '@/components/ui/Alert.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';
import { useSettingsStore } from '@/stores/settings';
import type { SquadPlayerProfileDto, SquadPlayerStatsDto } from '@/types/api';
import { formatNumber, formatPct, positionShortLabels } from '@/utils/format';
import PlayerName from '@/components/players/PlayerName.vue';

const MAX_SELECTED = 4;

const { squadId } = useSquad();
const settings = useSettingsStore();
const route = useRoute();
const router = useRouter();

const { data, loading, error } = useAsync(() => api.squads.stats(squadId.value));

/** Jugadores con minutos, de más a menos. */
const candidates = computed(() =>
  (data.value?.players ?? []).filter((r) => r.stats.minutes > 0).sort((a, b) => b.stats.minutes - a.stats.minutes),
);

const selected = ref<string[]>([]);
const includeAverage = ref(true);

// Selección inicial: la de la URL (?ids=a,b) completada con los que más minutos tienen.
watch(candidates, (list) => {
  if (selected.value.length > 0 || list.length === 0) return;
  const fromQuery = String(route.query.ids ?? '').split(',').filter((id) => list.some((r) => r.player.id === id));
  const extra = list.map((r) => r.player.id).filter((id) => !fromQuery.includes(id));
  selected.value = [...fromQuery, ...extra].slice(0, Math.max(2, Math.min(fromQuery.length, MAX_SELECTED)));
});

watch(selected, (ids) => {
  void router.replace({ query: { ...route.query, ids: ids.join(',') || undefined } });
  void loadProfiles(ids);
});

function toggle(id: string) {
  if (selected.value.includes(id)) selected.value = selected.value.filter((x) => x !== id);
  else if (selected.value.length < MAX_SELECTED) selected.value = [...selected.value, id];
}

const rows = computed(() =>
  selected.value
    .map((id) => candidates.value.find((r) => r.player.id === id))
    .filter((r): r is SquadPlayerStatsDto => r !== undefined),
);

const colorOf = (id: string) => seriesColors[selected.value.indexOf(id) % seriesColors.length];
const textColorOf = (id: string) => seriesTextColors[settings.resolvedTheme][selected.value.indexOf(id) % seriesColors.length];

// Perfil por 90' de cada jugador y referencias de la plantilla (jugadores con 90' o más).
const reference = computed(() =>
  candidates.value.filter((r) => r.stats.minutes >= MIN_MINUTES_FOR_REFERENCE).map((r) => axesFromStats(r.stats, r.impact)),
);
const entries = computed<RadarEntry[]>(() => [
  ...rows.value.map((r) => ({ name: r.player.fullName, axes: axesFromStats(r.stats, r.impact) })),
  ...(includeAverage.value ? [{ name: 'Media de la plantilla', axes: averageAxes(reference.value), reference: true }] : []),
]);
const includeSaves = computed(() => rows.value.some((r) => r.player.position === 'Goalkeeper'));

const radar = computed(() => (rows.value.length ? profileRadarOption(entries.value, maxAxes(reference.value), includeSaves.value, settings.resolvedTheme) : null));
const bars = computed(() => (rows.value.length ? per90BarsOption(entries.value) : null));

// Nota partido a partido: necesita la serie de cada jugador (ficha completa).
const profiles = reactive(new Map<string, SquadPlayerProfileDto>());
const profilesError = ref<string | null>(null);

async function loadProfiles(ids: string[]) {
  profilesError.value = null;
  try {
    await Promise.all(
      ids.filter((id) => !profiles.has(id)).map(async (id) => profiles.set(id, await api.squads.playerProfile(squadId.value, id))),
    );
  } catch (e) {
    profilesError.value = errorMessage(e);
  }
}

const trend = computed(() => {
  const series = selected.value
    .map((id) => profiles.get(id))
    .filter((p): p is SquadPlayerProfileDto => p !== undefined)
    .map((p) => ({ name: p.player.fullName, points: p.matches }));
  return series.length ? ratingComparisonOption(series) : null;
});

// Tabla cara a cara: se resalta el mejor de cada fila.
interface MetricRow {
  label: string;
  value: (r: SquadPlayerStatsDto) => number | null;
  format: (v: number | null) => string;
}

const metrics: MetricRow[] = [
  { label: 'Partidos', value: (r) => r.stats.matchesLogged, format: (v) => String(v ?? '—') },
  { label: 'Minutos', value: (r) => r.stats.minutes, format: (v) => String(v ?? '—') },
  { label: 'Goles', value: (r) => r.stats.goals, format: (v) => String(v ?? '—') },
  { label: 'Asistencias', value: (r) => r.stats.assists, format: (v) => String(v ?? '—') },
  { label: "Goles + asist. por 90'", value: (r) => r.stats.goalContributionsPer90, format: (v) => formatNumber(v) },
  { label: 'Precisión de tiro', value: (r) => r.stats.shotAccuracyPct, format: (v) => formatPct(v) },
  { label: 'Acierto en el pase', value: (r) => r.stats.passAccuracyPct, format: (v) => formatPct(v) },
  { label: "Recuperaciones por 90'", value: (r) => r.stats.recoveriesPer90, format: (v) => formatNumber(v) },
  { label: 'Participación', value: (r) => r.impact.participationPct, format: (v) => formatPct(v) },
  { label: 'Puntos/partido con él', value: (r) => r.impact.pointsPerMatchWithPlayer, format: (v) => formatNumber(v) },
];

const best = (metric: MetricRow) => Math.max(...rows.value.map((r) => metric.value(r) ?? -Infinity));
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <Alert v-if="candidates.length === 0" kind="info">
      Todavía no hay actas con minutos en esta plantilla: el comparador se activa en cuanto el cuerpo técnico registre partidos.
    </Alert>

    <template v-else>
      <section class="card mb-6">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="font-semibold text-slate-900">Elige hasta {{ MAX_SELECTED }} jugadores</h2>
            <p class="text-xs text-slate-500">Todos los datos salen de las actas; las notas, calculadas con esos datos.</p>
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input v-model="includeAverage" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-accent-400" />
            Media de la plantilla
          </label>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button
            v-for="row in candidates"
            :key="row.player.id"
            type="button"
            class="flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition"
            :class="selected.includes(row.player.id)
              ? 'border-transparent shadow-sm'
              : 'border-slate-200 bg-surface text-slate-700 hover:border-slate-300 disabled:opacity-50'"
            :style="selected.includes(row.player.id) ? { backgroundColor: colorOf(row.player.id), color: textOnColor(colorOf(row.player.id)) } : undefined"
            :disabled="!selected.includes(row.player.id) && selected.length >= MAX_SELECTED"
            @click="toggle(row.player.id)"
          >
            <span v-if="row.player.shirtNumber">{{ row.player.shirtNumber }}</span>
            <PlayerName :name="row.player.fullName" :photo-url="row.player.photoUrl" />
            <span v-if="row.player.position" class="text-xs">{{ positionShortLabels[row.player.position] }}</span>
          </button>
        </div>
      </section>

      <p v-if="rows.length === 0" class="text-sm text-slate-500">Selecciona al menos un jugador.</p>

      <div v-else class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCard title="Perfil por 90 minutos" subtitle="Cada eje escalado al máximo de la plantilla.">
          <AppChart v-if="radar" :option="radar" :height="380" label="Radar comparativo de jugadores" />
        </ChartCard>

        <ChartCard title="Cara a cara" subtitle="En negrita, el mejor de cada fila.">
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr>
                  <th class="py-2 pr-3 text-left text-xs uppercase tracking-wide text-slate-500"></th>
                  <th v-for="row in rows" :key="row.player.id" class="px-2 py-2 text-center">
                    <RouterLink
                      :to="{ name: 'squad-player', params: { squadId, squadPlayerId: row.player.id } }"
                      class="block text-xs font-semibold hover:underline"
                      :style="{ color: textColorOf(row.player.id) }"
                    >
                      <PlayerName :name="row.player.fullName" :photo-url="row.player.photoUrl" />
                    </RouterLink>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr>
                  <td class="py-2 pr-3 text-slate-600">Nota media</td>
                  <td v-for="row in rows" :key="row.player.id" class="px-2 py-2 text-center"><RatingBadge :rating="row.stats.averageRating" size="sm" /></td>
                </tr>
                <tr v-for="metric in metrics" :key="metric.label">
                  <td class="py-2 pr-3 text-slate-600">{{ metric.label }}</td>
                  <td
                    v-for="row in rows"
                    :key="row.player.id"
                    class="px-2 py-2 text-center tabular-nums"
                    :class="rows.length > 1 && metric.value(row) === best(metric) ? 'font-bold text-slate-900' : 'text-slate-600'"
                  >
                    {{ metric.format(metric.value(row)) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ChartCard>

        <ChartCard title="Nota partido a partido" subtitle="Todos los partidos del equipo; la línea une los partidos que jugó cada uno." class="lg:col-span-2">
          <Alert v-if="profilesError" kind="error">{{ profilesError }}</Alert>
          <AppChart v-else-if="trend" :option="trend" :height="300" label="Evolución de la nota de los jugadores" />
          <Spinner v-else />
        </ChartCard>

        <ChartCard title="Acciones por 90 minutos" subtitle="Para comparar jugadores con distinto número de minutos." class="lg:col-span-2">
          <AppChart v-if="bars" :option="bars" :height="300" label="Acciones por 90 minutos de cada jugador" />
        </ChartCard>
      </div>
    </template>
  </template>
</template>
