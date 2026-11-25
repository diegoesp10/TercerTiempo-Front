import type { CallUpStatus, MatchDto } from '@/types/api';

// Lo que dura un partido, del saque al final y algo más: lo mismo que usa la API para darlo por jugado sin resultado.
const MATCH_LENGTH_MS = 3 * 60 * 60 * 1000;

type MatchTiming = Pick<MatchDto, 'status' | 'kickoffAt'>;

const kickoffOf = (match: MatchTiming) => new Date(match.kickoffAt).getTime();

/**
 * El partido cuya convocatoria toca preparar: el primero por fecha que aún no ha empezado, porque al empezar se cierra.
 * Los aplazados sin fecha nueva no cuentan. Es la misma regla que aplica la API (isNext).
 */
export function nextCallUpOf<T>(items: T[], matchOf: (item: T) => MatchTiming, now = Date.now()): T | null {
  return items
    .filter((item) => matchOf(item).status === 'Scheduled' && kickoffOf(matchOf(item)) > now)
    .sort((a, b) => kickoffOf(matchOf(a)) - kickoffOf(matchOf(b)))[0] ?? null;
}

/** Ya ha empezado: su convocatoria está cerrada (se ve, pero ya no se cambia ni se firma). */
export const callUpClosed = (match: MatchTiming, now = Date.now()) => kickoffOf(match) <= now;

/** Cómo está el partido de una convocatoria cerrada, para decir por qué ya no se toca. */
export function closedCallUpState(match: MatchTiming, now = Date.now()): { label: string; reason: string } {
  if (match.status === 'Postponed') return { label: 'Partido aplazado', reason: 'El partido está aplazado' };
  if (match.status === 'Cancelled') return { label: 'Partido cancelado', reason: 'El partido se canceló' };
  if (match.status !== 'Played' && now < kickoffOf(match) + MATCH_LENGTH_MS) return { label: 'Partido en juego', reason: 'El partido ya ha empezado' };
  return { label: 'Partido jugado', reason: 'El partido ya se jugó' };
}

/** «hoy», «mañana» o «dentro de 5 días», contando días del calendario. */
export function daysToGo(at: string, now = new Date()): string {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const days = Math.round((day(new Date(at)) - day(now)) / 86_400_000);
  if (days <= 0) return 'hoy';
  if (days === 1) return 'mañana';
  return `dentro de ${days} días`;
}

/** El aviso del próximo partido mientras su convocatoria no está enviada: sin empezar o en borrador. */
export const callUpDueLabel = (status: CallUpStatus | null | undefined) =>
  status === 'Draft' ? 'Convocatoria en borrador, sin enviar' : 'Convocatoria por hacer';
