<script setup lang="ts">
import { computed } from 'vue';
import type { InjuryDto } from '@/types/api';
import { formatDate } from '@/utils/format';

/**
 * El contador de una lesión abierta: los días de baja reales contados desde el parte, del día del parte a la vuelta
 * prevista y cuánto falta (o cuánto se ha pasado) respecto a lo previsto. La duración media del tipo es solo una
 * referencia: lo que cuenta es lo que lleva de verdad.
 */
const props = defineProps<{ injury: InjuryDto }>();

const days = computed(() => props.injury.daysOut);
const expected = computed(() => props.injury.expectedDays ?? null);
const left = computed(() => props.injury.daysLeft ?? null);
const overdue = computed(() => left.value !== null && left.value < 0);
const progress = computed(() => {
  if (expected.value === null) return null;
  if (expected.value <= 0) return 100;
  return Math.min(100, Math.round((days.value / expected.value) * 100));
});
const remaining = computed(() => {
  const n = left.value;
  if (n === null) return 'Sin fecha de vuelta prevista';
  if (n > 1) return `Faltan ${n} días para la vuelta prevista`;
  if (n === 1) return 'Mañana es la vuelta prevista';
  if (n === 0) return 'Hoy es la vuelta prevista';
  return -n === 1 ? 'Lleva 1 día más de lo previsto' : `Lleva ${-n} días más de lo previsto`;
});
// Si la previsión ha cambiado desde el parte, la de entonces queda a la vista para comparar.
const initial = computed(() => {
  const i = props.injury;
  return i.initialExpectedDays != null && i.initialExpectedDays !== i.expectedDays ? i.initialExpectedDays : null;
});
</script>

<template>
  <div class="mt-2 rounded-xl border border-line bg-surface-2 p-3">
    <div class="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <p class="flex items-baseline gap-1.5">
        <span class="font-display text-3xl font-semibold leading-none tabular-nums" :class="overdue ? 'text-warning' : 'text-slate-900'">{{ days }}</span>
        <span class="text-sm text-slate-600">{{ days === 1 ? 'día de baja' : 'días de baja' }}<template v-if="days === 0"> · parte de hoy</template></span>
      </p>
      <p v-if="expected !== null" class="text-xs tabular-nums text-slate-500">{{ days }} de {{ expected }} previstos</p>
    </div>
    <div
      v-if="progress !== null"
      class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200"
      role="progressbar"
      :aria-valuenow="progress"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="`${days} de ${expected} días de baja previstos`"
    >
      <div class="h-full rounded-full" :class="overdue ? 'bg-warning' : 'bg-brand-500'" :style="{ width: `${progress}%` }" />
    </div>
    <p class="mt-2 text-xs text-slate-600">
      Parte del {{ formatDate(injury.startedOn) }}<template v-if="injury.expectedReturnOn"> → vuelta prevista el {{ formatDate(injury.expectedReturnOn) }}</template>
    </p>
    <p class="mt-0.5 text-xs font-medium" :class="overdue ? 'text-warning' : 'text-slate-700'">{{ remaining }}</p>
    <p v-if="initial !== null || injury.averageDays" class="mt-1 text-2xs text-slate-500">
      <template v-if="initial !== null">Al dar el parte se previeron {{ initial }} días. </template>
      <template v-if="injury.averageDays">Media orientativa de esta lesión: ≈ {{ injury.averageDays }} días.</template>
    </p>
  </div>
</template>
