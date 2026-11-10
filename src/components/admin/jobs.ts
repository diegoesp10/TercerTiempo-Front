import type { JobDto, JobRunDto, JobRunStatus, PauseKind } from '@/types/api';
import { formatKickoff, formatTime } from '@/utils/format';

/** Textos comunes de los trabajos en segundo plano, para «Trabajos y scrapeos» y «Descargas en directo». */
export const runStatusLabels: Record<JobRunStatus, string> = {
  running: 'En marcha',
  succeeded: 'Correcta',
  partial: 'Con errores',
  failed: 'Fallida',
  paused: 'En pausa',
  interrupted: 'Interrumpida',
};

export const runStatusTone: Record<JobRunStatus, 'green' | 'amber' | 'red' | 'blue' | 'slate'> = {
  running: 'blue',
  succeeded: 'green',
  partial: 'amber',
  failed: 'red',
  paused: 'amber',
  interrupted: 'slate',
};

export const pauseLabels: Record<PauseKind, string> = {
  rest: 'Descanso entre tandas',
  session: 'Sesión cerrada por la federación',
  retry: 'Reintentando',
  blocked: 'Bloqueada',
  error: 'La federación falla',
  hour: 'Tope de peticiones de la hora',
  day: 'Tope de peticiones del día',
};

export const jobIcons: Record<string, string> = {
  'football-data': 'futbol',
  'official-sheets': 'file-lines',
  'weekly-sheets': 'calendar-check',
  'match-officials': 'flag',
  'league-zones': 'list-ol',
  'license-alerts': 'bell',
  'license-renewals': 'credit-card',
};

export const scheduleText = (job: JobDto) =>
  job.schedule ? job.schedule : job.intervalMinutes === null ? 'Solo a mano' : job.intervalMinutes % 60 === 0 ? `Cada ${job.intervalMinutes / 60} h` : `Cada ${job.intervalMinutes} min`;

export function runDuration(run: JobRunDto) {
  const end = run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((end - new Date(run.startedAt).getTime()) / 1000));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60 ? `${minutes} min ${seconds % 60} s` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** «las 10:30» si es hoy; si no, con la fecha. */
export function until(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString() ? `las ${formatTime(iso)}` : formatKickoff(iso);
}

export const pauseText = (job: JobDto) => (job.pause ? `${job.pause.kind ? pauseLabels[job.pause.kind] : 'En pausa'} hasta ${until(job.pause.until)}` : null);

/** En qué está un trabajo ahora mismo, en una línea. */
export function jobState(job: JobDto): { tone: 'green' | 'amber' | 'red' | 'blue' | 'slate'; label: string } {
  if (!job.enabled) return { tone: 'slate', label: 'Desactivado' };
  if (job.running) return { tone: 'blue', label: 'En marcha' };
  if (job.pause) return { tone: 'amber', label: `En pausa hasta ${until(job.pause.until)}` };
  if (job.nextRunAt) return { tone: 'slate', label: `Próxima: ${formatKickoff(job.nextRunAt)}` };
  return { tone: 'slate', label: 'Solo a mano' };
}
