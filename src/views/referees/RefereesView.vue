<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StarRating from '@/components/referees/StarRating.vue';
import { useAsync } from '@/composables/useAsync';
import { formatDate, formatScore, officialRoleLabels } from '@/utils/format';

/** Árbitros con la nota media que les ponen los equipos tras cada partido (solo clubes y cuerpos técnicos). */
const { data, loading, error } = useAsync(() => api.referees.list());

const search = ref('');
type Sort = 'average' | 'ratings' | 'name';
const sort = ref<Sort>('average');
const sorts: { value: Sort; label: string }[] = [
  { value: 'average', label: 'Mejor nota' },
  { value: 'ratings', label: 'Más notas' },
  { value: 'name', label: 'Nombre' },
];

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const rows = computed(() => {
  const needle = normalize(search.value.trim());
  const list = (data.value ?? []).filter((r) => !needle || normalize(r.name).includes(needle));
  if (sort.value === 'name') return [...list].sort((a, b) => a.name.localeCompare(b.name, 'es'));
  if (sort.value === 'ratings') return [...list].sort((a, b) => b.ratings - a.ratings || (b.average ?? -1) - (a.average ?? -1));
  return list;
});
const rated = computed(() => (data.value ?? []).filter((r) => r.ratings > 0).length);
</script>

<template>
  <div>
    <PageHeader title="Árbitros" subtitle="La nota que les ponen los clubes y sus cuerpos técnicos después de cada partido, de 0 a 10." />

    <Spinner v-if="loading && !data" class="my-12" />
    <Alert v-else-if="error" kind="error">{{ error }}</Alert>

    <template v-else-if="data">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label class="relative w-full max-w-sm">
          <span class="sr-only">Buscar árbitro</span>
          <Icon icon="magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input v-model="search" type="search" class="input w-full pl-9" placeholder="Buscar por nombre" />
        </label>
        <div class="inline-flex rounded-full border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Ordenar">
          <button
            v-for="option in sorts"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="sort === option.value"
            class="rounded-full px-3 py-1 text-xs font-semibold transition"
            :class="sort === option.value ? 'bg-action text-white' : 'text-slate-600 hover:text-slate-900'"
            @click="sort = option.value"
          >{{ option.label }}</button>
        </div>
      </div>

      <p class="mb-3 text-xs text-slate-500">{{ data.length }} árbitros en los partidos guardados · {{ rated }} con notas.</p>

      <p v-if="rows.length === 0" class="card text-sm text-slate-500">
        {{ data.length === 0 ? 'Todavía no hay equipos arbitrales guardados: salen de las actas de la federación y de futbolasturiano.es.' : 'Ningún árbitro con ese nombre.' }}
      </p>
      <div v-else class="card overflow-x-auto p-0">
        <table class="min-w-full text-sm">
          <thead class="border-b border-line text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-4 py-3">Árbitro</th>
              <th class="px-4 py-3">Nota media</th>
              <th class="px-4 py-3 text-center">Notas</th>
              <th class="hidden px-4 py-3 text-center sm:table-cell">Partidos</th>
              <th class="hidden px-4 py-3 md:table-cell">Último partido</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="referee in rows" :key="referee.id" class="hover:bg-surface-2">
              <td class="px-4 py-3">
                <RouterLink :to="{ name: 'referee', params: { refereeId: referee.id } }" class="font-semibold text-slate-900 hover:text-accent-400">{{ referee.name }}</RouterLink>
                <p class="text-xs text-slate-500">{{ officialRoleLabels[referee.mainRole] }}</p>
              </td>
              <td class="px-4 py-3">
                <span class="flex items-center gap-2">
                  <StarRating :score="referee.average" size="sm" />
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
      <p class="mt-3 text-xs text-slate-500">
        Las notas son una referencia entre clubes: las pone el club o el cuerpo técnico de cada equipo tras su partido y solo las ven otros clubes y cuerpos técnicos.
      </p>
    </template>
  </div>
</template>
