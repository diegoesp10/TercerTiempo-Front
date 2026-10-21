<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 36 });
</script>

<template>
  <!-- Logotipo de Tercer Tiempo: un balón azul con la Cruz de la Victoria asturiana en oro y un anillo de tres
       tiempos (el tercero, dorado). Es el mismo dibujo que public/favicon.svg: si cambia uno, cambia el otro. -->
  <svg :width="size" :height="size" viewBox="0 0 64 64" aria-hidden="true">
    <defs>
      <linearGradient id="tt-field" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#1d4fd8" />
        <stop offset="1" stop-color="#0a1f5c" />
      </linearGradient>
      <linearGradient id="tt-gold" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#f6e2a0" />
        <stop offset="0.5" stop-color="#d4a53a" />
        <stop offset="1" stop-color="#a6762a" />
      </linearGradient>
      <clipPath id="tt-clip"><circle cx="32" cy="32" r="30" /></clipPath>
    </defs>
    <!-- Balón: esfera azul con las costuras hexagonales insinuadas -->
    <circle cx="32" cy="32" r="30" fill="url(#tt-field)" />
    <g clip-path="url(#tt-clip)" fill="none" stroke="#ffffff" stroke-opacity="0.14" stroke-width="1">
        <polygon points="32.0,23.0 39.8,27.5 39.8,36.5 32.0,41.0 24.2,36.5 24.2,27.5" />
      <polygon points="47.6,23.0 55.4,27.5 55.4,36.5 47.6,41.0 39.8,36.5 39.8,27.5" />
      <polygon points="39.8,36.5 47.6,41.0 47.6,50.0 39.8,54.5 32.0,50.0 32.0,41.0" />
      <polygon points="24.2,36.5 32.0,41.0 32.0,50.0 24.2,54.5 16.4,50.0 16.4,41.0" />
      <polygon points="16.4,23.0 24.2,27.5 24.2,36.5 16.4,41.0 8.6,36.5 8.6,27.5" />
      <polygon points="24.2,9.5 32.0,14.0 32.0,23.0 24.2,27.5 16.4,23.0 16.4,14.0" />
      <polygon points="39.8,9.5 47.6,14.0 47.6,23.0 39.8,27.5 32.0,23.0 32.0,14.0" />
    </g>
    <circle cx="32" cy="32" r="30" fill="none" stroke="url(#tt-gold)" stroke-width="2" />
    <!-- Tres tiempos: tres arcos; el tercero, en oro -->
    <circle cx="32" cy="32" r="25.5" fill="none" stroke="#ffffff" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="44.5 8.9" transform="rotate(-80 32 32)" />
    <circle cx="32" cy="32" r="25.5" fill="none" stroke="url(#tt-gold)" stroke-width="1.8" stroke-dasharray="44.5 115.7" transform="rotate(50 32 32)" />
    <!-- Asturias: la Cruz de la Victoria -->
    <path fill="url(#tt-gold)" d="M27,14.5 Q32,16 37,14.5 L34.8,28.2 L48.5,26 Q47,31 48.5,36 L34.8,33.8 L37,49.5 Q32,48 27,49.5 L29.2,33.8 L15.5,36 Q17,31 15.5,26 L29.2,28.2 Z" />
    <g stroke="url(#tt-gold)" stroke-width="1.2" stroke-linecap="round">
      <line x1="24.5" y1="34.8" x2="24.5" y2="38.2" />
      <line x1="39.5" y1="34.8" x2="39.5" y2="38.2" />
    </g>
    <g fill="url(#tt-gold)">
      <circle cx="24.5" cy="39.6" r="1.5" />
      <circle cx="39.5" cy="39.6" r="1.5" />
    </g>
    <circle cx="32" cy="31" r="3" fill="#0a1f5c" stroke="url(#tt-gold)" stroke-width="1" />
    <g fill="#ffffff" fill-opacity="0.85">
      <circle cx="32" cy="18.4" r="1.1" />
      <circle cx="44.6" cy="31" r="1.1" />
      <circle cx="19.4" cy="31" r="1.1" />
      <circle cx="32" cy="45.6" r="1.1" />
    </g>
  </svg>
</template>
