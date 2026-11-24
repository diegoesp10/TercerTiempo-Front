<script setup lang="ts">
import CardIcon from '@/components/ui/CardIcon.vue';

/** Tarjetas acumuladas (las de una temporada): la amarilla y la roja con su número. Sin ninguna no pinta nada. */
withDefaults(defineProps<{ yellowCards: number; redCards: number; title?: string }>(), { title: undefined });
</script>

<template>
  <span v-if="yellowCards > 0 || redCards > 0" class="inline-flex items-center gap-2 text-xs tabular-nums text-slate-600" :title="title">
    <span v-if="yellowCards > 0" class="inline-flex items-center gap-1"><CardIcon kind="yellow" small :title="`${yellowCards} ${yellowCards === 1 ? 'amarilla' : 'amarillas'}`" />{{ yellowCards }}</span>
    <span v-if="redCards > 0" class="inline-flex items-center gap-1"><CardIcon kind="red" small :title="`${redCards} ${redCards === 1 ? 'roja' : 'rojas'}`" />{{ redCards }}</span>
  </span>
</template>
