<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { CompetitionMatchdayDto, MatchDto } from '@/types/api';
import { formatDayHeading, formatDayRange, formatTime, localDayKey, matchStatusLabels } from '@/utils/format';

const props = defineProps<{
  competitionId: string;
  /** Equipos a resaltar (los del usuario). */
  highlightTeamIds?: string[];
}>();

const data = shallowRef<CompetitionMatchdayDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

/** null = la jornada en curso según la API. */
const requested = ref<number | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await api.competitions.matchday(props.competitionId, requested.value);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(
  () => props.competitionId,
  () => {
    requested.value = null;
    void load();
  },
  { immediate: true },
);

const matchdays = computed(() => data.value?.matchdays ?? []);
const current = computed(() => data.value?.currentMatchday ?? null);
const selected = computed(() => data.value?.matchday ?? null);
const summary = computed(() => matchdays.value.find((m) => m.number === selected.value) ?? null);
const index = computed(() => matchdays.value.findIndex((m) => m.number === selected.value));

function go(number: number | null) {
  if (number === null || number === selected.value) return;
  requested.value = number;
  void load();
}

const previous = computed(() => (index.value > 0 ? matchdays.value[index.value - 1]?.number ?? null : null));
const next = computed(() =>
  index.value >= 0 && index.value < matchdays.value.length - 1 ? matchdays.value[index.value + 1]?.number ?? null : null,
);

/** Estado de la jornada mostrada respecto a hoy. */
const state = computed<{ label: string; tone: 'green' | 'blue' | 'slate' | 'amber' } | null>(() => {
  const s = summary.value;
  if (!s) return null;
  if (s.played === s.matches) return { label: 'Disputada', tone: 'slate' };
  if (s.number === current.value) {
    return s.played > 0 || new Date(s.startsAt) <= new Date()
      ? { label: 'Jornada en curso', tone: 'green' }
      : { label: 'Próxima jornada', tone: 'blue' };
  }
  if (current.value !== null && s.number < current.value) return { label: 'Con partidos pendientes', tone: 'amber' };
  return null;
});

/** Partidos agrupados por día (hora local). */
const days = computed(() => {
  const groups = new Map<string, { heading: string; matches: MatchDto[] }>();
  for (const match of data.value?.matches ?? []) {
    const key = localDayKey(match.kickoffAt);
    if (!groups.has(key)) groups.set(key, { heading: formatDayHeading(match.kickoffAt), matches: [] });
    groups.get(key)!.matches.push(match);
  }
  return [...groups.values()];
});

const matchdayOptions = computed(() =>
  matchdays.value.map((m) => ({
    value: m.number,
    label: `Jornada ${m.number}`,
    hint: `${formatDayRange(m.startsAt, m.endsAt)}${m.number === current.value ? ' · actual' : ''}`,
  })),
);

const isHighlighted = (match: MatchDto) =>
  !!props.highlightTeamIds?.some((id) => id === match.homeTeam.id || id === match.awayTeam.id);

const hasScore = (match: MatchDto) => match.status === 'Played' && match.homeGoals !== null && match.awayGoals !== null;
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <!-- Navegación de jornadas: anterior · jornada con fechas y estado · siguiente -->
      <div class="inline-flex items-stretch overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
        <button
          type="button"
          class="flex w-11 items-center justify-center text-slate-500 transition hover:bg-brand-500/10 hover:text-brand-500 disabled:cursor-not-allowed disabled:opacity-30"
          :disabled="previous === null || loading"
          aria-label="Jornada anterior"
          @click="go(previous)"
        >
          <Icon icon="chevron-left" class="h-4 w-4" />
        </button>
        <div class="min-w-44 border-x border-line px-4 py-1.5 text-center">
          <p class="font-display text-xl font-bold uppercase leading-tight text-slate-900">
            {{ selected !== null ? `Jornada ${selected}` : 'Jornadas' }}
          </p>
          <p class="text-xs text-slate-500">
            <span v-if="summary">{{ formatDayRange(summary.startsAt, summary.endsAt) }}</span>
            <Badge v-if="state" :tone="state.tone" class="ml-1 align-middle">{{ state.label }}</Badge>
          </p>
        </div>
        <button
          type="button"
          class="flex w-11 items-center justify-center text-slate-500 transition hover:bg-brand-500/10 hover:text-brand-500 disabled:cursor-not-allowed disabled:opacity-30"
          :disabled="next === null || loading"
          aria-label="Jornada siguiente"
          @click="go(next)"
        >
          <Icon icon="chevron-right" class="h-4 w-4" />
        </button>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <button
          v-if="current !== null && selected !== current"
          type="button"
          class="btn-secondary px-3 py-1.5 text-xs"
          v-busy="loading" :disabled="loading"
          @click="go(current)"
        >
          <Icon icon="calendar-check" class="mr-1.5 h-3.5 w-3.5" />Jornada actual ({{ current }})
        </button>
        <SearchSelect
          v-if="matchdays.length > 0"
          class="w-64"
          size="sm"
          aria-label="Elegir jornada"
          :model-value="selected"
          :options="matchdayOptions"
          :disabled="loading"
          searchable
          @update:model-value="go($event === null ? null : Number($event))"
        />
      </div>
    </div>

    <Spinner v-if="loading && !data" />
    <Alert v-else-if="error" kind="error" class="mt-4">{{ error }}</Alert>
    <div v-else-if="data && data.matchdays.length === 0" class="mt-4 flex items-start gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-slate-600">
      <Icon icon="calendar-check" class="mt-0.5 h-4 w-4 shrink-0 text-accent-400" />
      <span>{{ data.notice ?? 'Todavía no hay partidos de esta temporada.' }}</span>
    </div>
    <p v-else-if="data && data.matches.length === 0" class="mt-4 text-sm text-slate-500">No hay partidos en esta jornada.</p>

    <div v-else-if="data" class="mt-4 space-y-4" :class="loading ? 'opacity-60' : ''">
      <div v-for="day in days" :key="day.heading">
        <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{{ day.heading }}</h3>
        <ul class="divide-y divide-slate-100 rounded-lg border border-slate-200">
          <li v-for="match in day.matches" :key="match.id">
            <RouterLink
              :to="{ name: 'match', params: { matchId: match.id } }"
              class="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
              :class="isHighlighted(match) ? 'bg-brand-500/10 font-medium' : ''"
            >
              <span class="min-w-0 truncate text-right text-slate-800" :title="match.homeTeam.name">{{ match.homeTeam.name }}</span>
              <span class="min-w-16 text-center">
                <span v-if="hasScore(match)" class="rounded bg-brand-500 px-2 py-0.5 font-semibold tabular-nums text-white">
                  {{ match.homeGoals }} - {{ match.awayGoals }}
                </span>
                <span v-else-if="match.status === 'Scheduled'" class="tabular-nums text-slate-600">{{ formatTime(match.kickoffAt) }}</span>
                <Badge v-else tone="amber">{{ matchStatusLabels[match.status] }}</Badge>
              </span>
              <span class="min-w-0 truncate text-slate-800" :title="match.awayTeam.name">{{ match.awayTeam.name }}</span>
            </RouterLink>
            <p v-if="match.venue" class="-mt-1 truncate px-3 pb-2 text-center text-xs text-slate-400">{{ match.venue }}</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
