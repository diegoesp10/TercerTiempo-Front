<script setup lang="ts">
import { computed } from 'vue';
import type { PlayerTrainingTallyDto } from '@/types/api';
import { outcomeBar, outcomeLabels, type Outcome } from './attendance';

// Barra apilada de un jugador: vino, faltó avisando, faltó sin avisar y lesionado, en proporción.
const props = defineProps<{ player: PlayerTrainingTallyDto; tall?: boolean }>();

const parts = computed(() => {
  const p = props.player;
  const total = p.sessions + p.injured;
  const counts: [Outcome, number][] = [
    ['Attended', p.attended],
    ['Warned', p.warned],
    ['Missed', p.missed - p.warned],
    ['Injured', p.injured],
  ];
  return total === 0 ? [] : counts.filter(([, n]) => n > 0).map(([o, n]) => ({ outcome: o, n, width: `${(n * 100) / total}%` }));
});
const title = computed(() => parts.value.map((p) => `${outcomeLabels[p.outcome]}: ${p.n}`).join(' · ') || 'Ningún entrenamiento le tocaba');
</script>

<template>
  <div class="flex overflow-hidden rounded-full bg-surface-2" :class="tall ? 'h-3' : 'h-2'" :title="title" role="img" :aria-label="title">
    <span v-for="p in parts" :key="p.outcome" :class="outcomeBar[p.outcome]" class="h-full first:rounded-l-full last:rounded-r-full" :style="{ width: p.width }" />
  </div>
</template>
