import type { MatchDto } from '@/types/api';
import { outcomeFor, outcomeLabels, type Outcome } from '@/utils/format';

// Colores del resultado de un partido ya jugado, desde el punto de vista del equipo: verde si ganó, amarillo si empató y
// rojo si perdió (tokens win, draw y loss de style.css). El sólido lleva su letra encima (on-*) y el suave, la letra del
// resultado sobre el tinte del sólido; las dos llegan a 4,5:1 en los dos temas.
export type Result = Exclude<Outcome, null>;

export const resultStyle: Record<Result, { label: string; solid: string; soft: string; ring: string; tint: string; bar: string }> = {
  win: {
    label: 'Victoria',
    solid: 'bg-win-solid text-on-win',
    soft: 'bg-win-solid/15 text-win',
    ring: 'ring-win-solid/50',
    tint: 'border-win-solid/40 bg-win-solid/15',
    bar: 'border-l-win-solid',
  },
  draw: {
    label: 'Empate',
    solid: 'bg-draw-solid text-on-draw',
    soft: 'bg-draw-solid/20 text-draw',
    ring: 'ring-draw-solid/60',
    tint: 'border-draw-solid/50 bg-draw-solid/15',
    bar: 'border-l-draw-solid',
  },
  loss: {
    label: 'Derrota',
    solid: 'bg-loss-solid text-on-loss',
    soft: 'bg-loss-solid/15 text-loss',
    ring: 'ring-loss-solid/50',
    tint: 'border-loss-solid/40 bg-loss-solid/15',
    bar: 'border-l-loss-solid',
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
