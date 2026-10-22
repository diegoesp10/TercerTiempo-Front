<script setup lang="ts">
defineProps<{ title: string; subtitle: string }>();

const facts = [
  { value: '10', label: 'ligas asturianas, de 1ª RFEF a 3ª AsturFútbol' },
  { value: '1:1', label: 'tu acta frente a la oficial de la federación' },
  { value: '3,0 – 10', label: 'nota de cada jugador, solo con datos del acta' },
];
</script>

<template>
  <!-- Pantallas de acceso: panel editorial a la izquierda (titular, cifras y el dibujo del área) y el formulario a la derecha. -->
  <div class="mx-auto mt-4 grid max-w-5xl overflow-hidden rounded-2xl border border-line bg-surface shadow-card lg:grid-cols-5">
    <aside class="auth-aside relative hidden overflow-hidden p-8 text-white lg:col-span-2 lg:flex lg:flex-col">
      <p class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-white/60">Rendimiento partido a partido</p>
      <h2 class="mt-3 text-3xl font-bold leading-[1.05] tracking-tight text-white">{{ title }}</h2>
      <p class="mt-3 text-sm leading-relaxed text-white/75">{{ subtitle }}</p>

      <dl class="relative z-10 mt-8 space-y-4 border-t border-white/15 pt-6">
        <div v-for="fact in facts" :key="fact.label" class="flex items-baseline gap-4">
          <dt class="w-20 shrink-0 font-figures text-2xl font-extrabold leading-none tabular-nums">{{ fact.value }}</dt>
          <dd class="text-sm text-white/75">{{ fact.label }}</dd>
        </div>
      </dl>

      <!-- Dibujo del área grande a línea, como en una pizarra táctica -->
      <svg class="pointer-events-none absolute -bottom-10 -right-12 h-[62%] w-[120%] text-white/18" viewBox="0 0 400 220" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
        <path d="M0 200 H400" />
        <path d="M70 200 V60 H330 V200" />
        <path d="M140 200 V130 H260 V200" />
        <path d="M150 60 A60 32 0 0 0 250 60" />
        <circle cx="200" cy="112" r="3" fill="currentColor" stroke="none" />
        <path d="M170 200 V210 H230 V200" />
      </svg>
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
