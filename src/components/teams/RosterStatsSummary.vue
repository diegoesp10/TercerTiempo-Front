<script setup lang="ts">
import BallIcon from '@/components/ui/BallIcon.vue';
import CardIcon from '@/components/ui/CardIcon.vue';
import type { RosterEntryStatsDto } from '@/types/api';

// Resumen de temporada de una ficha según las actas oficiales: goles, tarjetas y minutos.
defineProps<{ stats: RosterEntryStatsDto | null }>();
</script>

<template>
  <span v-if="!stats" class="text-xs text-slate-400">Sin actas</span>
  <span v-else class="inline-flex items-center gap-3 whitespace-nowrap text-sm tabular-nums text-slate-700">
    <span class="inline-flex items-center gap-1" :title="`${stats.goals} goles`"><BallIcon title="Goles" /> {{ stats.goals }}</span>
    <span class="inline-flex items-center gap-1" :title="`${stats.yellowCards} amarillas`"><CardIcon kind="yellow" title="Amarillas" /> {{ stats.yellowCards }}</span>
    <span class="inline-flex items-center gap-1" :title="`${stats.redCards} rojas`"><CardIcon kind="red" title="Rojas" /> {{ stats.redCards }}</span>
    <span class="text-slate-500" :title="`${stats.minutesPlayed} minutos en ${stats.appearances} partidos`">{{ stats.minutesPlayed }}'</span>
  </span>
</template>
