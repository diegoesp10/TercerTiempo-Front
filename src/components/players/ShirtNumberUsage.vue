<script setup lang="ts">
import type { ShirtNumberUsageDto } from '@/types/api';

/**
 * Dorsales que ha llevado un jugador, del más usado al menos, con la parte de sus partidos en la que llevó cada uno.
 * No hay un dorsal fijo: el de cada partido sale de su acta.
 */
defineProps<{ usage: ShirtNumberUsageDto[] }>();
</script>

<template>
  <ul class="space-y-2.5">
    <li v-for="(u, i) in usage" :key="u.number" class="flex items-center gap-3">
      <span
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border font-figures text-lg font-extrabold tabular-nums"
        :class="i === 0 ? 'border-brand-500 bg-brand-500/10 text-slate-900' : 'border-line bg-surface-2 text-slate-600'"
      >{{ u.number }}</span>
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="text-slate-600">
            {{ u.matches }} {{ u.matches === 1 ? 'partido' : 'partidos' }}
            <span v-if="i === 0 && usage.length > 1" class="ml-1 text-xs text-slate-500">· el más usado</span>
          </span>
          <span class="font-figures font-bold tabular-nums text-slate-900">{{ u.percentage }} %</span>
        </div>
        <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-3" role="presentation">
          <div class="h-full rounded-full" :class="i === 0 ? 'bg-brand-500' : 'bg-slate-400'" :style="{ width: `${u.percentage}%` }" />
        </div>
      </div>
    </li>
  </ul>
</template>
