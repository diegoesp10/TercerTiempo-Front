import type { TrainingSummaryDto } from '@/types/api';

// Color de cada tipo de entrenamiento en el calendario. Es una categoría, no un estado, y por eso pretemporada y
// recuperación se quedan en tonos de la paleta (del tema). chip: la ficha; bar: la franja de la izquierda; dot: el aro de
// la vista de lista (con su clase escrita, para que Tailwind la genere).
export const trainingKindStyle: Record<TrainingSummaryDto['kind'], { chip: string; bar: string; dot: string }> = {
  Season: { chip: 'border-brand-500/40 bg-brand-500/10 text-brand-600', bar: 'border-l-brand-500', dot: 'border-brand-500' },
  Preseason: { chip: 'border-amber-400/50 bg-amber-400/10 text-amber-700', bar: 'border-l-amber-400', dot: 'border-amber-400' },
  Recovery: { chip: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-700', bar: 'border-l-emerald-400', dot: 'border-emerald-400' },
  MatchPreparation: { chip: 'border-accent-400/50 bg-accent-400/10 text-accent-500', bar: 'border-l-accent-400', dot: 'border-accent-400' },
  Other: { chip: 'border-slate-300 bg-surface-2 text-slate-600', bar: 'border-l-slate-400', dot: 'border-slate-400' },
};
