<script lang="ts">
// ECharts se registra al cargar este componente (no en main.ts): así la librería va en un chunk aparte que solo se
// descarga en las páginas con gráficos.
import { setupCharts } from '@/charts/setup';

setupCharts();
</script>

<script setup lang="ts">
import { computed } from 'vue';
import VChart from 'vue-echarts';
import type { EChartsOption } from 'echarts';
import { CHART_THEMES } from '@/charts/setup';
import { useSettingsStore } from '@/stores/settings';

const settings = useSettingsStore();
// Al cambiar de tema se vuelve a montar el gráfico con el tema de ECharts correspondiente.
const theme = computed(() => CHART_THEMES[settings.resolvedTheme]);

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
      :key="theme"
      :option="option"
      :theme="theme"
      :autoresize="{ throttle: 120 }"
      :style="{ height: `${height}px` }"
      class="w-full"
    />
  </div>
</template>
