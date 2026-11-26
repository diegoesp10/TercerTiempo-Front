import { computed, ref, shallowRef, watch } from 'vue';
import { defineStore } from 'pinia';
import { api } from '@/api';
import type { ClubAlertsDto } from '@/types/api';
import { useAuthStore } from './auth';

/**
 * Avisos de la campanita de cualquier cuenta (club, cuerpo técnico o jugador). Se cargan al entrar y cuando el latido de
 * la sesión (cada minuto, al cambiar de página y al volver a la pestaña) trae otra huella (checkStamp); las acciones que
 * los crean o resuelven (licencia, convocatorias de partido, ausencias a entrenamientos) llaman a load().
 */
export const useAlertsStore = defineStore('alerts', () => {
  const auth = useAuthStore();
  const data = shallowRef<ClubAlertsDto | null>(null);
  const loading = ref(false);

  const alerts = computed(() => data.value?.alerts ?? []);
  const unread = computed(() => data.value?.unread ?? 0);
  // Como en las redes sociales: arriba solo lo nuevo; lo visto o resuelto queda en «Anteriores».
  const fresh = computed(() => alerts.value.filter((a) => !a.seen && !a.resolved));
  const earlier = computed(() => alerts.value.filter((a) => a.seen || a.resolved));

  async function load() {
    if (!auth.isAuthenticated) return;
    loading.value = true;
    try {
      data.value = await api.alerts.mine();
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

  /** Los nuevos que se acaban de enseñar al abrir la campanita: el número se va al momento, sin esperar al servidor. */
  async function markSeen(alertIds: string[]) {
    if (alertIds.length === 0 || !data.value) return;
    const ids = new Set(alertIds);
    data.value = {
      ...data.value,
      unread: Math.max(0, data.value.unread - alertIds.length),
      alerts: data.value.alerts.map((a) => (ids.has(a.id) ? { ...a, seen: true } : a)),
    };
    try {
      data.value = await api.alerts.seen(alertIds);
    } catch {
      // Si no llega, siguen sin ver en el servidor y vuelven a contar en la próxima carga.
    }
  }

  /** La huella que trae el latido de la sesión: si no es la de los avisos que se tienen, se vuelven a pedir. */
  function checkStamp(stamp: string | undefined) {
    if (!stamp || !auth.isAuthenticated || loading.value || data.value?.stamp === stamp) return;
    void load();
  }

  watch(() => auth.isAuthenticated, (signedIn) => {
    if (!signedIn) {
      data.value = null;
      return;
    }
    void load();
  }, { immediate: true });

  return { alerts, fresh, earlier, unread, loading, load, markRead, markAllRead, markSeen, checkStamp };
});
