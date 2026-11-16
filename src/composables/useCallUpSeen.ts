import { api } from '@/api';
import type { MyCallUpDto } from '@/types/api';

// El jugador ha abierto estas convocatorias: el cuerpo técnico pasa a ver el doble check. Va en segundo plano y sin
// barra de carga; si falla, se vuelve a intentar la próxima vez que las abra.
export function markCallUpsSeen(callUps: readonly Pick<MyCallUpDto, 'callUpId' | 'closed' | 'mine'>[]) {
  for (const c of callUps) {
    if (c.closed || c.mine.seenAt) continue;
    api.trainings.markCallUpSeen(c.callUpId).catch(() => undefined);
  }
}
