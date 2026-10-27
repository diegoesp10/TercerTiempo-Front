<script setup lang="ts">
import { computed } from 'vue';
import { formatScore } from '@/utils/format';

/** Nota de 0 a 10 en cinco estrellas (cada punto es media estrella). */
const props = withDefaults(defineProps<{ score: number | null; size?: 'sm' | 'md' | 'lg' }>(), { size: 'md' });

const fill = computed(() => `${Math.max(0, Math.min(10, props.score ?? 0)) * 10}%`);
const iconClass = computed(() => ({ sm: 'h-3 w-3', md: 'h-4 w-4', lg: 'h-6 w-6' })[props.size]);
</script>

<template>
  <span class="relative inline-flex shrink-0" role="img" :aria-label="score === null ? 'Sin notas' : `${formatScore(score)} de 10`">
    <span class="flex gap-0.5 text-slate-400/30" aria-hidden="true">
      <Icon v-for="star in 5" :key="star" icon="star" :class="iconClass" />
    </span>
    <span v-if="score !== null" class="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-amber-400" :style="{ width: fill }" aria-hidden="true">
      <Icon v-for="star in 5" :key="star" icon="star" class="shrink-0" :class="iconClass" />
    </span>
  </span>
</template>
