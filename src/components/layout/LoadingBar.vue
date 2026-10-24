<script setup lang="ts">
import { ref, watch } from 'vue';
import BrandMark from '@/components/layout/BrandMark.vue';
import { useLoadingStore } from '@/stores/loading';

// Barra fina en lo alto de la página y una etiqueta con lo que se está cargando («Cargando la jornada…»,
// «Guardando el acta…»), mientras haya peticiones o cambios de página en curso. Aparece con un pequeño retraso
// para que las respuestas instantáneas no parpadeen.
const loading = useLoadingStore();
const visible = ref(false);
let timer: ReturnType<typeof setTimeout> | null = null;

watch(
  () => loading.active,
  (active) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { visible.value = active; }, active ? 150 : 250);
  },
  { immediate: true },
);
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-0 z-[60]" aria-hidden="true">
    <Transition name="fade">
      <div v-if="visible" class="loading-bar h-0.5 w-full" />
    </Transition>
  </div>
  <Transition name="chip">
    <div
      v-if="visible && loading.current"
      class="pointer-events-none fixed bottom-4 right-4 z-[60] flex items-center gap-2.5 rounded-full border border-line bg-surface/95 py-1.5 pl-1.5 pr-3.5 text-xs font-medium text-slate-700 shadow-card backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <BrandMark :size="22" animated />
      <span>{{ loading.current }}…</span>
      <span v-if="loading.pending > 1" class="rounded-full bg-brand-500/15 px-1.5 font-display text-[10px] font-bold text-brand-500">+{{ loading.pending - 1 }}</span>
    </div>
  </Transition>
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
.chip-enter-active,
.chip-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.chip-enter-from,
.chip-leave-to { opacity: 0; transform: translateY(6px); }
</style>
