// Constructores de opciones de Apache ECharts: funciones puras que reciben DTOs de la API y devuelven la configuración.
import { graphic } from 'echarts/core';
import type { EChartsOption } from 'echarts';
import type {
  PlayerAxesDto,
  PlayerMatchPointDto,
  SquadPlayerStatsDto,
  SquadTimelinePointDto,
} from '@/types/api';
import { chartPalettes, palette, ratingColor, ratingScale, seriesColors, textOnColor, type ChartTheme } from './theme';

// ------------------------------------------------------------------ utilidades

const n1 = (value: number) => value.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const n2 = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 2 });

const outcomeLetter = { Win: 'V', Draw: 'E', Loss: 'D', NotPlayed: '–' } as const;
const outcomeColor = { Win: palette.emerald, Draw: palette.amber, Loss: palette.rose, NotPlayed: palette.slate } as const;

/** Etiqueta del eje X de un partido: jornada y rival ("J3\nVAL"). */
const matchLabel = (matchday: number, opponentShort: string) => `J${matchday}\n${opponentShort}`;

const dot = (color: string) =>
  `<span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${color};margin-right:6px"></span>`;

const verticalGradient = (color: string, from = 0.35, to = 0) =>
  new graphic.LinearGradient(0, 0, 0, 1, [
    { offset: 0, color: hexToRgba(color, from) },
    { offset: 1, color: hexToRgba(color, to) },
  ]);

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Máximo "bonito" para escalar un eje: siempre algo por encima del valor más alto. */
function niceMax(value: number) {
  if (value <= 0) return 1;
  const padded = value * 1.15;
  const magnitude = 10 ** Math.floor(Math.log10(padded));
  return Math.ceil(padded / (magnitude / 2)) * (magnitude / 2);
}

interface AxisTooltipParam {
  dataIndex: number;
  seriesName: string;
  value: unknown;
  color: string;
}

const visualMapRating = (seriesIndex: number) => ({
  show: false,
  type: 'piecewise' as const,
  seriesIndex,
  dimension: 1,
  pieces: ratingScale.map((band) => ({ ...('gte' in band ? { gte: band.gte } : {}), ...('lt' in band ? { lt: band.lt } : {}), color: band.color })),
  outOfRange: { color: '#cbd5e1' },
});

// ------------------------------------------------------------------ jugador

/** Evolución de la nota partido a partido, coloreada por tramos, con su media y la de la plantilla. */
export function ratingTrendOption(points: PlayerMatchPointDto[], squadAverage?: number | null, theme: ChartTheme = 'light'): EChartsOption {
  const colors = chartPalettes[theme];
  const categories = points.map((p) => matchLabel(p.match.matchday, p.opponentShortName));
  const ratings = points.map((p) => p.performance?.rating ?? null);
  const rated = ratings.filter((r): r is number => r !== null);
  const average = rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null;

  const markData: Array<Record<string, unknown>> = [];
  if (average !== null) markData.push({ yAxis: average, name: 'Su media', lineStyle: { color: palette.emerald }, label: { formatter: `Media ${n1(average)}`, color: colors.text } });
  if (squadAverage) markData.push({ yAxis: squadAverage, name: 'Media plantilla', lineStyle: { color: palette.slate }, label: { formatter: `Plantilla ${n1(squadAverage)}`, color: colors.textMuted } });

  return {
    grid: { left: 36, right: 90, top: 24, bottom: 44 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#94a3b8', type: 'dashed' } },
      formatter: (raw: unknown) => {
        const [param] = raw as AxisTooltipParam[];
        const point = points[param.dataIndex];
        const perf = point.performance;
        const head = `<b>J${point.match.matchday}</b> · ${point.home ? 'vs' : '@'} ${point.opponentName}<br/>` +
          `${point.goalsFor ?? '–'}-${point.goalsAgainst ?? '–'} ${dot(outcomeColor[point.outcome])}${outcomeLetter[point.outcome]}`;
        if (!perf || perf.rating === null) return `${head}<br/><span style="color:${colors.textMuted}">No jugó</span>`;
        return `${head}<br/>${dot(ratingColor(perf.rating))}Nota <b>${n1(perf.rating)}</b><br/>` +
          `${perf.minutesPlayed}' · ${perf.goals} G · ${perf.assists} A · ${perf.shotsOnTarget}/${perf.shots} tiros`;
      },
    },
    visualMap: visualMapRating(0),
    xAxis: { type: 'category', data: categories, boundaryGap: true },
    yAxis: { type: 'value', min: 3, max: 10, interval: 1 },
    series: [
      {
        name: 'Nota',
        type: 'line',
        data: ratings,
        connectNulls: true,
        symbolSize: 11,
        lineStyle: { width: 3 },
        areaStyle: { color: verticalGradient(palette.emerald, 0.28) },
        emphasis: { focus: 'series', scale: 1.4 },
        markLine: { silent: true, symbol: 'none', lineStyle: { type: 'dashed', width: 1.5 }, label: { position: 'end', fontSize: 11 }, data: markData },
      },
    ],
  } as EChartsOption;
}

const breakdownBlocks = [
  { key: 'attack', label: 'Ataque', color: palette.emerald },
  { key: 'creation', label: 'Creación', color: palette.sky },
  { key: 'defense', label: 'Defensa', color: palette.violet },
  { key: 'goalkeeping', label: 'Portería', color: '#ec4899' },
  { key: 'result', label: 'Resultado', color: palette.amber },
  { key: 'discipline', label: 'Disciplina', color: palette.rose },
] as const;

/** Desglose de la nota: cuánto suma o resta cada bloque sobre la base de 6,0 en cada partido. */
export function ratingBreakdownOption(points: PlayerMatchPointDto[]): EChartsOption {
  const played = points.filter((p) => p.rating);
  const categories = played.map((p) => matchLabel(p.match.matchday, p.opponentShortName));

  return {
    grid: { left: 40, right: 16, top: 40, bottom: 44 },
    legend: { top: 0 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const params = raw as AxisTooltipParam[];
        const point = played[params[0].dataIndex];
        const lines = params
          .filter((p) => typeof p.value === 'number' && p.value !== 0)
          .map((p) => `${dot(p.color)}${p.seriesName}: <b>${(p.value as number) > 0 ? '+' : ''}${n2(p.value as number)}</b>`);
        return `<b>J${point.match.matchday}</b> · ${point.home ? 'vs' : '@'} ${point.opponentName}<br/>` +
          `Base 6,0<br/>${lines.join('<br/>')}<br/>${dot(ratingColor(point.rating!.total))}Nota <b>${n1(point.rating!.total)}</b>`;
      },
    },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value', name: 'sobre 6,0', axisLabel: { formatter: (v: number) => (v > 0 ? `+${v}` : `${v}`) } },
    series: breakdownBlocks.map((block) => ({
      name: block.label,
      type: 'bar' as const,
      stack: 'nota',
      barMaxWidth: 28,
      itemStyle: { color: block.color, borderRadius: 3 },
      emphasis: { focus: 'series' as const },
      data: played.map((p) => p.rating![block.key]),
    })),
  } as EChartsOption;
}

/** Goles y asistencias por partido (barras) y minutos jugados (línea, eje derecho). */
export function contributionsOption(points: PlayerMatchPointDto[]): EChartsOption {
  const categories = points.map((p) => matchLabel(p.match.matchday, p.opponentShortName));

  return {
    grid: { left: 32, right: 40, top: 40, bottom: 44 },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'category', data: categories },
    yAxis: [
      { type: 'value', minInterval: 1, name: 'G / A' },
      { type: 'value', max: 120, interval: 30, name: 'min', splitLine: { show: false } },
    ],
    series: [
      { name: 'Goles', type: 'bar', stack: 'ga', barMaxWidth: 24, itemStyle: { color: palette.emerald }, data: points.map((p) => p.performance?.goals ?? 0) },
      { name: 'Asistencias', type: 'bar', stack: 'ga', barMaxWidth: 24, itemStyle: { color: palette.sky }, data: points.map((p) => p.performance?.assists ?? 0) },
      {
        name: 'Minutos',
        type: 'line',
        yAxisIndex: 1,
        step: 'middle',
        symbol: 'none',
        lineStyle: { width: 2, color: palette.slate, type: 'dotted' },
        itemStyle: { color: palette.slate },
        data: points.map((p) => p.performance?.minutesPlayed ?? 0),
      },
    ],
  } as EChartsOption;
}

// ------------------------------------------------------------------ radar (jugador y comparador)

export interface RadarEntry {
  name: string;
  axes: PlayerAxesDto;
  /** Media de la plantilla: línea discontinua y sin relleno. */
  reference?: boolean;
}

const radarAxes: Array<{ key: keyof PlayerAxesDto; label: string; per90?: boolean; goalkeeper?: boolean }> = [
  { key: 'goalsPer90', label: 'Goles', per90: true },
  { key: 'assistsPer90', label: 'Asistencias', per90: true },
  { key: 'shotsOnTargetPer90', label: 'Tiros a puerta', per90: true },
  { key: 'keyPassesPer90', label: 'Pases clave', per90: true },
  { key: 'tacklesPer90', label: 'Entradas', per90: true },
  { key: 'interceptionsPer90', label: 'Intercepciones', per90: true },
  { key: 'savesPer90', label: 'Paradas', per90: true, goalkeeper: true },
  { key: 'averageRating', label: 'Nota media' },
  { key: 'participationPct', label: 'Participación' },
];

/** Radar del perfil por 90' (jugador frente a la media de la plantilla, o varios jugadores en el comparador). */
export function profileRadarOption(entries: RadarEntry[], best: PlayerAxesDto, includeSaves: boolean, theme: ChartTheme = 'light'): EChartsOption {
  const colors = chartPalettes[theme];
  const axes = radarAxes.filter((a) => includeSaves || !a.goalkeeper);
  const value = (e: RadarEntry, key: keyof PlayerAxesDto) => (e.axes[key] as number | null) ?? 0;

  const indicator = axes.map((a) => {
    if (a.key === 'averageRating') return { name: a.label, min: 3, max: 10 };
    if (a.key === 'participationPct') return { name: a.label, max: 100 };
    const top = Math.max((best[a.key] as number) ?? 0, ...entries.map((e) => value(e, a.key)));
    return { name: `${a.label}`, max: niceMax(top) };
  });

  let colorIndex = 0;
  const data = entries.map((e) => {
    const color = e.reference ? palette.slate : seriesColors[colorIndex++ % seriesColors.length];
    return {
      name: e.name,
      value: axes.map((a) => (a.key === 'averageRating' ? (e.axes.averageRating ?? 3) : value(e, a.key))),
      symbol: e.reference ? 'none' : 'circle',
      lineStyle: { color, width: e.reference ? 1.5 : 2.5, type: e.reference ? ('dashed' as const) : ('solid' as const) },
      itemStyle: { color },
      areaStyle: e.reference ? undefined : { color: hexToRgba(color, entries.filter((x) => !x.reference).length > 1 ? 0.12 : 0.28) },
    };
  });

  return {
    legend: { bottom: 0 },
    tooltip: {
      trigger: 'item',
      formatter: (raw: unknown) => {
        const p = raw as { name: string; value: number[]; color: string };
        const rows = axes.map((a, i) => {
          const v = p.value[i];
          const text = a.key === 'averageRating' ? n1(v) : a.key === 'participationPct' ? `${Math.round(v)} %` : `${n2(v)} /90'`;
          return `${a.label}: <b>${text}</b>`;
        });
        return `<b>${p.name}</b><br/>${rows.join('<br/>')}`;
      },
    },
    radar: {
      indicator,
      radius: '66%',
      center: ['50%', '48%'],
      splitNumber: 4,
      shape: 'polygon',
      axisName: { color: colors.text, fontSize: 11 },
      splitArea: { areaStyle: { color: colors.radarArea } },
      splitLine: { lineStyle: { color: colors.gridLine } },
      axisLine: { lineStyle: { color: colors.gridLine } },
    },
    series: [{ type: 'radar', data, emphasis: { lineStyle: { width: 4 } } }],
  } as EChartsOption;
}

/** Barras agrupadas por métrica (por 90') para comparar jugadores. */
export function per90BarsOption(entries: RadarEntry[]): EChartsOption {
  const metrics = radarAxes.filter((a) => a.per90);
  return {
    grid: { left: 36, right: 16, top: 40, bottom: 56 },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => `${n2(Number(v))} /90'` },
    xAxis: { type: 'category', data: metrics.map((m) => m.label), axisLabel: { interval: 0, rotate: 20 } },
    yAxis: { type: 'value', name: "por 90'" },
    series: entries.map((e, i) => ({
      name: e.name,
      type: 'bar' as const,
      barMaxWidth: 22,
      itemStyle: { color: e.reference ? palette.slate : seriesColors[i % seriesColors.length] },
      data: metrics.map((m) => e.axes[m.key] as number),
    })),
  } as EChartsOption;
}

/** Nota de varios jugadores partido a partido (comparador). */
export function ratingComparisonOption(series: Array<{ name: string; points: PlayerMatchPointDto[] }>): EChartsOption {
  const reference = series[0]?.points ?? [];
  const categories = reference.map((p) => matchLabel(p.match.matchday, p.opponentShortName));

  return {
    grid: { left: 36, right: 16, top: 40, bottom: 44 },
    legend: { top: 0 },
    tooltip: { trigger: 'axis', valueFormatter: (v) => (v === null || v === undefined || v === '-' ? 'no jugó' : n1(Number(v))) },
    xAxis: { type: 'category', data: categories, boundaryGap: true },
    yAxis: { type: 'value', min: 3, max: 10, interval: 1 },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line' as const,
      connectNulls: true,
      symbolSize: 9,
      itemStyle: { color: seriesColors[i % seriesColors.length] },
      lineStyle: { width: 3, color: seriesColors[i % seriesColors.length] },
      data: s.points.map((p) => p.performance?.rating ?? null),
    })),
  } as EChartsOption;
}

// ------------------------------------------------------------------ equipo

/** Goles a favor y en contra por partido (barras) y puntos acumulados (línea, eje derecho). */
export function teamResultsOption(points: SquadTimelinePointDto[]): EChartsOption {
  const categories = points.map((p) => matchLabel(p.match.matchday, p.opponentShortName));

  return {
    grid: { left: 32, right: 44, top: 40, bottom: 44 },
    legend: { top: 0 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const [first] = raw as AxisTooltipParam[];
        const p = points[first.dataIndex];
        return `<b>J${p.match.matchday}</b> · ${p.home ? 'vs' : '@'} ${p.opponentName}<br/>` +
          `${dot(outcomeColor[p.outcome])}<b>${p.goalsFor}-${p.goalsAgainst}</b> (${outcomeLetter[p.outcome]}) · +${p.points} pts<br/>` +
          `Acumulado: <b>${p.cumulativePoints} pts</b>`;
      },
    },
    xAxis: { type: 'category', data: categories },
    yAxis: [
      { type: 'value', minInterval: 1, name: 'goles' },
      { type: 'value', minInterval: 1, name: 'puntos', splitLine: { show: false } },
    ],
    series: [
      { name: 'A favor', type: 'bar', barMaxWidth: 18, barGap: '15%', itemStyle: { color: palette.emerald }, data: points.map((p) => p.goalsFor) },
      { name: 'En contra', type: 'bar', barMaxWidth: 18, itemStyle: { color: palette.rose }, data: points.map((p) => p.goalsAgainst) },
      {
        name: 'Puntos acumulados',
        type: 'line',
        yAxisIndex: 1,
        symbolSize: 9,
        itemStyle: { color: palette.amber },
        lineStyle: { color: palette.amber, width: 3 },
        areaStyle: { color: verticalGradient(palette.amber, 0.18) },
        data: points.map((p) => ({
          value: p.cumulativePoints,
          itemStyle: { color: outcomeColor[p.outcome], borderColor: '#fff', borderWidth: 2 },
        })),
      },
    ],
  } as EChartsOption;
}

/** Nota media del equipo en cada partido con acta, y la mejor nota del partido. */
export function teamRatingOption(points: SquadTimelinePointDto[]): EChartsOption {
  const withSheet = points.filter((p) => p.averageRating !== null);
  const categories = withSheet.map((p) => matchLabel(p.match.matchday, p.opponentShortName));

  return {
    grid: { left: 36, right: 16, top: 40, bottom: 44 },
    legend: { top: 0 },
    tooltip: {
      trigger: 'axis',
      formatter: (raw: unknown) => {
        const [first] = raw as AxisTooltipParam[];
        const p = withSheet[first.dataIndex];
        return `<b>J${p.match.matchday}</b> · ${p.home ? 'vs' : '@'} ${p.opponentName} (${p.goalsFor}-${p.goalsAgainst})<br/>` +
          `${dot(ratingColor(p.averageRating))}Media del equipo: <b>${n1(p.averageRating!)}</b><br/>` +
          `${dot(ratingColor(p.bestRating))}Mejor: <b>${p.bestPlayerName ?? '—'}</b> ${p.bestRating !== null ? n1(p.bestRating) : ''}<br/>` +
          `${p.playersUsed} jugadores utilizados`;
      },
    },
    visualMap: visualMapRating(0),
    xAxis: { type: 'category', data: categories, boundaryGap: true },
    yAxis: { type: 'value', min: 3, max: 10, interval: 1 },
    series: [
      { name: 'Media del equipo', type: 'line', symbolSize: 10, data: withSheet.map((p) => p.averageRating), areaStyle: { color: verticalGradient(palette.sky, 0.2) } },
      {
        name: 'Mejor nota',
        type: 'scatter',
        symbol: 'diamond',
        symbolSize: 14,
        itemStyle: { color: palette.violet, borderColor: '#fff', borderWidth: 1.5 },
        data: withSheet.map((p) => p.bestRating),
      },
    ],
  } as EChartsOption;
}

/** Reparto de los goles (o goles + asistencias) entre los jugadores. */
export function goalsDonutOption(rows: SquadPlayerStatsDto[], metric: 'goals' | 'goalContributions', theme: ChartTheme = 'light'): EChartsOption {
  const colors = chartPalettes[theme];
  const data = rows
    .map((r) => ({ name: r.player.fullName, value: r.stats[metric] }))
    .filter((d) => d.value > 0)
    .sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return {
    tooltip: { trigger: 'item', formatter: '{b}: <b>{c}</b> ({d} %)' },
    legend: {
      type: 'scroll',
      bottom: 0,
      formatter: (name: string) => {
        const item = data.find((d) => d.name === name);
        return `${name.split(' ').slice(0, 2).join(' ')} · ${item?.value ?? 0}`;
      },
    },
    title: {
      text: String(total),
      subtext: metric === 'goals' ? 'goles' : 'goles + asist.',
      left: 'center',
      top: '33%',
      textStyle: { fontSize: 28, fontWeight: 700, color: colors.textStrong },
      subtextStyle: { fontSize: 12, color: colors.textMuted },
      itemGap: 2,
    },
    series: [
      {
        type: 'pie',
        radius: ['46%', '72%'],
        center: ['50%', '42%'],
        padAngle: 2,
        label: { show: true, position: 'inside', formatter: '{c}', fontWeight: 700, fontSize: 12 },
        labelLine: { show: false },
        emphasis: { scaleSize: 6 },
        data: data.map((item, index) => {
          const color = seriesColors[index % seriesColors.length];
          return { ...item, itemStyle: { color }, label: { color: textOnColor(color) } };
        }),
      },
    ],
  } as EChartsOption;
}

/** Minutos jugados por jugador (barras horizontales), con el porcentaje de participación. */
export function minutesBarsOption(rows: SquadPlayerStatsDto[], limit = 16, theme: ChartTheme = 'light'): EChartsOption {
  const colors = chartPalettes[theme];
  const top = rows.filter((r) => r.stats.minutes > 0).sort((a, b) => b.stats.minutes - a.stats.minutes).slice(0, limit).reverse();

  return {
    grid: { left: 8, right: 56, top: 8, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (raw: unknown) => {
        const [p] = raw as AxisTooltipParam[];
        const row = top[p.dataIndex];
        return `<b>${row.player.fullName}</b><br/>${row.stats.minutes}' · ${row.stats.matchesLogged} partidos (${row.stats.starts} titular)<br/>` +
          `Participación: <b>${Math.round(row.impact.participationPct)} %</b>`;
      },
    },
    xAxis: { type: 'value', splitLine: { lineStyle: { type: 'dashed', color: colors.gridLine } } },
    yAxis: { type: 'category', data: top.map((r) => r.player.fullName), axisLabel: { width: 130, overflow: 'truncate' } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 16,
        itemStyle: { borderRadius: [0, 6, 6, 0], color: new graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: '#6ee7b7' }, { offset: 1, color: palette.emerald }]) },
        label: { show: true, position: 'right', formatter: (p: { dataIndex: number }) => `${Math.round(top[p.dataIndex].impact.participationPct)} %`, color: colors.textMuted, fontSize: 11 },
        data: top.map((r) => r.stats.minutes),
      },
    ],
  } as EChartsOption;
}

/** Ranking de nota media (jugadores con al menos 90'), cada barra con el color de su nota. */
export function ratingRankingOption(rows: SquadPlayerStatsDto[], limit = 12, theme: ChartTheme = 'light'): EChartsOption {
  const colors = chartPalettes[theme];
  const ranked = rows
    .filter((r) => r.stats.averageRating !== null && r.stats.minutes >= 90)
    .sort((a, b) => b.stats.averageRating! - a.stats.averageRating!)
    .slice(0, limit)
    .reverse();

  return {
    grid: { left: 8, right: 40, top: 8, bottom: 8, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, valueFormatter: (v) => n1(Number(v)) },
    xAxis: { type: 'value', min: 3, max: 10, splitLine: { lineStyle: { type: 'dashed', color: colors.gridLine } } },
    yAxis: { type: 'category', data: ranked.map((r) => r.player.fullName), axisLabel: { width: 130, overflow: 'truncate' } },
    series: [
      {
        type: 'bar',
        barMaxWidth: 16,
        label: { show: true, position: 'right', formatter: (p: { value: number }) => n1(p.value), fontWeight: 600, color: colors.text },
        data: ranked.map((r) => ({ value: r.stats.averageRating!, itemStyle: { color: ratingColor(r.stats.averageRating), borderRadius: [0, 6, 6, 0] } })),
      },
    ],
  } as EChartsOption;
}
