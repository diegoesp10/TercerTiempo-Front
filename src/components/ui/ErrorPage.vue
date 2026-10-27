<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import BrandMark from '@/components/layout/BrandMark.vue';

/** Página de error a pantalla completa con el logotipo animado: 404, API caída... */
withDefaults(defineProps<{ code: string; title: string; message: string; retry?: boolean }>(), { retry: false });

const router = useRouter();
const route = useRoute();

function retryNavigation() {
  const from = typeof route.query.from === 'string' && route.query.from.startsWith('/') ? route.query.from : '/';
  void router.replace(from);
}

function back() {
  const state = window.history.state as { back?: string | null } | null;
  if (state?.back) router.back();
  else void router.push('/');
}
</script>

<template>
  <section class="mx-auto flex max-w-xl flex-col items-center py-16 text-center">
    <div class="relative">
      <BrandMark :size="128" animated />
      <span class="absolute -right-3 -top-3 rounded-full bg-surface px-3 py-1 font-display text-lg font-bold text-brand-500 shadow-card ring-1 ring-line">{{ code }}</span>
    </div>
    <p class="eyebrow mt-8">Error {{ code }}</p>
    <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{{ title }}</h1>
    <p class="mt-3 max-w-md text-sm text-slate-600">{{ message }}</p>
    <div class="mt-8 flex flex-wrap justify-center gap-3">
      <button v-if="retry" type="button" class="btn-primary" @click="retryNavigation"><Icon icon="rotate-right" class="mr-2 h-3.5 w-3.5" />Reintentar</button>
      <button type="button" class="btn-secondary" @click="back"><Icon icon="arrow-left" class="mr-2 h-3.5 w-3.5" />Volver</button>
      <RouterLink to="/" class="btn-ghost"><Icon icon="house" class="mr-2 h-3.5 w-3.5" />Inicio</RouterLink>
    </div>
  </section>
</template>
