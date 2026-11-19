import type { Position } from '@/types/api';

/** Las cifras de las actas internas con las que se elige el dato que más dice de cada puesto. */
export interface KeyTotals {
  assists: number;
  saves: number;
  clearances: number;
  recoveries: number;
  passesCompleted: number;
  passesAttempted: number;
  shots: number;
  shotsOnTarget: number;
}

export interface KeyStat {
  key: 'assists' | 'saves' | 'clearances' | 'recoveries' | 'passes' | 'shots';
  /** Para la cabecera del perfil. */
  label: string;
  /** Para la columna de una tabla. */
  short: string;
  title: string;
  value: (t: KeyTotals) => string | number;
  /** Por lo que se ordena la columna. */
  sort: (t: KeyTotals) => number;
}

const ofTotal = (done: number, total: number) => (total > 0 ? `${done}/${total}` : String(done));

const assists: KeyStat = { key: 'assists', label: 'Asistencias de gol', short: 'A', title: 'Asistencias de gol', value: (t) => t.assists, sort: (t) => t.assists };
const saves: KeyStat = { key: 'saves', label: 'Paradas', short: 'Par', title: 'Paradas', value: (t) => t.saves, sort: (t) => t.saves };
const clearances: KeyStat = { key: 'clearances', label: 'Despejes', short: 'Desp', title: 'Despejes', value: (t) => t.clearances, sort: (t) => t.clearances };
const recoveries: KeyStat = {
  key: 'recoveries', label: 'Balones recuperados', short: 'Rec', title: 'Balones recuperados', value: (t) => t.recoveries, sort: (t) => t.recoveries,
};
const passes: KeyStat = {
  key: 'passes', label: 'Pases completados', short: 'Pases', title: 'Pases completados de los intentados',
  value: (t) => ofTotal(t.passesCompleted, t.passesAttempted), sort: (t) => t.passesCompleted,
};
const shots: KeyStat = {
  key: 'shots', label: 'Tiros a puerta', short: 'TP', title: 'Tiros a puerta de los tiros totales',
  value: (t) => ofTotal(t.shotsOnTarget, t.shots), sort: (t) => t.shotsOnTarget,
};

/**
 * El dato que más dice de cada puesto, además de goles, minutos y tarjetas: paradas del portero; despejes y balones
 * recuperados del defensa; pases completados y asistencias de gol del centrocampista; tiros a puerta y asistencias de
 * gol del delantero. Sin posición, las asistencias de gol.
 */
export function keyStatsFor(position: Position | null | undefined): KeyStat[] {
  switch (position) {
    case 'Goalkeeper':
      return [saves];
    case 'Defender':
      return [clearances, recoveries];
    case 'Midfielder':
      return [passes, assists];
    case 'Forward':
      return [shots, assists];
    default:
      return [assists];
  }
}

/** Las columnas de una tabla partido a partido: las del puesto y, si no van ya, las asistencias de gol. */
export function keyColumnsFor(position: Position | null | undefined): { stats: KeyStat[]; withAssists: boolean } {
  const stats = keyStatsFor(position);
  return { stats, withAssists: !stats.some((s) => s.key === 'assists') };
}

type Countable = Partial<Record<keyof KeyTotals, number | null>>;

/** Totales a partir de cualquier línea o resumen de acta interna (lo que no traiga vale cero). */
export function keyTotals(source: Countable): KeyTotals {
  return {
    assists: source.assists ?? 0,
    saves: source.saves ?? 0,
    clearances: source.clearances ?? 0,
    recoveries: source.recoveries ?? 0,
    passesCompleted: source.passesCompleted ?? 0,
    passesAttempted: source.passesAttempted ?? 0,
    shots: source.shots ?? 0,
    shotsOnTarget: source.shotsOnTarget ?? 0,
  };
}

/** «7/10»: los partidos que ha jugado frente a los que lleva jugados su equipo. */
export function matchesOfTeam(played: number, teamPlayed: number | null | undefined): { value: string; title?: string } {
  if (!teamPlayed) return { value: String(played) };
  return { value: `${played}/${teamPlayed}`, title: `Ha jugado ${played} de los ${teamPlayed} partidos que lleva su equipo` };
}
