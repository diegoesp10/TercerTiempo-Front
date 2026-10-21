// Registro de Apache ECharts: solo los gráficos y componentes que usa la app (tree-shaking) y el tema propio.
import { registerTheme, use } from 'echarts/core';
import { BarChart, LineChart, PieChart, RadarChart, ScatterChart } from 'echarts/charts';
import {
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { CHART_THEME, themeDefinition } from './theme';

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
    GridComponent,
    TooltipComponent,
    LegendComponent,
    TitleComponent,
    MarkLineComponent,
    RadarComponent,
    VisualMapComponent,
  ]);

  registerTheme(CHART_THEME, themeDefinition);
  registered = true;
}

export { CHART_THEME };
