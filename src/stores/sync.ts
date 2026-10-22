import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api';
import type { SyncStatusDto } from '@/types/api';

const IDLE_EVERY_MS = 60_000;
const RUNNING_EVERY_MS = 5_000;

/**
 * Sondea el estado de la sincronización de la API: mientras corre (al arrancar, cada día...) el frontal muestra la
 * banda «actualizando datos»; al terminar, un aviso breve. Entre ejecuciones se consulta cada minuto.
 */
export const useSyncStore = defineStore('sync', () => {
  const status = ref<SyncStatusDto | null>(null);
  const justFinished = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let wasRunning = false;
  let finishedTimer: ReturnType<typeof setTimeout> | null = null;

  const running = computed(() => status.value?.running ?? false);
  const progress = computed(() => {
    const s = status.value;
    if (!s || !s.running || s.total === 0) return 0;
    return Math.min(100, Math.round((s.done / s.total) * 100));
  });

  async function poll() {
    try {
      const next = await api.sync.status();
      if (wasRunning && !next.running) {
        justFinished.value = true;
        if (finishedTimer) clearTimeout(finishedTimer);
        finishedTimer = setTimeout(() => { justFinished.value = false; }, 8_000);
      }
      wasRunning = next.running;
      status.value = next;
    } catch {
      /* API caída: se reintenta en el siguiente sondeo */
    } finally {
      timer = setTimeout(() => void poll(), running.value ? RUNNING_EVERY_MS : IDLE_EVERY_MS);
    }
  }

  function start() {
    if (timer) return;
    void poll();
  }

  function stop() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { status, running, progress, justFinished, start, stop };
});
