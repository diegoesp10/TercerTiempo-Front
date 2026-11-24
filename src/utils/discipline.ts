import type { DisciplineDto, PlayerYellowCycleDto } from '@/types/api';

// La marca «Apercibido» de una línea de convocatoria con el mismo aspecto que en la plantilla (DisciplineBadge). A los
// sancionados no les hace falta: llevan su nota aparte, con el motivo.
export function warnedDiscipline(line: { warned: boolean; cycleYellows: number }): DisciplineDto | null {
  return line.warned ? { cycleYellows: line.cycleYellows, suspension: null, warned: true } : null;
}

// «jornada 9», «jornadas 2 y 5», «jornadas 2, 5 y 7»: sin repetir y en orden.
function matchdays(days: readonly number[]): string {
  const unique = [...new Set(days)];
  const list = unique.length === 1 ? `${unique[0]}` : `${unique.slice(0, -1).join(', ')} y ${unique[unique.length - 1]}`;
  return `${unique.length === 1 ? 'jornada' : 'jornadas'} ${list}`;
}

// Por qué las amarillas del ciclo no son todas las de la temporada: de qué jornadas son, qué dobles amarillas no cuentan
// y cuándo cumplió ciclo. Para leer al pasar por encima de la cuenta.
export function cycleExplanation(cycle: PlayerYellowCycleDto): string {
  const parts = [
    cycle.inCycle === 0
      ? 'Ninguna amarilla en el ciclo.'
      : `${cycle.inCycle} ${cycle.inCycle === 1 ? 'amarilla' : 'amarillas'} en el ciclo: ${matchdays(cycle.cycleMatchdays)}.`,
  ];
  const doubles = [...new Set(cycle.secondYellowMatchdays)];
  if (doubles.length === 1) parts.push(`Las 2 de la doble amarilla de la ${matchdays(doubles)} no cuentan.`);
  else if (doubles.length > 1) parts.push(`Las de las dobles amarillas de las ${matchdays(doubles)} no cuentan.`);
  const done = [...new Set(cycle.completedAt)];
  if (done.length === 1) parts.push(`Ya cumplió ciclo en la ${matchdays(done)} y desde ahí se empieza de cero.`);
  else if (done.length > 1) parts.push(`Ya cumplió ciclo en las ${matchdays(done)}; tras cada una se empieza de cero.`);
  return parts.join(' ');
}
