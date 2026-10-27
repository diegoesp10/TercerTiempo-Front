<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StarRating from '@/components/referees/StarRating.vue';
import { useAsync } from '@/composables/useAsync';
import type { CompetitionLevel, OfficialDuty, RefereeCategoryDto, RefereeSummaryDto } from '@/types/api';
import { formatDate, formatScore, levelLabels } from '@/utils/format';

/**
 * Árbitros por categoría, públicos como la liga y los equipos: primero se elige la categoría (de entrada, la de los
 * equipos de la cuenta o, sin ella, la que más notas tiene) y dentro van por separado los principales y los asistentes,
 * cada uno con la nota que le ponen los equipos en esa categoría y función.
 * La categoría y la función van en la URL (?categoria=3a-asturfutbol&funcion=asistentes) para poder enlazarlas.
 */
const route = useRoute();
const router = useRouter();
const { data: index, loading: loadingIndex, error: indexError } = useAsync(() => api.referees.categories());

const levels = computed(() => {
  const groups: { level: CompetitionLevel; categories: RefereeCategoryDto[] }[] = [];
  for (const category of index.value?.categories ?? []) {
    const group = groups.find((g) => g.level === category.level);
    if (group) group.categories.push(category);
    else groups.push({ level: category.level, categories: [category] });
  }
  return groups;
});

const category = computed(() => {
  const list = index.value?.categories ?? [];
  const wanted = typeof route.query.categoria === 'string' ? route.query.categoria : null;
  return list.find((c) => c.key === wanted)
    ?? list.find((c) => index.value?.mine.includes(c.key))
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

// Los árbitros de cada categoría se piden una vez (con las dos funciones) y se guardan mientras se está en la página.
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
    const list = await api.referees.list({ category: key });
    cache.set(key, list);
    if (call === latest) rows.value = list;
  } catch (e) {
    if (call === latest) error.value = errorMessage(e);
  } finally {
    if (call === latest) loading.value = false;
  }
}, { immediate: true });

const search = ref('');
type Sort = 'average' | 'ratings' | 'matches' | 'name';
const sort = ref<Sort>('average');
const sorts: { value: Sort; label: string }[] = [
  { value: 'average', label: 'Mejor nota' },
  { value: 'ratings', label: 'Más notas' },
  { value: 'matches', label: 'Más partidos' },
  { value: 'name', label: 'Nombre' },
];

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const needle = computed(() => normalize(search.value.trim()));
const ofDuty = computed(() => (rows.value ?? []).filter((r) => r.duty === duty.value));
const shown = computed(() => {
  const list = ofDuty.value.filter((r) => !needle.value || normalize(r.name).includes(needle.value));
  if (sort.value === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (sort.value === 'ratings') return [...list].sort((a, b) => b.ratings - a.ratings || (b.average ?? -1) - (a.average ?? -1));
  if (sort.value === 'matches') return [...list].sort((a, b) => b.matches - a.matches || (b.average ?? -1) - (a.average ?? -1));
  return list;
});
const rated = computed(() => ofDuty.value.filter((r) => r.ratings > 0).length);

// Al buscar un nombre, dónde más ha pitado esa persona (otras categorías o la otra función), para saltar ahí.
const found = shallowRef<RefereeSummaryDto[]>([]);
let timer: ReturnType<typeof setTimeout> | undefined;
watch(needle, (value) => {
  clearTimeout(timer);
  if (value.length < 3) {
    found.value = [];
    return;
  }
  timer = setTimeout(async () => {
    try {
      const list = await api.referees.list({ search: search.value.trim() });
      if (needle.value === value) found.value = list;
    } catch {
      found.value = [];
    }
  }, 300);
});
onBeforeUnmount(() => clearTimeout(timer));
const elsewhere = computed(() =>
  found.value.filter((r) => !(r.categoryKey === category.value?.key && r.duty === duty.value)).slice(0, 8));
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
              <Icon v-if="index.mine.includes(item.key)" icon="star" class="mr-1 h-3 w-3 text-accent-400" title="La de tus equipos" />
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
          <div class="flex gap-1" role="tablist" aria-label="Función">
            <button
              v-for="option in duties"
              :key="option.value"
              type="button"
              role="tab"
              :aria-selected="duty === option.value"
              class="-mb-px flex items-center gap-1.5 border-b-2 px-3 pb-3 text-sm font-semibold transition"
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
          <div class="flex w-full rounded-full border border-line bg-surface-2 p-1 sm:inline-flex sm:w-auto" role="radiogroup" aria-label="Ordenar">
            <button
              v-for="option in sorts"
              :key="option.value"
              type="button"
              role="radio"
              :aria-checked="sort === option.value"
              class="flex-1 whitespace-nowrap rounded-full px-1.5 py-1 text-[11px] font-semibold transition sm:flex-none sm:px-3 sm:text-xs"
              :class="sort === option.value ? 'bg-action text-white' : 'text-slate-600 hover:text-slate-900'"
              @click="sort = option.value"
            >{{ option.label }}</button>
          </div>
        </div>

        <div v-if="elsewhere.length" class="mx-4 mb-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-slate-500">
          <p class="font-semibold text-slate-600">También con ese nombre:</p>
          <ul class="mt-1 flex flex-wrap gap-x-3 gap-y-1">
            <li v-for="other in elsewhere" :key="`${other.id}-${other.categoryKey}-${other.duty}`">
              <button type="button" class="text-accent-400 hover:underline" @click="show(other.categoryKey, other.duty)">
                {{ other.name }} · {{ other.category }} · {{ other.duty === 'Main' ? 'principal' : 'asistente' }}
              </button>
            </li>
          </ul>
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
              <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="hidden w-10 px-4 py-3 text-center sm:table-cell">#</th>
                  <th class="px-4 py-3">{{ duty === 'Main' ? 'Árbitro' : 'Asistente' }}</th>
                  <th class="px-4 py-3">Nota media</th>
                  <th class="px-4 py-3 text-center">Notas</th>
                  <th class="hidden px-4 py-3 text-center sm:table-cell">Partidos</th>
                  <th class="hidden px-4 py-3 md:table-cell">Último partido</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-line">
                <tr v-for="(referee, position) in shown" :key="referee.id" class="hover:bg-surface-2">
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
