<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { whenIdle } from '@/utils/idle';

defineProps<{ title: string; subtitle: string }>();

const BallScene = defineAsyncComponent(() => whenIdle().then(() => import('@/components/three/BallScene.vue')));
</script>

<template>
  <!-- Pantallas de acceso: panel con el balón 3D a la izquierda y el formulario a la derecha. -->
  <div class="mx-auto mt-4 grid max-w-5xl overflow-hidden rounded-xl border border-line bg-surface shadow-card lg:grid-cols-5">
    <aside class="relative hidden bg-brand-600 p-8 text-white lg:col-span-2 lg:block">
      <p class="font-display text-xs font-semibold uppercase tracking-[0.18em] text-white/70">Rendimiento partido a partido</p>
      <h2 class="mt-3 text-2xl font-bold">{{ title }}</h2>
      <p class="mt-2 text-sm text-white/80">{{ subtitle }}</p>
      <div class="mx-auto mt-6 aspect-square w-full max-w-xs">
        <BallScene :zoom="1.15" />
      </div>
    </aside>
    <div class="p-6 sm:p-8 lg:col-span-3">
      <slot />
    </div>
  </div>
</template>
