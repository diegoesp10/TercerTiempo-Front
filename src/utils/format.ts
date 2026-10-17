import type { MatchDto, MatchStatus, MembershipStatus, Position } from '@/types/api';

export const positionLabels: Record<Position, string> = {
  Goalkeeper: 'Portero',
  Defender: 'Defensa',
  Midfielder: 'Centrocampista',
  Forward: 'Delantero',
};

export const positionOptions = (Object.keys(positionLabels) as Position[]).map((value) => ({
  value,
  label: positionLabels[value],
}));

export const matchStatusLabels: Record<MatchStatus, string> = {
  Scheduled: 'Programado',
  InProgress: 'En juego',
  Played: 'Finalizado',
  Postponed: 'Aplazado',
  Cancelled: 'Cancelado',
};

export const membershipStatusLabels: Record<MembershipStatus, string> = {
  Pending: 'Pendiente de validar',
  Active: 'Verificado',
  Inactive: 'Baja',
};

const dateTime = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' });

export const formatKickoff = (iso: string) => dateTime.format(new Date(iso));
export const formatDate = (iso: string) => dateOnly.format(new Date(iso));

export const formatNumber = (value: number | null | undefined, digits = 2) =>
  value === null || value === undefined ? '—' : value.toLocaleString('es-ES', { maximumFractionDigits: digits });

export const formatPct = (value: number | null | undefined) =>
  value === null || value === undefined ? '—' : `${formatNumber(value, 0)}%`;

export type Outcome = 'win' | 'draw' | 'loss' | null;

/** Resultado del partido desde el punto de vista de un equipo. */
export function outcomeFor(match: MatchDto, teamId: string): Outcome {
  if (match.status !== 'Played' || match.homeGoals === null || match.awayGoals === null) return null;
  const isHome = match.homeTeam.id === teamId;
  const goalsFor = isHome ? match.homeGoals : match.awayGoals;
  const goalsAgainst = isHome ? match.awayGoals : match.homeGoals;
  return goalsFor > goalsAgainst ? 'win' : goalsFor === goalsAgainst ? 'draw' : 'loss';
}

export const outcomeLabels: Record<Exclude<Outcome, null>, string> = { win: 'V', draw: 'E', loss: 'D' };
