<script setup lang="ts">
withDefaults(defineProps<{ kind?: 'yellow' | 'red'; title?: string }>(), { kind: 'yellow', title: undefined });
</script>

<template>
  <!-- Tarjeta del árbitro. Colores fijos: amarilla y roja se tienen que reconocer en cualquier tema. -->
  <svg viewBox="0 0 14 18" class="inline-block h-[18px] w-[13px] align-[-4px] drop-shadow-sm" role="img" :aria-label="title ?? (kind === 'yellow' ? 'Tarjeta amarilla' : 'Tarjeta roja')">
    <title>{{ title ?? (kind === 'yellow' ? 'Tarjeta amarilla' : 'Tarjeta roja') }}</title>
    <defs>
      <linearGradient id="card-icon-yellow" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ffe566" />
        <stop offset="1" stop-color="#f2b705" />
      </linearGradient>
      <linearGradient id="card-icon-red" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#ff6b6b" />
        <stop offset="1" stop-color="#d11a2a" />
      </linearGradient>
    </defs>
    <rect x="1" y="1" width="12" height="16" rx="1.8" :fill="kind === 'yellow' ? 'url(#card-icon-yellow)' : 'url(#card-icon-red)'" :stroke="kind === 'yellow' ? '#b8860b' : '#8f0f1a'" stroke-width="0.8" />
  </svg>
</template>
