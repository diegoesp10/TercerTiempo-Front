import { ref, shallowRef } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, errorMessage } from '@/api/http';

/**
 * Estado de carga/error para una petición. `run` se puede volver a invocar para recargar.
 * Si la API no responde (sin conexión o 5xx) se va a la página de error del servidor y, si el recurso no existe
 * (404), a la de «no encontrado»; con `redirectOnError: false` el error se queda en `error` y lo pinta la vista.
 */
export function useAsync<T>(fn: () => Promise<T>, options: { immediate?: boolean; redirectOnError?: boolean } = {}) {
  const data = shallowRef<T | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const router = useRouter();
  const route = useRoute();

  async function run() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fn();
    } catch (e) {
      error.value = errorMessage(e);
      if ((options.redirectOnError ?? true) && e instanceof ApiError) {
        if (e.status === 0 || e.status >= 500) {
          void router.replace({ name: 'server-error', query: { status: String(e.status), from: route.fullPath } });
        } else if (e.status === 404) {
          void router.replace({ name: 'not-found', params: { pathMatch: route.path.split('/').filter(Boolean) } });
        }
      }
    } finally {
      loading.value = false;
    }
  }

  if (options.immediate ?? true) void run();

  return { data, loading, error, run };
}
