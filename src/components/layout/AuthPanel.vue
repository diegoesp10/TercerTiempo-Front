<script setup lang="ts">
import AuthPitchPlay from '@/components/auth/AuthPitchPlay.vue';

// Pantallas de acceso: a la izquierda el titular y una jugada que se dibuja sola en la pizarra; a la derecha el
// formulario. Lo que ofrece la app no va aquí, sino en «Qué incluye» de «Darme de alta». Estrecho (narrow) en «Darme
// de alta»: deja sitio al formulario, la pizarra va en vertical y acompaña al bajar. En «Entrar» la pizarra sale
// también en el móvil, encima del formulario.
withDefaults(defineProps<{ title: string; subtitle: string; narrow?: boolean }>(), { narrow: false });
</script>

<template>
  <!-- overflow-clip y no overflow-hidden: recorta las esquinas sin romper el sticky del panel estrecho. -->
  <div
    class="mx-auto mt-4 grid max-w-5xl grid-cols-1 overflow-clip rounded-2xl border border-line bg-surface shadow-card"
    :class="narrow ? 'lg:grid-cols-[17rem_minmax(0,1fr)]' : 'lg:grid-cols-5'"
  >
    <aside class="auth-aside text-white" :class="narrow ? 'hidden p-7 lg:block' : 'px-5 py-4 lg:col-span-2 lg:flex lg:flex-col lg:p-8 xl:p-10'">
      <div :class="narrow ? 'sticky top-24' : 'flex flex-1 flex-col'">
        <div class="hidden lg:block">
          <p class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Tercer Tiempo</p>
          <h2 class="mt-3 font-bold tracking-tight text-white" :class="narrow ? 'text-2xl leading-tight' : 'text-3xl leading-[1.05]'">{{ title }}</h2>
          <p class="mt-3 text-sm leading-relaxed text-white/70">{{ subtitle }}</p>
        </div>
        <div class="flex flex-1 items-center justify-center" :class="narrow ? 'mt-8' : 'lg:mt-8'">
          <AuthPitchPlay :vertical="narrow" :class="narrow ? 'w-full' : 'h-40 w-auto max-w-full lg:h-auto lg:w-full'" />
        </div>
      </div>
    </aside>
    <div class="p-6 sm:p-8 lg:flex lg:flex-col lg:justify-center" :class="narrow ? '' : 'lg:col-span-3'">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-aside {
  background: linear-gradient(160deg, #10306f 0%, #0b2152 55%, #081a42 100%);
}
</style>
