<script setup lang="ts">
// Titular o suplente en una línea de acta, con los colores del acta pública: verde campo el titular, gris el que entró
// desde el banquillo. Quien no jugó no lleva marca.
const props = withDefaults(defineProps<{ started: boolean; played?: boolean }>(), { played: true });
</script>

<template>
  <span
    v-if="props.started"
    class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-emerald-500/15 px-1 font-display text-[11px] font-bold text-emerald-700"
    title="Titular"
    aria-label="Titular"
  >T</span>
  <span
    v-else-if="props.played"
    class="inline-flex h-5 min-w-5 items-center justify-center rounded bg-slate-500/10 px-1 font-display text-[11px] font-bold text-slate-600"
    title="Suplente: entró desde el banquillo"
    aria-label="Suplente"
  >S</span>
</template>
