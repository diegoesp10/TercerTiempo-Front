<script setup lang="ts">
import { computed } from 'vue';
import ResponsiveTabs from '@/components/ui/ResponsiveTabs.vue';
import type { TabItem } from '@/components/ui/tabs';
import type { Position } from '@/types/api';
import { positionLabels } from '@/utils/format';
import { keyStatsFor } from '@/utils/keyStats';

// La banda de la cabecera trae el dato que más dice de cada puesto (paradas, despejes, pases, tiros...). Con esto, quien
// mira la ficha la ve como la de cualquier puesto para el mismo jugador. Empieza en el suyo, que ya sale en la cabecera.
const props = defineProps<{ own: Position | null; you?: boolean }>();
const model = defineModel<Position | null>({ required: true });

const what = (position: Position) =>
  keyStatsFor(position)
    .map((stat, index) => (index ? stat.label.toLowerCase() : stat.label))
    .join(' y ');

// «Centrocampista» es la etiqueta larga: si no caben las cuatro, se prueba con «Medio» antes de plegarlas en un menú.
const items = computed<TabItem[]>(() =>
  (Object.keys(positionLabels) as Position[]).map((key) => ({
    key,
    label: positionLabels[key],
    short: key === 'Midfielder' ? 'Medio' : undefined,
    title: key === props.own ? `${props.you ? 'Tu' : 'Su'} puesto · ${what(key)}` : what(key),
  })),
);
</script>

<template>
  <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
    <span class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" aria-hidden="true">Resumen como</span>
    <ResponsiveTabs :model-value="model" :items="items" label="Resumen como" variant="toggle" @update:model-value="model = $event as Position" />
  </div>
</template>
