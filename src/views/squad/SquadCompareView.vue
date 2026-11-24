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
import GroupByPositionToggle from '@/components/ui/GroupByPositionToggle.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { groupByPosition, useGroupByPosition } from '@/composables/usePositionGrouping';
import { useSquad } from '@/composables/useSquad';
import { useCompareSelectionStore } from '@/stores/compareSelection';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import Badge from '@/components/ui/Badge.vue';
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

const grouped = useGroupByPosition('squad-compare');
const candidateGroups = computed(() => groupByPosition(candidates.value, (r) => r.player.position, grouped.value, undefined, (r) => r.player.status !== 'Active'));

const selected = ref<string[]>([]);
const includeAverage = ref(true);
const remembered = useCompareSelectionStore();

// El comparador del jugador no es el del cuerpo técnico (Diego, 21-11): él va siempre, el primero y como «Tú», y elige
// con quién compararse. Si aún no tiene minutos, compara como cualquiera.
const auth = useAuthStore();
const myId = computed(() => (auth.playerSquad?.squadId === squadId.value ? auth.playerSquad.squadPlayerId : null));
const meIn = computed(() => (myId.value && candidates.value.some((r) => r.player.id === myId.value) ? myId.value : null));
const withMe = (ids: string[]) => (meIn.value ? [meIn.value, ...ids.filter((id) => id !== meIn.value)].slice(0, MAX_SELECTED) : ids);
const nameOf = (row: { player: { id: string; fullName: string } }) => (row.player.id === meIn.value ? 'Tú' : row.player.fullName);

// Al entrar el cuerpo técnico no tiene a nadie marcado (Diego, 20-11: «no me preselecciones a nadie»): solo los que traiga
// el enlace (?ids=a,b, que también conserva la selección al recargar) o, si no, los que se eligieron aquí en esta sesión.
let restored = false;
watch(
  candidates,
  (list) => {
    if (restored || list.length === 0) return;
    restored = true;
    const known = (ids: string[]) => ids.filter((id) => list.some((r) => r.player.id === id)).slice(0, MAX_SELECTED);
    const fromQuery = known(String(route.query.ids ?? '').split(','));
    selected.value = withMe(fromQuery.length > 0 ? fromQuery : known(remembered.get(squadId.value)));
  },
  { immediate: true },
);

watch(selected, (ids) => {
  remembered.set(squadId.value, ids);
  void router.replace({ query: { ...route.query, ids: ids.join(',') || undefined } });
  void loadProfiles(ids);
});

function toggle(id: string) {
  if (id === meIn.value) return;
  if (selected.value.includes(id)) selected.value = selected.value.filter((x) => x !== id);
  else if (selected.value.length < MAX_SELECTED) selected.value = [...selected.value, id];
}

/** Por qué no se puede pulsar un jugador: el propio jugador va siempre; con el cupo lleno, hay que quitar a alguien. */
function lockReason(id: string): string | undefined {
  if (id === meIn.value) return 'Tú vas siempre: elige con quién compararte';
  if (!selected.value.includes(id) && selected.value.length >= MAX_SELECTED) return `Ya hay ${MAX_SELECTED} elegidos: quita uno para añadir a otro`;
  return undefined;
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
  ...rows.value.map((r) => ({ name: nameOf(r), axes: axesFromStats(r.stats, r.impact) })),
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
    .map((p) => ({ name: nameOf(p), points: p.matches }));
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
  { label: 'Titularidades', value: (r) => r.stats.starts, format: (v) => String(v ?? '—') },
  { label: 'Minutos', value: (r) => r.stats.minutes, format: (v) => String(v ?? '—') },
  { label: 'Goles', value: (r) => r.stats.goals, format: (v) => String(v ?? '—') },
  { label: 'Asistencias de gol', value: (r) => r.stats.assists, format: (v) => String(v ?? '—') },
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
      <Alert v-if="myId && !meIn" kind="info" class="mb-4">
        Aún no tienes minutos en las actas: en cuanto juegues, aquí te comparas tú con tus compañeros. Mientras, puedes comparar a quien quieras.
      </Alert>
      <section class="card mb-6">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 v-if="meIn" class="font-semibold text-slate-900">Tú frente a tus compañeros</h2>
            <h2 v-else class="font-semibold text-slate-900">Elige hasta {{ MAX_SELECTED }} jugadores</h2>
            <p class="text-xs text-slate-500">
              <template v-if="meIn">Tú vas siempre; elige hasta {{ MAX_SELECTED - 1 }} con quien compararte. </template>Todos los datos salen de las actas; las notas, calculadas con esos datos.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <GroupByPositionToggle v-model="grouped" />
            <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
              <input v-model="includeAverage" type="checkbox" class="h-4 w-4 cursor-pointer rounded border-slate-300 text-accent-400" />
              Media de la plantilla
            </label>
          </div>
        </div>
        <div v-for="group in candidateGroups" :key="group.key" class="mt-3">
          <p v-if="group.label" class="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{{ group.label }} · {{ group.rows.length }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="row in group.rows"
              :key="row.player.id"
              type="button"
              class="flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition"
              :class="[
                selected.includes(row.player.id) ? 'border-transparent shadow-sm' : 'border-slate-200 bg-surface text-slate-700 hover:border-slate-300 disabled:opacity-50',
                row.player.id === meIn ? 'cursor-default' : 'cursor-pointer disabled:cursor-not-allowed',
              ]"
              :style="selected.includes(row.player.id) ? { backgroundColor: colorOf(row.player.id), color: textOnColor(colorOf(row.player.id)) } : undefined"
              :disabled="!!lockReason(row.player.id)"
              :title="lockReason(row.player.id)"
              @click="toggle(row.player.id)"
            >
              <PlayerName :name="row.player.fullName" :photo-url="row.player.photoUrl" />
              <span v-if="row.player.position && !grouped" class="text-xs">{{ positionShortLabels[row.player.position] }}</span>
              <Badge v-if="row.player.id === meIn" tone="slate">Tú</Badge>
            </button>
          </div>
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
                      <PlayerName :name="nameOf(row)" :photo-url="row.player.photoUrl" />
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
