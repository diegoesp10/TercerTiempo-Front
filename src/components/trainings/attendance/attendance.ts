import type { PlayerTrainingTallyDto, Position, SquadTrainingAttendanceDto, TrainingAttendanceDayDto, TrainingDayOutcome } from '@/types/api';
import { positionLabels, toDateKey } from '@/utils/format';

// Modelo del panel de asistencia: los entrenamientos acabados del periodo (columnas), agrupados por semana, y por cada
// jugador lo que fue de cada uno, su última falta y sus semanas.

export type Outcome = TrainingDayOutcome;
export type AttendanceViewKey = 'summary' | 'detailed' | 'week' | 'day';

export type SortKey = 'name' | 'sessions' | 'attended' | 'missed' | 'warned' | 'rate' | 'minutes' | 'injured' | 'lastMiss';
/** El orden es uno para todas las vistas: se cambia en cualquiera y se mantiene al pasar a otra. */
export interface SortApi {
  by: (key: SortKey) => void;
  state: (key: SortKey) => { active: boolean; desc: boolean };
}

export interface AttendanceDay extends TrainingAttendanceDayDto {
  index: number;
  date: Date;
  key: string;
  weekKey: string;
}

export interface AttendanceWeek {
  key: string;
  start: Date;
  end: Date;
  label: string;
  days: AttendanceDay[];
}

export interface Tally {
  /** Le tocaban (sin contar las de lesionado). */
  counted: number;
  attended: number;
  missed: number;
  warned: number;
  injured: number;
}

/** Un entrenamiento al que faltó, con el motivo que apuntó él al avisar o el cuerpo técnico al pasar lista. */
export interface AttendanceMiss {
  day: AttendanceDay;
  outcome: 'Missed' | 'Warned';
  reason: string | null;
}

export interface AttendanceRow {
  id: string;
  name: string;
  player: PlayerTrainingTallyDto;
  outcomes: (Outcome | null)[];
  lastMiss: AttendanceDay | null;
  /** Sus faltas, de la más reciente a la más antigua. */
  misses: AttendanceMiss[];
  /** Los últimos que le tocaban (como mucho 10), del más antiguo al más reciente. */
  recent: { day: AttendanceDay; outcome: Outcome }[];
  weeks: Record<string, Tally>;
}

/** Un bloque de la lista: toda la plantilla o, agrupando, los de una posición. */
export interface AttendanceGroup {
  key: string;
  /** Vacío cuando no se agrupa (no lleva cabecera). */
  label: string;
  rows: AttendanceRow[];
  open: boolean;
  /** Asistencia del grupo (solo los que siguen en la plantilla). */
  rate: number | null;
}

// Como en la plantilla, la convocatoria y el acta: porteros, defensas, centrocampistas, delanteros y, al final, sin posición.
const positionOrder: (Position | null)[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', null];

function groupRate(rows: AttendanceRow[]): number | null {
  const active = rows.filter((r) => r.player.active);
  const counted = active.reduce((s, r) => s + r.player.sessions, 0);
  return counted ? Math.round((active.reduce((s, r) => s + r.player.attended, 0) * 100) / counted) : null;
}

/** Reparte las filas (ya ordenadas) por posición, respetando el orden dentro de cada grupo. */
export function groupRows(
  rows: AttendanceRow[],
  positions: Record<string, Position | null | undefined>,
  byPosition: boolean,
  closed: string[],
): AttendanceGroup[] {
  // Los que causaron baja (con lo que entrenaron mientras estuvieron) van siempre aparte, en un último grupo «De baja».
  const current = rows.filter((r) => r.player.active);
  const left = rows.filter((r) => !r.player.active);
  const leftGroup: AttendanceGroup[] = left.length > 0 ? [{ key: 'left', label: 'De baja', rows: left, open: !closed.includes('left'), rate: null }] : [];
  if (!byPosition) return [...(current.length > 0 || left.length === 0 ? [{ key: 'all', label: '', rows: current, open: true, rate: null }] : []), ...leftGroup];
  return [
    ...positionOrder
      .map((p) => {
        const key = p ?? 'none';
        const list = current.filter((r) => (positions[r.id] ?? null) === p);
        return { key, label: p ? `${positionLabels[p]}s` : 'Sin posición', rows: list, open: !closed.includes(key), rate: groupRate(list) };
      })
      .filter((g) => g.rows.length > 0),
    ...leftGroup,
  ];
}

// Filtro de faltas: quién faltó (de cualquier forma), quién avisó y quién no. Con él, cada jugador enseña sus faltas.
export type MissFilter = 'all' | 'missed' | 'warned' | 'unwarned';

export const missFilters: { key: MissFilter; label: string; icon: string; hint: string; empty: string }[] = [
  { key: 'all', label: 'Todos', icon: 'users', hint: 'Toda la plantilla', empty: '' },
  { key: 'missed', label: 'Faltaron', icon: 'calendar-xmark', hint: 'Los que faltaron alguna vez, avisando o sin avisar, con el motivo de cada falta', empty: 'Nadie ha faltado en este periodo.' },
  { key: 'warned', label: 'Avisaron', icon: 'bell', hint: 'Los que faltaron avisando antes, con el motivo que dieron', empty: 'Nadie ha faltado avisando en este periodo.' },
  { key: 'unwarned', label: 'Sin avisar', icon: 'xmark', hint: 'Los que faltaron sin avisar', empty: 'Nadie ha faltado sin avisar en este periodo.' },
];

/** Las faltas de un jugador que caen en el filtro (todas con «Todos» o «Faltaron»). */
export function missesFor(row: AttendanceRow, filter: MissFilter) {
  if (filter === 'warned') return row.misses.filter((m) => m.outcome === 'Warned');
  if (filter === 'unwarned') return row.misses.filter((m) => m.outcome === 'Missed');
  return row.misses;
}

export const matchesMissFilter = (row: AttendanceRow, filter: MissFilter) => filter === 'all' || missesFor(row, filter).length > 0;

export const outcomeLabels: Record<Outcome, string> = {
  Attended: 'Vino',
  Missed: 'Faltó sin avisar',
  Warned: 'Faltó avisando',
  Injured: 'Lesionado (no cuenta)',
};

export const outcomeIcons: Record<Outcome, string> = {
  Attended: 'check',
  Missed: 'xmark',
  Warned: 'bell',
  Injured: 'user-injured',
};

/** Casilla de un entrenamiento: relleno suave e icono del color del resultado. */
export const outcomeCell: Record<Outcome, string> = {
  Attended: 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30',
  Missed: 'bg-red-500/15 text-red-600 ring-red-500/30',
  Warned: 'bg-amber-400/20 text-amber-600 ring-amber-500/30',
  Injured: 'bg-slate-400/15 text-slate-500 ring-slate-400/30',
};

/** Tramos de una barra apilada (vino, avisó, faltó, lesionado). */
export const outcomeBar: Record<Outcome, string> = {
  Attended: 'bg-emerald-500',
  Warned: 'bg-amber-400',
  Missed: 'bg-red-500',
  Injured: 'bg-slate-300',
};

export const rateText = (rate: number | null) =>
  rate === null ? 'text-slate-400' : rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-600';

/** Calor de una semana: de verde intenso (todo) a rojo (casi nada). */
export function rateHeat(rate: number | null) {
  if (rate === null) return 'bg-surface-2 text-slate-400';
  if (rate >= 100) return 'bg-emerald-500/25 text-emerald-700';
  if (rate >= 75) return 'bg-emerald-500/12 text-emerald-700';
  if (rate >= 50) return 'bg-amber-400/20 text-amber-700';
  return 'bg-red-500/15 text-red-700';
}

export const rateOf = (t: { counted: number; attended: number }) => (t.counted === 0 ? null : Math.round((t.attended * 100) / t.counted));

const shortMonth = new Intl.DateTimeFormat('es-ES', { month: 'short' });
const longMonth = new Intl.DateTimeFormat('es-ES', { month: 'long', year: 'numeric' });
const weekday = new Intl.DateTimeFormat('es-ES', { weekday: 'short' });
const fullDay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
const hourMinute = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

const clean = (text: string) => text.replace('.', '');
export const monthShort = (date: Date) => clean(shortMonth.format(date));
export const monthLong = (date: Date) => {
  const text = longMonth.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
export const weekdayShort = (date: Date) => clean(weekday.format(date));
export const dayLong = (date: Date) => {
  const text = fullDay.format(date);
  return text.charAt(0).toUpperCase() + text.slice(1);
};
export const time = (date: Date) => hourMinute.format(date);
export const dayShort = (date: Date) => `${weekdayShort(date)} ${date.getDate()} ${monthShort(date)}`;

export function mondayOf(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday;
}

export function weekLabel(start: Date, end: Date) {
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${monthShort(end)}`
    : `${start.getDate()} ${monthShort(start)} – ${end.getDate()} ${monthShort(end)}`;
}

export function buildDays(data: SquadTrainingAttendanceDto | null): AttendanceDay[] {
  return (data?.days ?? []).map((d, index) => {
    const date = new Date(d.startsAt);
    return { ...d, index, date, key: toDateKey(date), weekKey: toDateKey(mondayOf(date)) };
  });
}

export function buildWeeks(days: AttendanceDay[]): AttendanceWeek[] {
  const weeks = new Map<string, AttendanceWeek>();
  for (const day of days) {
    let week = weeks.get(day.weekKey);
    if (!week) {
      const start = mondayOf(day.date);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      week = { key: day.weekKey, start, end, label: weekLabel(start, end), days: [] };
      weeks.set(day.weekKey, week);
    }
    week.days.push(day);
  }
  return [...weeks.values()];
}

export const emptyTally = (): Tally => ({ counted: 0, attended: 0, missed: 0, warned: 0, injured: 0 });

export function add(tally: Tally, outcome: Outcome | null) {
  if (outcome === null) return;
  if (outcome === 'Injured') {
    tally.injured++;
    return;
  }
  tally.counted++;
  if (outcome === 'Attended') tally.attended++;
  else {
    tally.missed++;
    if (outcome === 'Warned') tally.warned++;
  }
}

export function buildRow(player: PlayerTrainingTallyDto, days: AttendanceDay[]): AttendanceRow {
  const outcomes = days.map((d) => player.outcomes?.[d.index] ?? null);
  const weeks: Record<string, Tally> = {};
  days.forEach((d, i) => add((weeks[d.weekKey] ??= emptyTally()), outcomes[i] ?? null));

  const counted = days.map((day, i) => ({ day, outcome: outcomes[i] })).filter((x): x is { day: AttendanceDay; outcome: Outcome } => x.outcome !== null);
  const misses = counted.filter((x) => x.outcome === 'Missed' || x.outcome === 'Warned');

  return {
    id: player.squadPlayerId,
    name: player.playerName,
    player,
    outcomes,
    lastMiss: misses.length ? misses[misses.length - 1]!.day : null,
    misses: misses
      .map((x) => ({ day: x.day, outcome: x.outcome as AttendanceMiss['outcome'], reason: player.reasons?.[x.day.sessionId]?.trim() || null }))
      .reverse(),
    recent: counted.slice(-10),
    weeks,
  };
}

/** Lo de todo el equipo en cada entrenamiento (o semana): cuántos vinieron de los que les tocaba. */
export function teamTally(rows: AttendanceRow[], indexes: number[]) {
  const tally = emptyTally();
  for (const row of rows) for (const i of indexes) add(tally, row.outcomes[i] ?? null);
  return tally;
}
