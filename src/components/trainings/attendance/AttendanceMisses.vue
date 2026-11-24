<script setup lang="ts">
import { computed } from 'vue';
import { dayLong, dayShort, outcomeIcons, outcomeLabels, time, type AttendanceMiss } from './attendance';

// Las faltas de un jugador en una línea, debajo de su fila cuando se filtra por faltas: el día con el color de cómo faltó
// (avisando o sin avisar) y, al lado, el motivo apuntado. Si son muchas, las más recientes y «ver todas».
const props = withDefaults(defineProps<{ misses: AttendanceMiss[]; max?: number }>(), { max: 8 });
defineEmits<{ more: [] }>();

const shown = computed(() => props.misses.slice(0, props.max));

const tone: Record<AttendanceMiss['outcome'], string> = {
  Warned: 'bg-amber-400/20 text-amber-700',
  Missed: 'bg-red-500/15 text-red-700',
};

const title = (m: AttendanceMiss) =>
  `${dayLong(m.day.date)}, ${time(m.day.date)} · ${m.day.title}: ${outcomeLabels[m.outcome].toLowerCase()}${m.reason ? ` — ${m.reason}` : ' (sin motivo apuntado)'}`;
</script>

<template>
  <ul class="flex flex-wrap gap-1.5" aria-label="Faltas">
    <li v-for="m in shown" :key="m.day.sessionId" class="inline-flex max-w-full overflow-hidden rounded-lg border border-line bg-surface text-xs" :title="title(m)">
      <span class="flex shrink-0 items-center gap-1 px-2 py-1 font-semibold" :class="tone[m.outcome]">
        <Icon :icon="outcomeIcons[m.outcome]" class="h-2.5 w-2.5" aria-hidden="true" />
        <span class="sr-only">{{ outcomeLabels[m.outcome] }}:</span>{{ dayShort(m.day.date) }}
      </span>
      <span v-if="m.reason" class="flex min-w-0 items-center gap-1.5 px-2 py-1 text-slate-800">
        <Icon icon="comment-dots" class="h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
        <span class="min-w-0 break-words">{{ m.reason }}</span>
      </span>
      <span v-else class="px-2 py-1 italic text-slate-400">sin motivo</span>
    </li>
    <li v-if="misses.length > max">
      <button type="button" class="rounded-lg px-2 py-1 text-xs font-medium text-brand-500 hover:bg-surface-2" @click="$emit('more')">y {{ misses.length - max }} más · ver todas</button>
    </li>
  </ul>
</template>
