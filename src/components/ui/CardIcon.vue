<script setup lang="ts">
import { computed, useId } from 'vue';

const props = withDefaults(defineProps<{ kind?: 'yellow' | 'red'; title?: string; small?: boolean }>(), { kind: 'yellow', title: undefined, small: false });

// Cada tarjeta lleva su propio degradado. Con un id compartido todas usaban el de la primera de la página, y si esa estaba
// oculta (las marcas que solo salen en el móvil, una columna escondida) Chrome no lo pintaba y se quedaban en la silueta.
// El color de detrás de la url es el relleno de respaldo.
const gradientId = `card-icon-${useId()}`;
const colors = computed(() =>
  props.kind === 'yellow'
    ? { light: '#ffe566', dark: '#f2b705', solid: '#f5c400', edge: '#b8860b' }
    : { light: '#ff6b6b', dark: '#d11a2a', solid: '#e02424', edge: '#8f0f1a' },
);
const label = computed(() => props.title ?? (props.kind === 'yellow' ? 'Tarjeta amarilla' : 'Tarjeta roja'));
</script>

<template>
  <!-- Tarjeta del árbitro. Colores fijos: amarilla y roja se tienen que reconocer en cualquier tema. La pequeña va dentro de un distintivo. -->
  <svg
    viewBox="0 0 14 18"
    class="inline-block shrink-0 drop-shadow-sm"
    :class="small ? 'h-3 w-[9px] align-[-2px]' : 'h-[18px] w-[13px] align-[-4px]'"
    role="img"
    :aria-label="label"
  >
    <title>{{ label }}</title>
    <defs>
      <linearGradient :id="gradientId" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" :stop-color="colors.light" />
        <stop offset="1" :stop-color="colors.dark" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="12" height="16" rx="1.8" :fill="`url(#${gradientId}) ${colors.solid}`" :stroke="colors.edge" stroke-width="0.8" />
  </svg>
</template>
