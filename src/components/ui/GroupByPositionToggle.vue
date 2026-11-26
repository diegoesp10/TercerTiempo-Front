<script setup lang="ts">
/** La casilla «Agrupar por posición», igual en todas las listas de jugadores. */
const enabled = defineModel<boolean>({ required: true });
</script>

<template>
  <label
    class="flex shrink-0 cursor-pointer items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-surface-2"
    title="Porteros, defensas, centrocampistas y delanteros por separado"
  >
    <input v-model="enabled" type="checkbox" class="h-4 w-4 cursor-pointer accent-brand-500" />Agrupar por posición
  </label>
</template>
