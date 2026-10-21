<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';

/**
 * «Atrás» incrustado en la interfaz: vuelve al estado inmediatamente anterior del frontal (historial del router) y,
 * si se entró directamente por URL y no hay historial propio, sube a la página padre (ruta sin el último tramo).
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
  else void router.push(parentPath.value);
}
</script>

<template>
  <button
    type="button"
    class="btn-ghost -ml-2 inline-flex items-center gap-2 px-2 py-1 text-sm text-slate-600 hover:text-slate-900"
    aria-label="Volver atrás"
    @click="goBack"
  >
    <Icon icon="arrow-left" class="h-3.5 w-3.5" />
    <span>Atrás</span>
  </button>
</template>
