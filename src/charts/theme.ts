// Tema visual de los gráficos (Apache ECharts) alineado con la paleta oscura de la app.

export const CHART_THEME = 'tercer-tiempo';

export const palette = {
  emerald: '#2fd3a3',
  emeraldDark: '#16a883',
  sky: '#5aa0ff',
  cyan: '#35d3ff',
  amber: '#f5b53f',
  rose: '#ff6b81',
  violet: '#a78bfa',
  slate: '#94a2cb',
  teal: '#2dd4bf',
  orange: '#fb923c',
};

/** Colores de serie por orden (jugadores del comparador, bloques de la nota...). */
export const seriesColors = [palette.sky, palette.emerald, palette.violet, palette.amber, palette.rose, palette.cyan];

/** Escala de color de las notas: rojo por debajo de 6, verde a partir de 7, azul a partir de 8. */
export const ratingScale = [
  { lt: 6, color: '#ff5c73', label: '< 6' },
  { gte: 6, lt: 6.5, color: '#fb923c', label: '6 – 6,4' },
  { gte: 6.5, lt: 7, color: '#eab308', label: '6,5 – 6,9' },
  { gte: 7, lt: 8, color: '#22c55e', label: '7 – 7,9' },
  { gte: 8, lt: 9, color: '#2f7bff', label: '8 – 8,9' },
  { gte: 9, color: '#8b5cf6', label: '9 – 10' },
] as const;

export function ratingColor(rating: number | null | undefined): string {
  if (rating === null || rating === undefined) return '#2c4075';
  for (const band of ratingScale) {
    const aboveMin = !('gte' in band) || rating >= band.gte;
    const belowMax = !('lt' in band) || rating < band.lt;
    if (aboveMin && belowMax) return band.color;
  }
  return '#8b5cf6';
}

const font = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const display = 'Sora, Inter, ui-sans-serif, system-ui, sans-serif';

export const themeDefinition = {
  color: seriesColors,
  backgroundColor: 'transparent',
  textStyle: { fontFamily: font, color: '#c5cfec' },
  title: { textStyle: { color: '#f1f4ff', fontWeight: 600, fontSize: 14, fontFamily: display } },
  legend: {
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 8,
    itemGap: 14,
    textStyle: { color: '#afbbde', fontSize: 12 },
    pageTextStyle: { color: '#94a2cb' },
    pageIconColor: '#5aa0ff',
    pageIconInactiveColor: '#2c4075',
  },
  tooltip: {
    backgroundColor: 'rgba(8, 18, 41, 0.96)',
    borderWidth: 1,
    borderColor: 'rgba(90, 160, 255, 0.35)',
    padding: [10, 12],
    textStyle: { color: '#f1f4ff', fontSize: 12, fontFamily: font },
    extraCssText: 'border-radius: 12px; box-shadow: 0 16px 40px rgba(2, 8, 30, 0.7); backdrop-filter: blur(8px);',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: 'rgba(148, 162, 203, 0.35)' } },
    axisTick: { show: false },
    axisLabel: { color: '#94a2cb', fontSize: 11, lineHeight: 14 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisLabel: { color: '#6f7ea9', fontSize: 11 },
    splitLine: { lineStyle: { color: 'rgba(148, 162, 203, 0.16)', type: 'dashed' } },
    nameTextStyle: { color: '#6f7ea9', fontSize: 11 },
  },
  radar: {
    symbolSize: 5,
    lineStyle: { width: 2 },
    axisName: { color: '#afbbde' },
    splitLine: { lineStyle: { color: 'rgba(148, 162, 203, 0.22)' } },
    splitArea: { areaStyle: { color: ['rgba(47, 123, 255, 0.06)', 'rgba(47, 123, 255, 0.02)'] } },
    axisLine: { lineStyle: { color: 'rgba(148, 162, 203, 0.22)' } },
  },
  line: { smooth: 0.35, symbol: 'circle', symbolSize: 8, lineStyle: { width: 3 } },
  bar: { itemStyle: { borderRadius: [6, 6, 0, 0] } },
  pie: { itemStyle: { borderColor: '#0b1a3a', borderWidth: 2, borderRadius: 6 } },
};
