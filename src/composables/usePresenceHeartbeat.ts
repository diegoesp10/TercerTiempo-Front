import { onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';

const EVERY_MS = 60_000;
const AFTER_NAVIGATION_MS = 1_500;

/**
 * Latido de la sesión para la lista «Gente en sesión» de la administración: con una cuenta abierta y la pestaña a la
 * vista, cada minuto y al cambiar de página se avisa a la API de en qué página está. Con la pestaña oculta no se manda
 * nada (pasa a inactivo); al salir de la cuenta, la sesión se quita de la lista al momento. El administrador no lo
 * manda: no cuenta como gente en sesión.
 */
export function usePresenceHeartbeat() {
  const auth = useAuthStore();
  const route = useRoute();
  let timer: ReturnType<typeof setInterval> | null = null;
  let pending: ReturnType<typeof setTimeout> | null = null;

  function ping() {
    if (!auth.token || document.hidden) return;
    void api.presence.ping(route.fullPath).catch(() => undefined);
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function start() {
    stop();
    if (auth.token && !document.hidden) timer = setInterval(ping, EVERY_MS);
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stop();
      return;
    }
    ping();
    start();
  }

  // Con el token de la sesión que se cierra: aunque ya no valga, un 401 aquí no cierra la cuenta nueva.
  watch(() => auth.token, (token, previous) => {
    if (previous && previous !== token) void api.presence.end(previous).catch(() => undefined);
    ping();
    start();
  }, { immediate: true });

  watch(() => route.fullPath, () => {
    if (pending) clearTimeout(pending);
    pending = setTimeout(ping, AFTER_NAVIGATION_MS);
  });

  document.addEventListener('visibilitychange', onVisibilityChange);
  onBeforeUnmount(() => {
    stop();
    if (pending) clearTimeout(pending);
    document.removeEventListener('visibilitychange', onVisibilityChange);
  });
}
