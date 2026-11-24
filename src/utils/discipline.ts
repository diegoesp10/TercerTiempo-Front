import type { DisciplineDto } from '@/types/api';

// La marca «Apercibido» de una línea de convocatoria con el mismo aspecto que en la plantilla (DisciplineBadge). A los
// sancionados no les hace falta: llevan su nota aparte, con el motivo.
export function warnedDiscipline(line: { warned: boolean; cycleYellows: number }): DisciplineDto | null {
  return line.warned ? { cycleYellows: line.cycleYellows, suspension: null, warned: true } : null;
}
