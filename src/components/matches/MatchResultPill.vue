<script setup lang="ts">
import { computed } from 'vue';
import type { MatchDto } from '@/types/api';
import { outcomeFor, outcomeLabels, resultStyle, resultText, scoreOf } from './matchResult';

// Resultado de un partido jugado para un equipo: la letra (V, E o D) en el color del resultado y el marcador al lado.
// No pinta nada si el partido aún no tiene resultado.
const props = withDefaults(defineProps<{ match: MatchDto; teamId: string; size?: 'xs' | 'sm' }>(), { size: 'sm' });

const outcome = computed(() => outcomeFor(props.match, props.teamId));
const score = computed(() => scoreOf(props.match));
</script>

<template>
  <span
    v-if="outcome && score"
    class="inline-flex shrink-0 items-stretch overflow-hidden rounded-md font-bold leading-none tabular-nums ring-1 ring-inset"
    :class="[resultStyle[outcome].ring, size === 'xs' ? 'text-2xs' : 'text-2xs']"
    :title="resultText(match, teamId) ?? undefined"
  >
    <span class="grid place-items-center" :class="[resultStyle[outcome].solid, size === 'xs' ? 'px-1' : 'px-1.5']" aria-hidden="true">{{ outcomeLabels[outcome] }}</span>
    <span class="grid place-items-center py-0.5" :class="[resultStyle[outcome].soft, size === 'xs' ? 'px-1' : 'px-1.5']">
      <span class="sr-only">{{ resultStyle[outcome].label }} </span>{{ score }}
    </span>
  </span>
</template>
