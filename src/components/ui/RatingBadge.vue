<script setup lang="ts">
import { computed } from 'vue';
import { ratingColor } from '@/charts/theme';

const props = withDefaults(defineProps<{ rating: number | null | undefined; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' });

const text = computed(() =>
  props.rating === null || props.rating === undefined
    ? '—'
    : props.rating.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
);

const sizes = { sm: 'min-w-8 px-1.5 py-0.5 text-xs', md: 'min-w-10 px-2 py-0.5 text-sm', lg: 'min-w-14 px-3 py-1 text-xl' };
</script>

<template>
  <span
    class="inline-flex items-center justify-center rounded-md font-bold tabular-nums"
    :class="[sizes[size], rating === null || rating === undefined ? 'bg-slate-100 text-slate-400' : 'text-white']"
    :style="rating === null || rating === undefined ? undefined : { backgroundColor: ratingColor(rating) }"
    :title="rating === null || rating === undefined ? 'Sin nota (no jugó)' : 'Nota calculada con los datos del acta'"
  >
    {{ text }}
  </span>
</template>
