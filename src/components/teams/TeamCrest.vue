<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { apiBaseUrl } from '@/api/http';

/**
 * Escudo de un equipo. Si la API lo sirve (ruta relativa /api/teams/{id}/crest) se le antepone la URL de la API; si no
 * hay escudo o la imagen falla, se muestra una insignia con las iniciales para que ningún equipo quede sin imagen.
 */
const props = withDefaults(defineProps<{ src: string | null | undefined; name: string; shortName?: string | null; size?: 'xs' | 'sm' | 'md' | 'lg' }>(), {
  shortName: null,
  size: 'md',
});

const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });

const url = computed(() => {
  if (!props.src || failed.value) return null;
  return props.src.startsWith('/') ? `${apiBaseUrl}${props.src}` : props.src;
});

// Los escudos de la API vienen en miniaturas de 64, 128 y 192 px: el navegador elige la que pide la pantalla (con
// `sizes`, el lado al que se pinta) en vez de bajar el original, que puede pesar más de 100 KB.
const THUMBNAILS = [64, 128, 192];
const thumbnail = (width: number) => `${url.value}${url.value!.includes('?') ? '&' : '?'}size=${width}`;
const fromApi = computed(() => url.value !== null && props.src!.startsWith('/api/teams/'));
const srcset = computed(() => (fromApi.value ? THUMBNAILS.map((w) => `${thumbnail(w)} ${w}w`).join(', ') : undefined));
const imgSrc = computed(() => (fromApi.value ? thumbnail(128) : url.value));

const initials = computed(() => {
  const short = props.shortName?.trim();
  if (short && short.length <= 3) return short.toUpperCase();
  const words = props.name.split(/\s+/).filter((w) => w.length > 2 && !/^(cd|cf|fc|ud|sd|ad|cp|rc|uc|sad|club|de|del|la|el|los|las)$/i.test(w));
  const letters = (words.length > 0 ? words : props.name.split(/\s+/)).slice(0, 2).map((w) => w[0] ?? '').join('');
  return letters.toUpperCase() || '?';
});

const sizeClasses: Record<NonNullable<typeof props.size>, string> = {
  xs: 'h-5 w-5 text-2xs',
  sm: 'h-8 w-8 text-2xs',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-sm',
};
const pixels: Record<NonNullable<typeof props.size>, string> = { xs: '20px', sm: '32px', md: '40px', lg: '56px' };
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 ring-1 ring-line"
    :class="sizeClasses[size]"
    :title="name"
  >
    <img
      v-if="url"
      :src="imgSrc ?? undefined"
      :srcset="srcset"
      :sizes="srcset ? pixels[size] : undefined"
      :alt="name"
      class="h-full w-full object-contain p-0.5"
      loading="lazy"
      @error="failed = true"
    />
    <span v-else class="font-display font-bold tracking-wide text-slate-600" aria-hidden="true">{{ initials }}</span>
  </span>
</template>
