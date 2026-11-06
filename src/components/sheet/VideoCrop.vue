<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue';
import { httpBlob } from '@/api/http';

/**
 * Recorte de un jugador seguido en el vídeo. La API solo lo sirve con la sesión iniciada (son imágenes internas del
 * equipo), así que se pide con el token y se pinta desde memoria; sin recorte, un hueco con el icono de jugador.
 */
const props = withDefaults(defineProps<{ url: string | null; alt: string; size?: 'sm' | 'md' }>(), { size: 'md' });

const src = ref<string | null>(null);
let current: string | null = null;

function release() {
  if (current) URL.revokeObjectURL(current);
  current = null;
  src.value = null;
}

watch(
  () => props.url,
  async (url) => {
    release();
    if (!url) return;
    try {
      const blob = await httpBlob(url);
      // Si mientras tanto ha cambiado el recorte pedido, este ya no vale.
      if (props.url !== url) return;
      current = URL.createObjectURL(blob);
      src.value = current;
    } catch { /* sin recorte se queda el hueco */ }
  },
  { immediate: true },
);
onBeforeUnmount(release);
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2 ring-1 ring-line"
    :class="size === 'sm' ? 'h-12 w-8' : 'h-20 w-12'"
  >
    <img v-if="src" :src="src" :alt="alt" class="h-full w-full object-cover" />
    <Icon v-else icon="user" class="text-slate-400" :class="size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5'" aria-hidden="true" />
  </span>
</template>
