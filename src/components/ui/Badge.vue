<script setup lang="ts">
import type { OutcomeTone, Tone } from '@/utils/format';

withDefaults(defineProps<{ tone?: Tone | OutcomeTone }>(), { tone: 'slate' });

// green/amber/red/blue son los estados (correcto, aviso, error, información); win/draw/loss, el resultado de un partido
// con los colores de MatchResultPill.
const tones: Record<Tone | OutcomeTone, string> = {
  green: 'border-success-line bg-success-soft text-success-strong',
  amber: 'border-warning-line bg-warning-soft text-warning-strong',
  red: 'border-danger-line bg-danger-soft text-danger-strong',
  blue: 'border-info-line bg-info-soft text-info-strong',
  slate: 'border-line bg-slate-100 text-slate-700',
  win: 'border-win-solid/40 bg-win-solid/15 text-win',
  draw: 'border-draw-solid/50 bg-draw-solid/20 text-draw',
  loss: 'border-loss-solid/40 bg-loss-solid/15 text-loss',
};
</script>

<template>
  <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-semibold tracking-wide" :class="tones[tone]">
    <slot />
  </span>
</template>
