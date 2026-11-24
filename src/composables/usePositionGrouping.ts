import { ref, watch, type Ref } from 'vue';
import type { Position } from '@/types/api';
import { positionLabels } from '@/utils/format';

/** Orden del campo: porteros, defensas, centrocampistas, delanteros y, al final, los que no tienen posición. */
export const positionOrder: (Position | null)[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', null];

export interface PositionGroup<T> {
  key: string;
  /** «Porteros», «Defensas»…, «De baja»; vacío cuando no se agrupa. */
  label: string;
  position: Position | null;
  /** El grupo de los de baja: estuvieron en la plantilla y ya no están. */
  left?: boolean;
  rows: T[];
}

/**
 * Las filas por posición, en el orden del campo y conservando el orden que traen dentro de cada grupo. Sin agrupar, un
 * único grupo sin título, para que la plantilla pinte igual en los dos casos. Con `isLeft`, los de baja van siempre
 * aparte, en un último grupo «De baja», se agrupe o no (Diego, 20-11: «porteros, defensas, centrocampistas, delanteros
 * y de baja»).
 */
export function groupByPosition<T>(
  rows: readonly T[],
  positionOf: (row: T) => Position | null | undefined,
  enabled: boolean,
  noneLabel = 'Sin posición',
  isLeft?: (row: T) => boolean,
): PositionGroup<T>[] {
  const left = isLeft ? rows.filter(isLeft) : [];
  const current = isLeft ? rows.filter((row) => !isLeft(row)) : [...rows];
  const groups: PositionGroup<T>[] = !enabled
    ? current.length > 0 || left.length === 0
      ? [{ key: 'all', label: '', position: null, rows: current }]
      : []
    : positionOrder
        .map((position) => ({
          key: position ?? 'none',
          label: position ? `${positionLabels[position]}s` : noneLabel,
          position,
          rows: current.filter((row) => (positionOf(row) ?? null) === position),
        }))
        .filter((group) => group.rows.length > 0);
  if (left.length > 0) groups.push({ key: 'left', label: 'De baja', position: null, left: true, rows: left });
  return groups;
}

/**
 * La casilla «Agrupar por posición» de una lista de jugadores, recordada en este navegador para esa lista. Todas las
 * listas de jugadores la llevan.
 */
export function useGroupByPosition(list: string, initial = false): Ref<boolean> {
  const key = `tt.group.${list}`;
  const enabled = ref(read(key, initial));
  watch(enabled, (value) => {
    try {
      localStorage.setItem(key, value ? '1' : '0');
    } catch {
      // Sin almacenamiento, al recargar vuelve a como empieza la lista.
    }
  });
  return enabled;
}

function read(key: string, initial: boolean): boolean {
  try {
    const value = localStorage.getItem(key);
    return value === null ? initial : value === '1';
  } catch {
    return initial;
  }
}
