import { ref, shallowRef } from 'vue';
import { errorMessage } from '@/api/http';

/** Estado de carga/error para una petición. `run` se puede volver a invocar para recargar. */
export function useAsync<T>(fn: () => Promise<T>, options: { immediate?: boolean } = {}) {
  const data = shallowRef<T | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  async function run() {
    loading.value = true;
    error.value = null;
    try {
      data.value = await fn();
    } catch (e) {
      error.value = errorMessage(e);
    } finally {
      loading.value = false;
    }
  }

  if (options.immediate ?? true) void run();

  return { data, loading, error, run };
}
