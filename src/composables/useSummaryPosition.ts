import { ref, watch } from 'vue';
import type { Position } from '@/types/api';

// Puesto con el que se resume la cabecera de un jugador. Empieza en el suyo y vuelve a él al pasar a otro jugador (o si
// le cambian la posición), pero no al recargar sus datos: así no se pierde lo que haya elegido quien mira.
export function useSummaryPosition(player: () => { id: string; position: Position | null } | null | undefined) {
  const summary = ref<Position | null>(null);
  watch(
    () => {
      const current = player();
      return current ? `${current.id}|${current.position ?? ''}` : null;
    },
    (key) => {
      if (key !== null) summary.value = player()?.position ?? null;
    },
    { immediate: true },
  );
  return summary;
}
