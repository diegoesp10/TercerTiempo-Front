import { computed, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { api } from '@/api';
import type { ClubAlertsDto } from '@/types/api';
import { useAuthStore } from './auth';

const REFRESH_MS = 5 * 60_000;
// Al volver a la pestaña solo se pregunta si la última respuesta tiene más de esto.
const STALE_ON_RETURN_MS = 30_000;

/**
 * Avisos de la campanita de cualquier cuenta (club, cuerpo técnico o jugador). Se cargan al entrar, cada cinco minutos
 * y al volver a la pestaña; las acciones que los crean o resuelven (licencia, convocatorias de partido, ausencias a
 * entrenamientos) llaman a load().
 */
export const useAlertsStore = defineStore('alerts', () => {
  const auth = useAuthStore();
  const data = shallowRef<ClubAlertsDto | null>(null);
  const loading = ref(false);
  let timer: ReturnType<typeof setInterval> | null = null;
  let loadedAt = 0;

  const alerts = computed(() => data.value?.alerts ?? []);
  const unread = computed(() => data.value?.unread ?? 0);

  async function load() {
    if (!auth.isAuthenticated) return;
    loading.value = true;
    try {
      data.value = await api.alerts.mine();
      loadedAt = Date.now();
    } catch { /* sin avisos no se enseña nada: la campanita se queda como estaba */ }
    finally {
      loading.value = false;
    }
  }

  async function markRead(alertId: string) {
    data.value = await api.alerts.read(alertId);
  }

  async function markAllRead() {
    data.value = await api.alerts.readAll();
  }

  const onVisible = () => { if (document.visibilityState === 'visible' && Date.now() - loadedAt > STALE_ON_RETURN_MS) void load(); };

  watch(() => auth.isAuthenticated, (signedIn) => {
    if (timer) clearInterval(timer);
    timer = null;
    document.removeEventListener('visibilitychange', onVisible);
    if (!signedIn) {
      data.value = null;
      return;
    }
    void load();
    timer = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    document.addEventListener('visibilitychange', onVisible);
  }, { immediate: true });

  return { alerts, unread, loading, load, markRead, markAllRead };
});
