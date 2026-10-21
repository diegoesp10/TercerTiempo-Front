<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

defineProps<{ title: string; subtitle: string }>();

const BallScene = defineAsyncComponent(() => import('@/components/three/BallScene.vue'));
</script>

<template>
  <!-- Pantallas de acceso: panel visual con el balón 3D a la izquierda y el formulario a la derecha. -->
  <div class="mx-auto mt-4 grid max-w-5xl overflow-hidden rounded-3xl border border-white/8 bg-navy-900/60 shadow-card backdrop-blur-xl lg:grid-cols-5">
    <aside class="relative hidden overflow-hidden bg-gradient-to-br from-brand-700/60 via-navy-900 to-navy-950 p-8 lg:col-span-2 lg:block">
      <div class="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-accent-500/25 blur-3xl" />
      <div class="absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-brand-500/30 blur-3xl" />
      <p class="eyebrow relative">Fútbol amateur asturiano</p>
      <h2 class="relative mt-3 text-2xl font-bold text-white">{{ title }}</h2>
      <p class="relative mt-2 text-sm text-slate-600">{{ subtitle }}</p>
      <div class="relative mx-auto mt-6 aspect-square w-full max-w-xs">
        <BallScene :zoom="1.15" />
      </div>
    </aside>
    <div class="p-6 sm:p-8 lg:col-span-3">
      <slot />
    </div>
  </div>
</template>
