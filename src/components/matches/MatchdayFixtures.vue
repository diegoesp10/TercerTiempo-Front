<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
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

const isHighlighted = (match: MatchDto) =>
  !!props.highlightTeamIds?.some((id) => id === match.homeTeam.id || id === match.awayTeam.id);

const hasScore = (match: MatchDto) => match.status === 'Played' && match.homeGoals !== null && match.awayGoals !== null;
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="btn-ghost px-2 py-1"
          :disabled="previous === null || loading"
          aria-label="Jornada anterior"
          @click="go(previous)"
        >
          ‹
        </button>
        <div>
          <h2 class="font-semibold text-slate-900">
            {{ selected !== null ? `Jornada ${selected}` : 'Jornadas' }}
            <span v-if="summary" class="ml-1 text-sm font-normal text-slate-500">· {{ formatDayRange(summary.startsAt, summary.endsAt) }}</span>
          </h2>
          <Badge v-if="state" :tone="state.tone" class="mt-0.5">{{ state.label }}</Badge>
        </div>
        <button
          type="button"
          class="btn-ghost px-2 py-1"
          :disabled="next === null || loading"
          aria-label="Jornada siguiente"
          @click="go(next)"
        >
          ›
        </button>
      </div>

      <div class="flex items-center gap-2">
        <button
          v-if="current !== null && selected !== current"
          type="button"
          class="btn-secondary px-3 py-1 text-xs"
          :disabled="loading"
          @click="go(current)"
        >
          Ir a la jornada {{ current }}
        </button>
        <select
          v-if="matchdays.length > 0"
          class="input w-auto py-1 text-sm"
          aria-label="Elegir jornada"
          :value="selected ?? ''"
          :disabled="loading"
          @change="go(Number(($event.target as HTMLSelectElement).value))"
        >
          <option v-for="m in matchdays" :key="m.number" :value="m.number">
            J{{ m.number }} · {{ formatDayRange(m.startsAt, m.endsAt) }}{{ m.number === current ? ' · actual' : '' }}
          </option>
        </select>
      </div>
    </div>

    <Spinner v-if="loading && !data" />
    <Alert v-else-if="error" kind="error" class="mt-4">{{ error }}</Alert>
    <p v-else-if="data && data.matches.length === 0" class="mt-4 text-sm text-slate-500">
      Todavía no hay calendario publicado para esta liga.
    </p>

    <div v-else-if="data" class="mt-4 space-y-4" :class="loading ? 'opacity-60' : ''">
      <div v-for="day in days" :key="day.heading">
        <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{{ day.heading }}</h3>
        <ul class="divide-y divide-slate-100 rounded-lg border border-slate-200">
          <li v-for="match in day.matches" :key="match.id">
            <RouterLink
              :to="{ name: 'match', params: { matchId: match.id } }"
              class="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50"
              :class="isHighlighted(match) ? 'bg-emerald-50 font-medium' : ''"
            >
              <span class="truncate text-right text-slate-800" :title="match.homeTeam.name">{{ match.homeTeam.name }}</span>
              <span class="min-w-16 text-center">
                <span v-if="hasScore(match)" class="rounded bg-slate-900 px-2 py-0.5 font-semibold tabular-nums text-white">
                  {{ match.homeGoals }} - {{ match.awayGoals }}
                </span>
                <span v-else-if="match.status === 'Scheduled'" class="tabular-nums text-slate-600">{{ formatTime(match.kickoffAt) }}</span>
                <Badge v-else tone="amber">{{ matchStatusLabels[match.status] }}</Badge>
              </span>
              <span class="truncate text-slate-800" :title="match.awayTeam.name">{{ match.awayTeam.name }}</span>
            </RouterLink>
            <p v-if="match.venue" class="-mt-1 truncate px-3 pb-2 text-center text-xs text-slate-400">{{ match.venue }}</p>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>
