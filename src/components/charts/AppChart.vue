<script lang="ts">
// ECharts se registra al cargar este componente (no en main.ts): así la librería va en un chunk aparte que solo se
// descarga en las páginas con gráficos.
import { CHART_THEME, setupCharts } from '@/charts/setup';

setupCharts();
</script>

<script setup lang="ts">
import VChart from 'vue-echarts';
import type { EChartsOption } from 'echarts';

withDefaults(
  defineProps<{
    option: EChartsOption;
    /** Alto del gráfico en píxeles. */
    height?: number;
    /** Descripción para lectores de pantalla. */
    label?: string;
  }>(),
  { height: 300, label: 'Gráfico' },
);
</script>

<template>
  <div class="w-full" role="img" :aria-label="label">
    <VChart
      :option="option"
      :theme="CHART_THEME"
      :autoresize="{ throttle: 120 }"
      :style="{ height: `${height}px` }"
      class="w-full"
    />
  </div>
</template>
