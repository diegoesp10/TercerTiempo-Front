import type { MatchDto } from '@/types/api';
import { outcomeFor, outcomeLabels, type Outcome } from '@/utils/format';

// Colores del resultado de un partido ya jugado, desde el punto de vista del equipo: verde si ganó, amarillo si empató y
// rojo si perdió. El sólido (la letra) es casi igual en los dos temas y su letra llega a 4,5:1; el suave usa los tonos del
// tema para leerse en los dos.
export type Result = Exclude<Outcome, null>;

export const resultStyle: Record<Result, { label: string; solid: string; soft: string; ring: string; tint: string; bar: string }> = {
  win: {
    label: 'Victoria',
    solid: 'bg-green-500 text-green-950',
    soft: 'bg-emerald-500/15 text-emerald-700',
    ring: 'ring-green-500/50',
    tint: 'border-green-500/40 bg-green-500/15',
    bar: 'border-l-green-500',
  },
  draw: {
    label: 'Empate',
    solid: 'bg-yellow-400 text-yellow-950',
    soft: 'bg-yellow-400/20 text-amber-700',
    ring: 'ring-yellow-400/60',
    tint: 'border-yellow-400/50 bg-yellow-400/15',
    bar: 'border-l-yellow-400',
  },
  loss: {
    label: 'Derrota',
    solid: 'bg-danger-solid text-white',
    soft: 'bg-red-500/15 text-red-700',
    ring: 'ring-red-500/50',
    tint: 'border-red-500/40 bg-red-500/15',
    bar: 'border-l-red-500',
  },
};

/** El marcador tal cual (local primero), o null si aún no lo hay. */
export const scoreOf = (match: MatchDto) => (match.homeGoals !== null && match.awayGoals !== null ? `${match.homeGoals}-${match.awayGoals}` : null);

/** «Victoria 2-1» para títulos y lectores de pantalla; null si no se ha jugado. */
export function resultText(match: MatchDto, teamId: string) {
  const outcome = outcomeFor(match, teamId);
  return outcome ? `${resultStyle[outcome].label} ${scoreOf(match)}` : null;
}

export { outcomeFor, outcomeLabels };
