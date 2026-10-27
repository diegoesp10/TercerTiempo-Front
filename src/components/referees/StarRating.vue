<script setup lang="ts">
import { computed } from 'vue';
import { formatScore } from '@/utils/format';

/** Nota de 0 a 10 en diez estrellas, una por punto (una media de 7,5 llena siete y media). */
const props = withDefaults(defineProps<{ score: number | null; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' });

const fill = computed(() => `${Math.max(0, Math.min(10, props.score ?? 0)) * 10}%`);
const iconClass = computed(() => ({ sm: 'h-2.5 w-2.5', md: 'h-3.5 w-3.5', lg: 'h-5 w-5' })[props.size]);
</script>

<template>
  <span class="relative inline-flex shrink-0" role="img" :aria-label="score === null ? 'Sin notas' : `${formatScore(score)} de 10`">
    <span class="flex gap-px text-slate-400/30" aria-hidden="true">
      <Icon v-for="star in 10" :key="star" icon="star" :class="iconClass" />
    </span>
    <span v-if="score !== null" class="absolute inset-y-0 left-0 flex gap-px overflow-hidden text-amber-400" :style="{ width: fill }" aria-hidden="true">
      <Icon v-for="star in 10" :key="star" icon="star" class="shrink-0" :class="iconClass" />
    </span>
  </span>
</template>
