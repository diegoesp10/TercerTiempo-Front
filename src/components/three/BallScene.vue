<script setup lang="ts">
import { computed } from 'vue';
import { TresCanvas } from '@tresjs/core';
import Ball from '@/components/three/Ball.vue';

const props = withDefaults(defineProps<{ spin?: number; float?: number; zoom?: number }>(), { spin: 0.35, float: 0.12, zoom: 1 });

/** Sin WebGL o con animaciones reducidas se muestra un balón estático en SVG. */
const supported = computed(() => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
});

const cameraZ = computed(() => 3.6 / props.zoom);
</script>

<template>
  <div class="relative h-full w-full">
    <TresCanvas v-if="supported" alpha :clear-alpha="0" :dpr="[1, 2]" shadows>
      <TresPerspectiveCamera :position="[0, 0.2, cameraZ]" :fov="38" />
      <TresAmbientLight :intensity="0.9" />
      <TresDirectionalLight :position="[4, 6, 5]" :intensity="2.6" color="#ffffff" cast-shadow />
      <TresPointLight :position="[-4, -1, 3]" :intensity="60" :distance="12" color="#35d3ff" />
      <TresPointLight :position="[3, -3, -2]" :intensity="40" :distance="12" color="#2f7bff" />
      <Ball :spin="spin" :float="float" />
    </TresCanvas>

    <svg v-else viewBox="0 0 200 200" class="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="ball-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" stop-color="#b9c4dd" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="88" fill="url(#ball-shade)" />
      <g fill="#111827">
        <polygon points="100,62 122,78 114,104 86,104 78,78" />
        <polygon points="40,96 58,84 70,104 56,122 36,116" />
        <polygon points="160,96 142,84 130,104 144,122 164,116" />
        <polygon points="70,160 86,144 110,152 110,174 84,180" />
        <polygon points="130,160 114,144 90,152 90,174 116,180" transform="translate(40 0)" />
      </g>
    </svg>
  </div>
</template>
