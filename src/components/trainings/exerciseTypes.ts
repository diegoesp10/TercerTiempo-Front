import type { ExerciseType } from '@/types/api';

// Icono y color de cada tipo de ejercicio, para reconocerlos de un vistazo en la biblioteca.
export const exerciseTypeStyle: Record<ExerciseType, { icon: string; chip: string }> = {
  Warmup: { icon: 'fire-flame-curved', chip: 'bg-orange-500/15 text-orange-600' },
  Technical: { icon: 'futbol', chip: 'bg-brand-500/15 text-brand-600' },
  Tactical: { icon: 'chess-knight', chip: 'bg-violet-500/15 text-violet-600' },
  Physical: { icon: 'dumbbell', chip: 'bg-red-500/15 text-red-600' },
  Goalkeeping: { icon: 'hand', chip: 'bg-amber-400/20 text-amber-600' },
  SetPieces: { icon: 'flag', chip: 'bg-sky-500/15 text-sky-600' },
  Game: { icon: 'people-group', chip: 'bg-emerald-500/15 text-emerald-600' },
  Cooldown: { icon: 'wind', chip: 'bg-cyan-500/15 text-cyan-600' },
  Other: { icon: 'ellipsis', chip: 'bg-slate-400/15 text-slate-500' },
};
