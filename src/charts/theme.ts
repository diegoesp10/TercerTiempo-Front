// Tema visual de los gráficos (Apache ECharts) alineado con la paleta de Tailwind de la app.

export const CHART_THEME = 'tercer-tiempo';

export const palette = {
  emerald: '#10b981',
  emeraldDark: '#047857',
  sky: '#0ea5e9',
  amber: '#f59e0b',
  rose: '#f43f5e',
  violet: '#8b5cf6',
  slate: '#64748b',
  teal: '#14b8a6',
  orange: '#f97316',
};

/** Colores de serie por orden (jugadores del comparador, bloques de la nota...). */
export const seriesColors = [palette.emerald, palette.sky, palette.violet, palette.amber, palette.rose, palette.teal];

/** Escala de color de las notas: rojo por debajo de 6, verde a partir de 7, azul a partir de 8. */
export const ratingScale = [
  { lt: 6, color: '#ef4444', label: '< 6' },
  { gte: 6, lt: 6.5, color: '#f97316', label: '6 – 6,4' },
  { gte: 6.5, lt: 7, color: '#eab308', label: '6,5 – 6,9' },
  { gte: 7, lt: 8, color: '#22c55e', label: '7 – 7,9' },
  { gte: 8, lt: 9, color: '#0ea5e9', label: '8 – 8,9' },
  { gte: 9, color: '#6366f1', label: '9 – 10' },
] as const;

export function ratingColor(rating: number | null | undefined): string {
  if (rating === null || rating === undefined) return '#cbd5e1';
  for (const band of ratingScale) {
    const aboveMin = !('gte' in band) || rating >= band.gte;
    const belowMax = !('lt' in band) || rating < band.lt;
    if (aboveMin && belowMax) return band.color;
  }
  return '#6366f1';
}

const font = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export const themeDefinition = {
  color: seriesColors,
  backgroundColor: 'transparent',
  textStyle: { fontFamily: font, color: '#334155' },
  title: { textStyle: { color: '#0f172a', fontWeight: 600, fontSize: 14, fontFamily: font } },
  legend: {
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 8,
    itemGap: 14,
    textStyle: { color: '#475569', fontSize: 12 },
  },
  tooltip: {
    backgroundColor: 'rgba(15, 23, 42, 0.94)',
    borderWidth: 0,
    padding: [10, 12],
    textStyle: { color: '#f8fafc', fontSize: 12, fontFamily: font },
    extraCssText: 'border-radius: 12px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.28);',
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#cbd5e1' } },
    axisTick: { show: false },
    axisLabel: { color: '#64748b', fontSize: 11, lineHeight: 14 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisLabel: { color: '#94a3b8', fontSize: 11 },
    splitLine: { lineStyle: { color: '#e2e8f0', type: 'dashed' } },
    nameTextStyle: { color: '#94a3b8', fontSize: 11 },
  },
  line: { smooth: 0.35, symbol: 'circle', symbolSize: 8, lineStyle: { width: 3 } },
  bar: { itemStyle: { borderRadius: [6, 6, 0, 0] } },
  radar: { symbolSize: 5, lineStyle: { width: 2 } },
  pie: { itemStyle: { borderColor: '#fff', borderWidth: 2, borderRadius: 6 } },
};
