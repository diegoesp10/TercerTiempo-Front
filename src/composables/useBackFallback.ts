import { computed, onBeforeUnmount, shallowRef, watchEffect } from 'vue';
import type { RouteLocationRaw } from 'vue-router';

/**
 * Adónde lleva el botón «Volver» del marco cuando no hay a dónde volver en el historial (se entró por la URL). Cada
 * página puede indicar el suyo (la lista de árbitros de su categoría, los partidos de la plantilla...) en vez de tener
 * un enlace propio: así en toda la app hay un único «Volver».
 */
interface BackFallback {
  to: RouteLocationRaw;
  /** Para el lector de pantalla: «Volver a los árbitros». */
  label?: string;
}

const current = shallowRef<BackFallback | null>(null);
let owner = 0;

export const backFallback = computed(() => current.value);

export function useBackFallback(source: () => BackFallback | null) {
  const id = ++owner;
  let mine = false;
  const stop = watchEffect(() => {
    const value = source();
    current.value = value;
    mine = true;
    owner = id;
  });
  onBeforeUnmount(() => {
    stop();
    // La página nueva puede haber puesto ya el suyo: solo se quita el propio.
    if (mine && owner === id) current.value = null;
  });
}
