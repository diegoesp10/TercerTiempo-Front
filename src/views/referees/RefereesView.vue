<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StarRating from '@/components/referees/StarRating.vue';
import { useAsync } from '@/composables/useAsync';
import { useSort, type SortValue } from '@/composables/useSort';
import { useAuthStore } from '@/stores/auth';
import type { CompetitionLevel, OfficialDuty, RefereeCategoryDto, RefereeSummaryDto } from '@/types/api';
import { formatDate, formatScore, levelLabels } from '@/utils/format';

/**
 * Árbitros, públicos como la liga y los equipos (las llamadas van sin token). La categoría manda: siempre hay una elegida
 * (de entrada, la de los equipos de la cuenta o, sin ella, la que más notas tiene) y dentro van por separado los
 * principales y los asistentes, con su nota media, sus notas y sus partidos pitados en esa categoría, ordenados como se
 * elija. La categoría y la función van en la URL (?categoria=3a-asturfutbol&funcion=asistentes) para poder enlazarlas.
 */
const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { data: index, loading: loadingIndex, error: indexError } = useAsync(() => api.referees.categories());

// Las categorías de los equipos de la cuenta, por sus ligas: la llamada no necesita el token para saberlo.
const mine = computed(() => (index.value ?? []).filter((c) => c.competitionIds.some((id) => auth.myCompetitionIds.includes(id))).map((c) => c.key));

const levels = computed(() => {
  const groups: { level: CompetitionLevel; categories: RefereeCategoryDto[] }[] = [];
  for (const category of index.value ?? []) {
    const group = groups.find((g) => g.level === category.level);
    if (group) group.categories.push(category);
    else groups.push({ level: category.level, categories: [category] });
  }
  return groups;
});

const category = computed(() => {
  const list = index.value ?? [];
  const wanted = typeof route.query.categoria === 'string' ? route.query.categoria : null;
  return list.find((c) => c.key === wanted)
    ?? list.find((c) => mine.value.includes(c.key))
    ?? [...list].sort((a, b) => b.ratings - a.ratings || b.matches - a.matches)[0]
    ?? null;
});
const duty = computed<OfficialDuty>(() => (route.query.funcion === 'asistentes' ? 'Assistant' : 'Main'));
const duties: { value: OfficialDuty; label: string; short: string; count: (c: RefereeCategoryDto) => number }[] = [
  { value: 'Main', label: 'Árbitros principales', short: 'Principales', count: (c) => c.referees },
  { value: 'Assistant', label: 'Asistentes', short: 'Asistentes', count: (c) => c.assistants },
];

function show(categoryKey: string, to: OfficialDuty = duty.value) {
  void router.replace({ query: { ...route.query, categoria: categoryKey, funcion: to === 'Assistant' ? 'asistentes' : undefined } });
}

// Cada categoría se pide una vez, con las dos funciones, y se guarda mientras se está en la página. Llega en el orden
// de la API (nota media, con los empates por notas, partidos y nombre) y se reordena aquí por la columna que se pulse.
const cache = new Map<string, RefereeSummaryDto[]>();
const rows = shallowRef<RefereeSummaryDto[] | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let latest = 0;
watch(() => category.value?.key, async (key) => {
  if (!key) return;
  const call = ++latest;
  error.value = null;
  const cached = cache.get(key);
  if (cached) {
    rows.value = cached;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const list = (await api.referees.category(key)).referees;
    cache.set(key, list);
    if (call === latest) rows.value = list;
  } catch (e) {
    if (call === latest) error.value = errorMessage(e);
  } finally {
    if (call === latest) loading.value = false;
  }
}, { immediate: true });

const search = ref('');
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const needle = computed(() => normalize(search.value.trim()));
const ofDuty = computed(() => (rows.value ?? []).filter((r) => r.duty === duty.value));
const shown = computed(() => ofDuty.value.filter((r) => !needle.value || normalize(r.name).includes(needle.value)));
const rated = computed(() => ofDuty.value.filter((r) => r.ratings > 0).length);

type RefereeSortKey = 'name' | 'average' | 'ratings' | 'matches' | 'lastMatch';
const refereeGetters: Record<RefereeSortKey, (r: RefereeSummaryDto) => SortValue> = {
  name: (r) => r.name,
  average: (r) => r.average,
  ratings: (r) => r.ratings,
  matches: (r) => r.matches,
  lastMatch: (r) => (r.lastMatchAt ? Date.parse(r.lastMatchAt) : null),
};
const { sorted, sortBy, state } = useSort<RefereeSummaryDto, RefereeSortKey>(shown, refereeGetters, 'average', { ascendingFirst: ['name'] });
</script>

<template>
  <div>
    <PageHeader
      title="Árbitros"
      subtitle="Por categoría, con los árbitros principales y los asistentes por separado y la nota de 0 a 10 que les ponen los clubes y sus cuerpos técnicos después de cada partido, con quién la puso y por qué."
    />

    <Spinner v-if="loadingIndex && !index" class="my-12" />
    <Alert v-else-if="indexError" kind="error">{{ indexError }}</Alert>
    <p v-else-if="index && !category" class="card text-sm text-slate-500">
      Todavía no hay equipos arbitrales guardados: salen de las actas de la federación y de futbolasturiano.es.
    </p>

    <template v-else-if="index && category">
      <nav class="mb-5 space-y-3" aria-label="Categoría">
        <div v-for="group in levels" :key="group.level">
          <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{{ levelLabels[group.level] }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="item in group.categories"
              :key="item.key"
              type="button"
              class="rounded-lg border px-3 py-2 text-left text-sm transition"
              :class="item.key === category.key
                ? 'border-brand-400 bg-brand-500/15 text-emerald-700'
                : 'border-slate-200 bg-surface text-slate-700 hover:border-brand-400/60'"
              :aria-pressed="item.key === category.key"
              @click="show(item.key)"
            >
              <Icon v-if="mine.includes(item.key)" icon="star" class="mr-1 h-3 w-3 text-accent-400" title="La de tus equipos" />
              <span class="font-medium">{{ item.name }}</span>
              <span class="ml-2 hidden text-xs text-slate-400 sm:inline">{{ item.referees }} árbitros · {{ item.assistants }} asistentes</span>
            </button>
          </div>
        </div>
      </nav>

      <section class="card overflow-hidden p-0">
        <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line px-4 pt-4">
          <div class="pb-3">
            <h2 class="text-lg font-bold text-slate-900">{{ category.name }}</h2>
            <p class="text-xs text-slate-500">
              {{ category.matches === 1 ? '1 partido' : `${category.matches} partidos` }} con equipo arbitral ·
              {{ category.ratings === 1 ? '1 nota' : `${category.ratings} notas` }}
            </p>
          </div>
          <div class="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="Función">
            <button
              v-for="option in duties"
              :key="option.value"
              type="button"
              role="tab"
              :aria-selected="duty === option.value"
              class="-mb-px flex shrink-0 items-center gap-1 border-b-2 px-2 pb-3 text-sm font-semibold transition sm:gap-1.5 sm:px-3"
              :class="duty === option.value ? 'border-accent-400 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'"
              @click="show(category.key, option.value)"
            >
              <span class="sm:hidden">{{ option.short }}</span><span class="hidden sm:inline">{{ option.label }}</span>
              <span class="rounded-full bg-surface-2 px-1.5 py-0.5 font-figures text-[11px] text-slate-500">{{ option.count(category) }}</span>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <label class="relative w-full max-w-sm">
            <span class="sr-only">Buscar árbitro</span>
            <Icon icon="magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input v-model="search" type="search" class="input w-full pl-9" placeholder="Buscar por nombre" />
          </label>
        </div>

        <Spinner v-if="loading && !rows" class="my-10" />
        <Alert v-else-if="error" kind="error" class="mx-4 mb-4">{{ error }}</Alert>
        <template v-else-if="rows">
          <p class="px-4 pb-2 text-xs text-slate-500">
            {{ ofDuty.length }} {{ duty === 'Main' ? (ofDuty.length === 1 ? 'árbitro principal' : 'árbitros principales') : (ofDuty.length === 1 ? 'asistente' : 'asistentes') }}
            en {{ category.name }} · {{ rated }} con notas.
          </p>
          <p v-if="shown.length === 0" class="border-t border-line px-4 py-6 text-sm text-slate-500">
            {{ ofDuty.length === 0 ? 'Nadie en esta función todavía.' : 'Nadie con ese nombre en esta categoría y función.' }}
          </p>
          <div v-else class="overflow-x-auto border-t border-line" :class="loading ? 'opacity-60' : ''">
            <table class="min-w-full text-sm">
              <thead class="border-b border-line text-left text-xs text-slate-500">
                <tr>
                  <th class="hidden w-10 px-4 py-3 text-center uppercase tracking-wide sm:table-cell">#</th>
                  <SortHeader class="px-4 py-3" :label="duty === 'Main' ? 'Árbitro' : 'Asistente'" title="Nombre" v-bind="state('name')" @sort="sortBy('name')" />
                  <SortHeader class="px-4 py-3" label="Nota media" v-bind="state('average')" @sort="sortBy('average')" />
                  <SortHeader class="px-4 py-3 text-center" label="Notas" title="Número de notas" v-bind="state('ratings')" @sort="sortBy('ratings')" />
                  <SortHeader class="hidden px-4 py-3 text-center sm:table-cell" label="Partidos" title="Partidos pitados" v-bind="state('matches')" @sort="sortBy('matches')" />
                  <SortHeader class="hidden px-4 py-3 md:table-cell" label="Último partido" v-bind="state('lastMatch')" @sort="sortBy('lastMatch')" />
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                <tr v-for="(referee, position) in sorted" :key="referee.id" class="hover:bg-surface-2">
                  <td class="hidden px-4 py-3 text-center font-figures text-xs text-slate-500 sm:table-cell">{{ position + 1 }}</td>
                  <td class="px-4 py-3">
                    <RouterLink
                      :to="{ name: 'referee', params: { refereeId: referee.id }, query: { categoria: referee.categoryKey } }"
                      class="font-semibold text-slate-900 hover:text-accent-400"
                    >{{ referee.name }}</RouterLink>
                  </td>
                  <td class="px-4 py-3">
                    <span class="flex items-center gap-2">
                      <span class="hidden sm:inline-flex"><StarRating :score="referee.average" size="sm" /></span>
                      <span class="font-figures font-bold text-slate-900">{{ formatScore(referee.average) }}</span>
                    </span>
                  </td>
                  <td class="px-4 py-3 text-center font-figures">{{ referee.ratings }}</td>
                  <td class="hidden px-4 py-3 text-center font-figures sm:table-cell">{{ referee.matches }}</td>
                  <td class="hidden px-4 py-3 text-xs text-slate-500 md:table-cell">{{ referee.lastMatchAt ? formatDate(referee.lastMatchAt) : '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </section>

      <p class="mt-3 text-xs text-slate-500">
        Las notas las pone el club o el cuerpo técnico de cada equipo tras su partido, una vez por árbitro y partido, y son definitivas: no se pueden cambiar.
        Un árbitro que pita en varias categorías, o que unas veces dirige y otras es asistente, sale en cada una con sus propias notas.
      </p>
    </template>
  </div>
</template>
