<script setup lang="ts">
import { ref, watch } from 'vue';
import { useLoadingStore } from '@/stores/loading';

// Barra fina bajo la cabecera mientras la app carga algo (peticiones o cambio de página). Aparece con un pequeño
// retraso para que las respuestas instantáneas no parpadeen.
const loading = useLoadingStore();
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => loading.active,
  (active) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { visible.value = active; }, active ? 120 : 200);
  },
  { immediate: true },
);
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" aria-hidden="true">
    <Transition name="fade">
      <div v-if="visible" class="loading-bar h-full w-full" />
    </Transition>
  </div>
</template>

<style scoped>
.loading-bar {
  background: linear-gradient(90deg, transparent 0%, var(--t-brand-400) 30%, var(--t-accent-400, var(--t-brand-500)) 60%, transparent 100%);
  background-size: 50% 100%;
  animation: loading-slide 1.1s linear infinite;
}
@keyframes loading-slide {
  from { background-position: -50% 0; }
  to { background-position: 150% 0; }
}
.fade-enter-active,
.fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from,
.fade-leave-to { opacity: 0; }
</style>
