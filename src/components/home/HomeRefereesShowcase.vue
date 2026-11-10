<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import StarRating from '@/components/referees/StarRating.vue';
import { useHomeCompetition } from '@/composables/useHomeCompetition';
import type { OfficialDuty, RefereeCategoryDto, RefereeSummaryDto } from '@/types/api';
import { formatDate, formatScore } from '@/utils/format';

/**
 * Los árbitros en la portada: qué es la nota de los equipos y, con datos reales, los árbitros de una categoría
 * (los mejor valorados o, mientras no haya notas, los que más han pitado). Sigue a la liga elegida en la portada.
 */
const { selectedId } = useHomeCompetition();

const categories = shallowRef<RefereeCategoryDto[]>([]);
const picked = ref<string | null>(null);
const duty = ref<OfficialDuty>('Main');
const referees = shallowRef<RefereeSummaryDto[]>([]);
const loading = ref(true);

onMounted(async () => {
  try {
    categories.value = await api.referees.categories();
  } catch {
    loading.value = false;
  }
});

// La categoría de la liga de la portada, salvo que se elija otra aquí. Los árbitros salen de las actas oficiales, que
// apenas cubren las ligas nacionales: si la categoría de la liga casi no tiene árbitros, se enseña la de más partidos.
const MIN_REFEREES = 5;
watch(selectedId, () => (picked.value = null));
const category = computed(() =>
  categories.value.find((c) => c.key === picked.value)
  ?? categories.value.find((c) => selectedId.value && c.competitionIds.includes(selectedId.value) && c.referees >= MIN_REFEREES)
  ?? [...categories.value].sort((a, b) => b.matches - a.matches)[0]
  ?? null,
);
const rated = computed(() => (category.value?.ratings ?? 0) > 0);

watch([category, duty], async ([current, wanted]) => {
  if (!current) return;
  loading.value = true;
  try {
    const list = await api.referees.category(current.key, { duty: wanted, sort: rated.value ? 'Average' : 'Matches' });
    if (category.value?.key === current.key && duty.value === wanted) referees.value = list.referees.slice(0, 5);
  } catch {
    referees.value = [];
  } finally {
    if (category.value?.key === current.key && duty.value === wanted) loading.value = false;
  }
});

const duties = [
  { value: 'Main' as const, label: 'Principales' },
  { value: 'Assistant' as const, label: 'Asistentes' },
];
const figures = computed(() =>
  category.value
    ? [
      { label: 'Principales', value: category.value.referees },
      { label: 'Asistentes', value: category.value.assistants },
      { label: 'Partidos', value: category.value.matches },
      { label: 'Notas', value: category.value.ratings },
    ]
    : [],
);
const fullList = computed(() => ({
  name: 'referees',
  query: { categoria: category.value?.key, funcion: duty.value === 'Assistant' ? 'asistentes' : undefined },
}));

const features = [
  { icon: 'star', title: 'De 0 a 10, con su porqué', text: 'Las dos plantillas puntúan el mismo partido: se ve qué nota pone cada una y por qué.' },
  { icon: 'lock', title: 'Definitiva y firmada', text: 'Se confirma dos veces antes de guardarla y ya no cambia; queda quién votó y con qué cargo.' },
  { icon: 'shield-halved', title: 'Sin insultos', text: 'Los comentarios pasan un filtro de palabras malsonantes y la administración retira los que se salen de tono.' },
  { icon: 'flag', title: 'Principales y asistentes', text: 'Cada categoría por separado, con medias, partidos pitados y última actuación.' },
];

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('');
</script>

<template>
  <section class="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
    <div class="lg:col-span-5 lg:pt-2">
      <p class="eyebrow flex items-center gap-2"><Icon icon="flag" class="h-3 w-3" />Árbitros</p>
      <h2 class="mt-2 text-balance text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">Cada árbitro, con la nota de los dos equipos.</h2>
      <p class="mt-3 text-slate-600">
        Tras cada partido, el club o el cuerpo técnico de cada equipo puntúa al árbitro y a sus asistentes y explica por qué.
        Todo es público: se consulta sin cuenta, por categoría y por función.
      </p>
      <ul class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
        <li v-for="feature in features" :key="feature.title" class="flex gap-3">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
            <Icon :icon="feature.icon" class="h-4 w-4" />
          </span>
          <span>
            <span class="block text-sm font-bold text-slate-900">{{ feature.title }}</span>
            <span class="block text-sm text-slate-600">{{ feature.text }}</span>
          </span>
        </li>
      </ul>
    </div>

    <div class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:col-span-7">
      <header class="border-b border-line px-5 pt-4">
        <div v-if="categories.length" class="flex flex-wrap gap-1.5" role="group" aria-label="Categoría">
          <button
            v-for="item in categories"
            :key="item.key"
            type="button"
            class="rounded-full px-3 py-1 text-xs font-semibold transition"
            :class="item.key === category?.key ? 'bg-brand-500 text-white' : 'bg-surface-2 text-slate-600 ring-1 ring-line hover:text-slate-900'"
            :aria-pressed="item.key === category?.key"
            @click="picked = item.key"
          >{{ item.name }}</button>
        </div>
        <div v-else class="h-6 w-2/3 animate-pulse rounded-full bg-surface-2" />

        <dl class="mt-4 grid grid-cols-2 gap-2 pb-4 sm:grid-cols-4">
          <div v-for="figure in figures" :key="figure.label">
            <dt class="text-[11px] uppercase tracking-wide text-slate-500">{{ figure.label }}</dt>
            <dd class="font-figures text-2xl font-extrabold text-slate-900">{{ figure.value.toLocaleString('es-ES') }}</dd>
          </div>
        </dl>

        <div class="flex flex-wrap items-end justify-between gap-x-3">
          <p class="whitespace-nowrap pb-3 text-sm font-bold text-slate-900">{{ rated ? 'Los mejor valorados' : 'Los que más han pitado' }}</p>
          <div class="flex gap-1" role="tablist" aria-label="Función">
            <button
              v-for="option in duties"
              :key="option.value"
              type="button"
              role="tab"
              :aria-selected="duty === option.value"
              class="-mb-px border-b-2 px-2.5 pb-3 text-sm font-semibold transition"
              :class="duty === option.value ? 'border-accent-400 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'"
              @click="duty = option.value"
            >{{ option.label }}</button>
          </div>
        </div>
      </header>

      <ol v-if="referees.length" class="divide-y divide-line transition-opacity" :class="loading ? 'opacity-60' : ''">
        <li v-for="(referee, index) in referees" :key="referee.id">
          <RouterLink
            :to="{ name: 'referee', params: { refereeId: referee.id }, query: { categoria: referee.categoryKey } }"
            class="flex items-center gap-3 px-5 py-3 transition hover:bg-surface-2"
          >
            <span class="w-4 shrink-0 text-center font-figures text-sm font-bold text-slate-400">{{ index + 1 }}</span>
            <span class="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-display text-xs font-bold text-brand-500 sm:flex" aria-hidden="true">
              {{ initials(referee.name) }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-semibold text-slate-900">{{ referee.name }}</span>
              <span class="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                <StarRating :score="referee.average" size="sm" />
                <span v-if="referee.average === null">Sin notas aún</span>
                <span v-else><strong class="font-figures text-slate-900">{{ formatScore(referee.average) }}</strong> · {{ referee.ratings }} {{ referee.ratings === 1 ? 'nota' : 'notas' }}</span>
              </span>
            </span>
            <span class="shrink-0 text-right">
              <span class="block font-figures text-lg font-extrabold leading-tight text-slate-900">{{ referee.matches }}</span>
              <span class="block text-[11px] text-slate-500">{{ referee.matches === 1 ? 'partido' : 'partidos' }}</span>
            </span>
            <span class="hidden w-20 shrink-0 text-right text-[11px] text-slate-500 sm:block">
              {{ referee.lastMatchAt ? formatDate(referee.lastMatchAt) : '—' }}
            </span>
          </RouterLink>
        </li>
      </ol>
      <div v-else-if="loading" class="space-y-px" aria-busy="true" aria-label="Cargando árbitros">
        <div v-for="row in 5" :key="row" class="mx-5 my-3 h-9 animate-pulse rounded bg-surface-2" />
      </div>
      <p v-else class="px-5 py-8 text-center text-sm text-slate-500">Todavía no hay árbitros en esta categoría y función.</p>

      <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-xs text-slate-500">
        <span>{{ rated ? 'Media de las notas de los equipos.' : 'Aún no hay notas en esta categoría: la primera la pone un equipo tras su partido.' }}</span>
        <RouterLink :to="fullList" class="text-sm font-semibold text-brand-500 hover:underline">Todos los árbitros de {{ category?.name ?? 'la categoría' }} →</RouterLink>
      </footer>
    </div>
  </section>
</template>
