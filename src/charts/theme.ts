// Temas visuales de los gráficos (Apache ECharts), uno por tema de la interfaz (claro / oscuro).

export const CHART_THEMES = { light: 'tercer-tiempo-light', dark: 'tercer-tiempo-dark' } as const;
export type ChartTheme = keyof typeof CHART_THEMES;

export const palette = {
  emerald: '#22a35f',
  emeraldDark: '#156e42',
  sky: '#2f7bff',
  cyan: '#12b6e6',
  amber: '#f5b53f',
  rose: '#e8445f',
  violet: '#8b5cf6',
  slate: '#8a95a8',
  teal: '#14b8a6',
  orange: '#f97316',
};

/** Colores de serie por orden (jugadores del comparador, bloques de la nota...). Valen sobre fondo claro y oscuro. */
export const seriesColors = [palette.sky, palette.emerald, palette.violet, palette.amber, palette.rose, palette.cyan];

/** Tintas para nombres sobre las superficies de la interfaz; conservan el tono de cada serie. */
export const seriesTextColors = {
  light: ['#1558c2', '#156e42', '#6d28d9', '#925400', '#ad1f38', '#086f99'],
  dark: ['#8ab4ff', '#4fe2b6', '#c4b5fd', '#ffd98a', '#ff8597', '#8fe8ff'],
};

/** Texto negro o blanco con el mayor contraste sobre un color #RRGGBB de la paleta. */
export function textOnColor(color: string | undefined): string {
  const hex = (color ?? palette.slate).replace('#', '');
  const linear = [0, 2, 4].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#000000' : '#ffffff';
}

/** Escala de color de las notas: rojo por debajo de 6, verde a partir de 7, azul a partir de 8. */
export const ratingScale = [
  { lt: 6, color: '#e8445f', label: '< 6' },
  { gte: 6, lt: 6.5, color: '#f97316', label: '6 – 6,4' },
  { gte: 6.5, lt: 7, color: '#d6a400', label: '6,5 – 6,9' },
  { gte: 7, lt: 8, color: '#22a35f', label: '7 – 7,9' },
  { gte: 8, lt: 9, color: '#2f7bff', label: '8 – 8,9' },
  { gte: 9, color: '#8b5cf6', label: '9 – 10' },
] as const;

export function ratingColor(rating: number | null | undefined): string {
  if (rating === null || rating === undefined) return '#8a95a8';
  for (const band of ratingScale) {
    const aboveMin = !('gte' in band) || rating >= band.gte;
    const belowMax = !('lt' in band) || rating < band.lt;
    if (aboveMin && belowMax) return band.color;
  }
  return '#8b5cf6';
}

const font = 'Archivo, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const display = font;

interface ChartPalette {
  text: string;
  textStrong: string;
  textMuted: string;
  axisLine: string;
  gridLine: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipText: string;
  pieBorder: string;
  radarArea: [string, string];
}

function buildTheme(c: ChartPalette) {
  return {
    color: seriesColors,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: font, color: c.text },
    title: { textStyle: { color: c.textStrong, fontWeight: 600, fontSize: 15, fontFamily: display }, subtextStyle: { color: c.textMuted } },
    legend: {
      icon: 'roundRect',
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 14,
      textStyle: { color: c.text, fontSize: 12 },
      pageTextStyle: { color: c.textMuted },
      pageIconColor: palette.sky,
      pageIconInactiveColor: c.gridLine,
    },
    tooltip: {
      backgroundColor: c.tooltipBg,
      borderWidth: 1,
      borderColor: c.tooltipBorder,
      padding: [10, 12],
      textStyle: { color: c.tooltipText, fontSize: 12, fontFamily: font },
      extraCssText: 'border-radius: 10px; box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);',
    },
    categoryAxis: {
      axisLine: { lineStyle: { color: c.axisLine } },
      axisTick: { show: false },
      axisLabel: { color: c.textMuted, fontSize: 11, lineHeight: 14 },
      splitLine: { show: false },
    },
    valueAxis: {
      axisLine: { show: false },
      axisLabel: { color: c.textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: c.gridLine, type: 'dashed' } },
      nameTextStyle: { color: c.textMuted, fontSize: 11 },
    },
    radar: {
      symbolSize: 5,
      lineStyle: { width: 2 },
      axisName: { color: c.text },
      splitLine: { lineStyle: { color: c.gridLine } },
      splitArea: { areaStyle: { color: c.radarArea } },
      axisLine: { lineStyle: { color: c.gridLine } },
    },
    line: { smooth: 0.35, symbol: 'circle', symbolSize: 8, lineStyle: { width: 3 } },
    bar: { itemStyle: { borderRadius: [4, 4, 0, 0] } },
    pie: { itemStyle: { borderColor: c.pieBorder, borderWidth: 2, borderRadius: 4 } },
  };
}

export const chartPalettes: Record<ChartTheme, ChartPalette> = {
  light: {
    text: '#48536a',
    textStrong: '#101828',
    textMuted: '#5f6b80',
    axisLine: 'rgba(16, 24, 40, 0.25)',
    gridLine: 'rgba(16, 24, 40, 0.1)',
    tooltipBg: 'rgba(255, 255, 255, 0.98)',
    tooltipBorder: 'rgba(16, 24, 40, 0.12)',
    tooltipText: '#101828',
    pieBorder: '#ffffff',
    radarArea: ['rgba(31, 111, 232, 0.05)', 'rgba(31, 111, 232, 0.02)'],
  },
  dark: {
    text: '#c8d1e5',
    textStrong: '#f2f5fb',
    textMuted: '#98a6c4',
    axisLine: 'rgba(152, 166, 196, 0.35)',
    gridLine: 'rgba(152, 166, 196, 0.16)',
    tooltipBg: 'rgba(14, 23, 41, 0.97)',
    tooltipBorder: 'rgba(90, 155, 255, 0.35)',
    tooltipText: '#f2f5fb',
    pieBorder: '#111a2c',
    radarArea: ['rgba(47, 123, 255, 0.06)', 'rgba(47, 123, 255, 0.02)'],
  },
};

export const themeDefinitions = {
  light: buildTheme(chartPalettes.light),
  dark: buildTheme(chartPalettes.dark),
};
