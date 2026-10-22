import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

// Cuántas cargas hay en curso (peticiones a la API y navegaciones): la barra superior se ve mientras haya alguna.
export const useLoadingStore = defineStore('loading', () => {
  const pending = ref(0);
  const navigating = ref(false);

  const active = computed(() => pending.value > 0 || navigating.value);

  const start = () => { pending.value += 1; };
  const finish = () => { pending.value = Math.max(0, pending.value - 1); };

  return { pending, navigating, active, start, finish };
});
