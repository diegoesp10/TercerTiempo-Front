import { getCurrentScope, onScopeDispose, watch, type Ref } from 'vue';

/**
 * Para una página que se pone al día sola: llama a `check` cada `everyMs` mientras `active` sea true y la pestaña esté a
 * la vista, y en el momento al volver a ella. Una llamada no empieza hasta que acaba la anterior; si falla, se vuelve a
 * intentar en la siguiente sin decir nada.
 */
export function useLivePoll(check: () => Promise<void>, everyMs: number, active: Ref<boolean>) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let disposed = false;

  const stop = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const schedule = () => {
    stop();
    if (!disposed && active.value && !document.hidden) timer = setTimeout(() => void tick(), everyMs);
  };
  async function tick() {
    if (running || disposed) return;
    running = true;
    try {
      await check();
    } catch {
      // Sin conexión o la API ocupada: se vuelve a preguntar en la siguiente.
    } finally {
      running = false;
      schedule();
    }
  }
  const onVisibility = () => {
    stop();
    if (!document.hidden && active.value) void tick();
  };

  watch(active, schedule, { immediate: true });
  document.addEventListener('visibilitychange', onVisibility);
  if (getCurrentScope()) {
    onScopeDispose(() => {
      disposed = true;
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    });
  }
}
