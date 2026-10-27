// Registro de Apache ECharts: solo los gráficos y componentes que usa la app (tree-shaking) y el tema propio.
import { registerTheme, use } from 'echarts/core';
import { BarChart, HeatmapChart, LineChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { CHART_THEMES, themeDefinitions } from './theme';

let registered = false;

export function setupCharts() {
  if (registered) return;

  use([
    CanvasRenderer,
    LineChart,
    BarChart,
    RadarChart,
    PieChart,
    ScatterChart,
    HeatmapChart,
    GridComponent,
    DataZoomComponent,
    MarkAreaComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    MarkLineComponent,
    RadarComponent,
    VisualMapComponent,
  ]);

  registerTheme(CHART_THEMES.light, themeDefinitions.light);
  registerTheme(CHART_THEMES.dark, themeDefinitions.dark);
  registered = true;
}

export { CHART_THEMES };
