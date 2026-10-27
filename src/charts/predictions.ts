// Gráficos del previsor de resultados (Apache ECharts): funciones puras que reciben los DTOs del previsor.
import { graphic } from 'echarts/core';
import type { EChartsOption } from 'echarts';
import type { LeaguePredictionEvolutionDto, LeagueZonesDto, TeamPredictionDto } from '@/types/api';
import { chartPalettes, palette, seriesColors, type ChartTheme } from './theme';

export type PredictionMetric = 'champion' | 'promotion' | 'relegation';

export const metricLabels: Record<PredictionMetric, string> = {
  champion: 'Campeón',
  promotion: 'Ascenso o promoción',
  relegation: 'Descenso',
};

export const metricColors: Record<PredictionMetric, string> = {
  champion: palette.amber,
  promotion: palette.emerald,
  relegation: palette.rose,
};

const percent = (value: number) => `${(value * 100).toLocaleString('es-ES', { maximumFractionDigits: value < 0.01 && value > 0 ? 1 : 0 })} %`;

const dot = (color: string) =>
  `<span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${color};margin-right:6px"></span>`;

const horizontalGradient = (color: string) =>
  new graphic.LinearGradient(0, 0, 1, 0, [
    { offset: 0, color: `${color}66` },
    { offset: 1, color },
  ]);

/** Probabilidad de cada equipo de ser campeón, acabar en ascenso o promoción y descender, de mejor a peor previsión. */
export function predictionBarsOption(
  teams: TeamPredictionDto[], zones: LeagueZonesDto, theme: ChartTheme, labels: Record<PredictionMetric, string> = metricLabels,
): EChartsOption {
  const colors = chartPalettes[theme];
  const metrics: PredictionMetric[] = zones.relegation.length ? ['champion', 'promotion', 'relegation'] : ['champion', 'promotion'];
  const names = teams.map((t) => t.teamName);

  return {
    grid: { left: 8, right: 56, top: 36, bottom: 8, containLabel: true },
    legend: { top: 0, left: 0, data: metrics.map((m) => labels[m]) },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params) => {
        const index = (Array.isArray(params) ? params[0] : params)?.dataIndex ?? 0;
        const team = teams[index]!;
        const rows = metrics.map((m) => `${dot(metricColors[m])}${labels[m]}: <b>${percent(team[m])}</b>`).join('<br/>');
        return `<b>${team.teamName}</b><br/>Ahora ${team.position}.º con ${team.points} pts · acabaría ${team.expectedPosition.toLocaleString('es-ES', { maximumFractionDigits: 1 })}.º con ${team.expectedPoints.toLocaleString('es-ES', { maximumFractionDigits: 1 })} pts<br/>${rows}`;
      },
    },
    xAxis: {
      type: 'value',
      max: 100,
      axisLabel: { formatter: '{value} %' },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: names,
      axisLabel: { width: 150, overflow: 'truncate', color: colors.text, fontSize: 12 },
    },
    series: metrics.map((m) => ({
      name: labels[m],
      type: 'bar',
      barGap: '15%',
      barCategoryGap: '30%',
      itemStyle: { color: horizontalGradient(metricColors[m]), borderRadius: [0, 6, 6, 0] },
      emphasis: { focus: 'series' },
      label: {
        show: true,
        position: 'right',
        color: colors.textMuted,
        fontSize: 10,
        formatter: (p: { value: unknown }) => (Number(p.value) >= 1 ? `${Math.round(Number(p.value))} %` : ''),
      },
      data: teams.map((t) => Math.round(t[m] * 1000) / 10),
    })),
    animationDuration: 900,
    animationEasing: 'cubicOut',
  };
}

/** Dónde puede acabar cada equipo: probabilidad de cada puesto final, con los puestos coloreados como en la web de la liga. */
export function positionHeatmapOption(teams: TeamPredictionDto[], zones: LeagueZonesDto, theme: ChartTheme): EChartsOption {
  const colors = chartPalettes[theme];
  const positions = Array.from({ length: zones.teams }, (_, i) => i + 1);
  const data = teams.flatMap((team, row) => team.positionOdds.map((odds, col) => [col, row, Math.round(odds * 1000) / 10]));
  const max = Math.max(5, ...data.map((d) => d[2]!));
  const zoneColor = (position: number) =>
    zones.places.find((p) => p.position === position)?.color
    ?? (zones.promotion.includes(position) ? palette.emerald : zones.relegation.includes(position) ? palette.rose : colors.textMuted);

  return {
    grid: { left: 8, right: 16, top: 28, bottom: 64, containLabel: true },
    tooltip: {
      position: 'top',
      formatter: (p) => {
        const [col, row, value] = (p as { value: number[] }).value;
        return `<b>${teams[row!]!.teamName}</b><br/>Acabar ${col! + 1}.º: <b>${(value ?? 0).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %</b>`;
      },
    },
    xAxis: {
      type: 'category',
      position: 'top',
      data: positions.map((p) => `${p}.º`),
      splitArea: { show: true },
      axisLabel: { color: (_: unknown, index?: number) => zoneColor((index ?? 0) + 1), fontWeight: 600, fontSize: 11 },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: teams.map((t) => t.teamName),
      splitArea: { show: true },
      axisLabel: { width: 150, overflow: 'truncate', color: colors.text, fontSize: 12 },
    },
    visualMap: {
      min: 0,
      max,
      calculable: false,
      orient: 'horizontal',
      left: 'center',
      bottom: 4,
      itemWidth: 12,
      itemHeight: 180,
      text: [`${Math.round(max)} %`, '0 %'],
      textStyle: { color: colors.textMuted, fontSize: 11 },
      inRange: { color: theme === 'dark' ? ['#111a2c', '#1d3f7a', palette.sky, palette.cyan, '#c7f9ff'] : ['#f4f7fb', '#bcd4ff', palette.sky, '#1558c2', '#0b2f6b'] },
    },
    series: [{
      type: 'heatmap',
      data,
      label: {
        show: true,
        fontSize: 10,
        color: theme === 'dark' ? '#f2f5fb' : '#101828',
        formatter: (p: { value: unknown }) => {
          const value = (p.value as number[])[2] ?? 0;
          return value >= 5 ? `${Math.round(value)}` : '';
        },
      },
      itemStyle: { borderColor: theme === 'dark' ? '#0b1220' : '#ffffff', borderWidth: 1, borderRadius: 3 },
      emphasis: { itemStyle: { shadowBlur: 12, shadowColor: 'rgba(47, 123, 255, 0.6)' } },
    }],
    animationDuration: 700,
  };
}

/** Cómo ha cambiado la probabilidad de cada equipo jornada a jornada: los mejor colocados (y los tuyos) a la vista. */
export function predictionEvolutionOption(
  evolution: LeaguePredictionEvolutionDto, metric: PredictionMetric, highlighted: string[], theme: ChartTheme,
): EChartsOption {
  const colors = chartPalettes[theme];
  const ranked = [...evolution.teams].sort((a, b) => (b[metric].at(-1) ?? 0) - (a[metric].at(-1) ?? 0));
  const shown = new Set([...ranked.slice(0, 6).map((t) => t.teamId), ...highlighted]);
  const linePalette = [...seriesColors, palette.teal, palette.orange, '#e879f9', '#a3e635', '#fb7185', '#38bdf8'];

  return {
    grid: { left: 8, right: 16, top: 64, bottom: 8, containLabel: true },
    legend: {
      type: 'scroll',
      top: 0,
      data: ranked.map((t) => t.teamName),
      selected: Object.fromEntries(ranked.map((t) => [t.teamName, shown.has(t.teamId)])),
    },
    tooltip: {
      trigger: 'axis',
      order: 'valueDesc',
      valueFormatter: (value) => `${Number(value).toLocaleString('es-ES', { maximumFractionDigits: 1 })} %`,
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: evolution.matchdays.map((d) => `J${d}`),
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 100,
      axisLabel: { formatter: '{value} %' },
    },
    series: ranked.map((team, i) => {
      const color = linePalette[i % linePalette.length]!;
      const mine = highlighted.includes(team.teamId);
      return {
        name: team.teamName,
        type: 'line',
        smooth: 0.3,
        showSymbol: evolution.matchdays.length <= 12,
        symbolSize: mine ? 8 : 6,
        lineStyle: { width: mine ? 4 : 2.5, color },
        itemStyle: { color },
        emphasis: { focus: 'series' },
        endLabel: { show: shown.has(team.teamId), formatter: team.shortName, color: colors.textMuted, fontSize: 10 },
        data: team[metric].map((v) => Math.round(v * 1000) / 10),
      };
    }),
    animationDuration: 1000,
  };
}
