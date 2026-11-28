import { onBeforeUnmount, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';
import { useAlertsStore } from '@/stores/alerts';
import { useAuthStore } from '@/stores/auth';
import { safePath } from '@/utils/safePath';

const EVERY_MS = 60_000;
const AFTER_NAVIGATION_MS = 1_500;

/**
 * Latido de la sesión para la lista «Gente en sesión» de la administración: con una cuenta abierta y la pestaña a la
 * vista, cada minuto y al cambiar de página se avisa a la API de en qué página está. Con la pestaña oculta no se manda
 * nada (pasa a inactivo); al salir de la cuenta, «Salir» la quita de la lista al momento (auth.logout). El administrador
 * no lo manda: no cuenta como gente en sesión. La respuesta trae la huella de los avisos: la campanita solo los vuelve a
 * pedir cuando cambia, sin un sondeo propio. Sin huella (204), la API ya no acepta la sesión y se olvida.
 */
export function usePresenceHeartbeat() {
  const auth = useAuthStore();
  const alerts = useAlertsStore();
  const route = useRoute();
  let timer: ReturnType<typeof setInterval> | null = null;
  let pending: ReturnType<typeof setTimeout> | null = null;

  function ping() {
    const token = auth.token;
    if (!token || document.hidden) return;
    void api.presence.ping(safePath(route))
      .then((pulse) => {
        if (pulse) alerts.checkStamp(pulse.alertsStamp);
        else auth.expire(token);
      })
      .catch(() => undefined);
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

  // Al entrar, salir o perder la sesión: se late con la nueva o se deja de latir.
  watch(() => auth.token, () => {
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
