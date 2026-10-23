import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/api';
import { clearHttpCache } from '@/api/http';
import type { SyncStatusDto } from '@/types/api';

const IDLE_EVERY_MS = 60_000;
const RUNNING_EVERY_MS = 5_000;

/**
 * Sondea el estado de la sincronización de la API: mientras corre (al arrancar, cada día...) el frontal muestra la
 * banda «actualizando datos»; al terminar, un aviso breve. Entre ejecuciones se consulta cada minuto.
 * Con la pestaña oculta no se sondea; al volver a ella se consulta en el acto.
 */
export const useSyncStore = defineStore('sync', () => {
  const status = ref<SyncStatusDto | null>(null);
  const justFinished = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let started = false;
  let polling = false;
  let wasRunning = false;
  let finishedTimer: ReturnType<typeof setTimeout> | null = null;

  const running = computed(() => status.value?.running ?? false);
  const progress = computed(() => {
    const s = status.value;
    if (!s || !s.running || s.total === 0) return 0;
    return Math.min(100, Math.round((s.done / s.total) * 100));
  });

  async function poll() {
    timer = null;
    polling = true;
    try {
      const next = await api.sync.status();
      if (wasRunning && !next.running) {
        // Datos nuevos: las listas cacheadas (competiciones...) se vuelven a pedir.
        clearHttpCache();
        justFinished.value = true;
        if (finishedTimer) clearTimeout(finishedTimer);
        finishedTimer = setTimeout(() => { justFinished.value = false; }, 8_000);
      }
      wasRunning = next.running;
      status.value = next;
    } catch {
      /* API caída: se reintenta en el siguiente sondeo */
    } finally {
      polling = false;
      if (started && !document.hidden) timer = setTimeout(() => void poll(), running.value ? RUNNING_EVERY_MS : IDLE_EVERY_MS);
    }
  }

  function onVisibilityChange() {
    if (!started || document.hidden || timer || polling) return;
    void poll();
  }

  function start() {
    if (started) return;
    started = true;
    document.addEventListener('visibilitychange', onVisibilityChange);
    void poll();
  }

  function stop() {
    started = false;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return { status, running, progress, justFinished, start, stop };
});
