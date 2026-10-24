import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

export interface LoadingTask {
  id: number;
  label: string;
}

// Qué está cargando la app en cada momento (peticiones a la API y navegaciones), con su descripción: la barra
// superior se ve mientras haya alguna y enseña la última que empezó.
export const useLoadingStore = defineStore('loading', () => {
  const tasks = ref<LoadingTask[]>([]);
  const navigating = ref(false);
  let next = 1;

  const active = computed(() => tasks.value.length > 0 || navigating.value);
  const pending = computed(() => tasks.value.length);
  const current = computed<string | null>(() => tasks.value.at(-1)?.label ?? (navigating.value ? 'Cambiando de página' : null));

  function start(label = 'Cargando'): number {
    const id = next++;
    tasks.value = [...tasks.value, { id, label }];
    return id;
  }

  function finish(id: number) {
    tasks.value = tasks.value.filter((t) => t.id !== id);
  }

  return { tasks, navigating, active, pending, current, start, finish };
});
