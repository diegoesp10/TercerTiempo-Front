<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 36 });
</script>

<template>
  <!-- Logotipo: balón con panel azul eléctrico y halo cian -->
  <svg :width="size" :height="size" viewBox="0 0 64 64" class="drop-shadow-[0_0_14px_rgba(53,211,255,0.55)]" aria-hidden="true">
    <defs>
      <linearGradient id="brand-ball" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#5aa0ff" />
        <stop offset="1" stop-color="#12b6e6" />
      </linearGradient>
      <radialGradient id="brand-shine" cx="30%" cy="28%" r="70%">
        <stop offset="0" stop-color="#ffffff" stop-opacity="0.55" />
        <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
    </defs>
    <circle cx="32" cy="32" r="29" fill="url(#brand-ball)" />
    <g fill="#071129">
      <polygon points="32,18 41,24.5 37.5,35 26.5,35 23,24.5" />
      <polygon points="10,30 17,24 23,32 18,40 10,38" />
      <polygon points="54,30 47,24 41,32 46,40 54,38" />
      <polygon points="20,56 25,46 35,49 36,58 26,61" />
      <polygon points="44,56 39,46 29,49 28,58 38,61" transform="translate(14 0)" />
    </g>
    <circle cx="32" cy="32" r="29" fill="url(#brand-shine)" />
  </svg>
</template>
