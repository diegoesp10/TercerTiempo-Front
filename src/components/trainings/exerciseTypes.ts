import type { ExerciseType } from '@/types/api';

// Icono y color de cada tipo de ejercicio, para reconocerlos de un vistazo en la biblioteca. La letra llega a 4,5:1 sobre
// su fondo en los dos temas: los tonos que no son del tema (naranja, violeta, cian) llevan uno para cada tema.
export const exerciseTypeStyle: Record<ExerciseType, { icon: string; chip: string }> = {
  Warmup: { icon: 'fire-flame-curved', chip: 'bg-orange-500/15 text-orange-800 dark:text-orange-300' },
  Technical: { icon: 'futbol', chip: 'bg-brand-500/15 text-brand-600 dark:text-brand-300' },
  Tactical: { icon: 'chess-knight', chip: 'bg-violet-500/15 text-violet-700 dark:text-violet-300' },
  Physical: { icon: 'dumbbell', chip: 'bg-red-500/15 text-red-700' },
  Goalkeeping: { icon: 'hand', chip: 'bg-amber-400/20 text-warning' },
  SetPieces: { icon: 'flag', chip: 'bg-sky-500/15 text-sky-700' },
  Game: { icon: 'people-group', chip: 'bg-emerald-500/15 text-emerald-700' },
  Cooldown: { icon: 'wind', chip: 'bg-cyan-500/15 text-cyan-800 dark:text-cyan-300' },
  Other: { icon: 'ellipsis', chip: 'bg-slate-400/15 text-slate-500' },
};
