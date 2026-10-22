<script setup lang="ts">
defineProps<{ title: string; subtitle: string }>();

const features = [
  { icon: 'clipboard-list', title: 'Actas de cada partido', text: 'Minutos, goles, tarjetas y nota de cada jugador.' },
  { icon: 'chart-line', title: 'Rendimiento y comparativas', text: 'La temporada de tu plantilla frente a la liga.' },
  { icon: 'video', title: 'Vídeo y análisis', text: 'Los partidos de tu equipo, en un solo sitio.' },
];
</script>

<template>
  <!-- Pantallas de acceso: titular y tres ideas a la izquierda, formulario a la derecha. -->
  <div class="mx-auto mt-4 grid max-w-5xl overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:grid-cols-5">
    <aside class="auth-aside relative hidden overflow-hidden p-10 text-white lg:col-span-2 lg:flex lg:flex-col lg:justify-between">
      <div>
        <p class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Tercer Tiempo</p>
        <h2 class="mt-3 text-3xl font-bold leading-[1.05] tracking-tight text-white">{{ title }}</h2>
        <p class="mt-3 text-sm leading-relaxed text-white/70">{{ subtitle }}</p>
      </div>
      <ul class="mt-10 space-y-5">
        <li v-for="f in features" :key="f.title" class="flex gap-3">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10"><Icon :icon="f.icon" class="h-4 w-4 text-white" /></span>
          <span>
            <span class="block text-sm font-semibold text-white">{{ f.title }}</span>
            <span class="block text-sm text-white/65">{{ f.text }}</span>
          </span>
        </li>
      </ul>
    </aside>
    <div class="p-6 sm:p-8 lg:col-span-3">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth-aside {
  background: linear-gradient(160deg, #10306f 0%, #0b2152 55%, #081a42 100%);
}
</style>
