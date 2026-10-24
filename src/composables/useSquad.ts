import { inject, type InjectionKey, type Ref, type ShallowRef } from 'vue';
import type { SquadDetailDto } from '@/types/api';

/** Contexto que SquadLayoutView ofrece a sus pestañas: la plantilla cargada y cómo recargarla. */
export interface SquadContext {
  squadId: Ref<string>;
  detail: ShallowRef<SquadDetailDto | null>;
  reload: () => Promise<void>;
}

export const squadKey: InjectionKey<SquadContext> = Symbol('squad');

export function useSquad(): SquadContext {
  const context = inject(squadKey);
  if (!context) throw new Error('useSquad() solo puede usarse dentro de SquadLayoutView.');
  return context;
}
