import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useAdminSessionStore } from '@/stores/adminSession';
import { useAuthStore } from '@/stores/auth';

/**
 * Lo elegido en el comparador de cada plantilla durante esta sesión: al volver al comparador se encuentra igual. Solo en
 * memoria (nada en el navegador) y se olvida al salir o al entrar con otra cuenta; al recargar, la página lo lleva en la
 * URL. Sin haber elegido a nadie, el comparador empieza sin nadie marcado.
 */
export const useCompareSelectionStore = defineStore('compareSelection', () => {
  const bySquad = ref<Record<string, string[]>>({});

  const auth = useAuthStore();
  const admin = useAdminSessionStore();
  watch([() => auth.token, () => admin.session], () => {
    bySquad.value = {};
  });

  const get = (squadId: string): string[] => bySquad.value[squadId] ?? [];

  function set(squadId: string, ids: string[]) {
    bySquad.value = { ...bySquad.value, [squadId]: [...ids] };
  }

  return { get, set };
});
