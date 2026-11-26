<script setup lang="ts">
import { computed, defineAsyncComponent, h } from 'vue';
import type { EChartsOption } from 'echarts';
import { CHART_THEMES } from '@/charts/theme';
import { useSettingsStore } from '@/stores/settings';

// ECharts (~260 KB) se descarga y se registra cuando se monta el primer gráfico, no al cargar la página que lo
// contiene: la página se pinta sin esperarlo y, mientras llega, queda el hueco con el alto del gráfico.
const VChart = defineAsyncComponent({
  loader: async () => {
    const [{ setupCharts }, { default: component }] = await Promise.all([import('@/charts/setup'), import('vue-echarts')]);
    setupCharts();
    return component;
  },
  loadingComponent: { render: () => h('div', { class: 'skeleton h-full w-full rounded-lg' }) },
  delay: 150,
});

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
  <div class="w-full" role="img" :aria-label="label" :style="{ height: `${height}px` }">
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
