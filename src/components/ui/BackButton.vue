<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { backFallback } from '@/composables/useBackFallback';

/**
 * «Volver», el único botón de vuelta de la app: vuelve al estado inmediatamente anterior del frontal (historial del
 * router). Si se entró directamente por URL y no hay historial propio, va a donde diga la página (useBackFallback) o,
 * si no dice nada, a la página padre (ruta sin el último tramo).
 */
const router = useRouter();
const route = useRoute();

const parentPath = computed(() => {
  const segments = route.path.split('/').filter(Boolean);
  segments.pop();
  return segments.length > 0 ? `/${segments.join('/')}` : '/';
});

function goBack() {
  const state = window.history.state as { back?: string | null } | null;
  if (state?.back) router.back();
  else void router.push(backFallback.value?.to ?? parentPath.value);
}
</script>

<template>
  <button
    type="button"
    class="btn-ghost -ml-2 inline-flex items-center gap-2 px-2 py-1 text-sm text-slate-600 hover:text-slate-900"
    :aria-label="backFallback?.label ?? 'Volver'"
    @click="goBack"
  >
    <Icon icon="arrow-left" class="h-3.5 w-3.5" />
    <span>Volver</span>
  </button>
</template>
