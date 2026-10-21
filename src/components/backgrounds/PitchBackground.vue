<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import gsap from 'gsap';
import { useSettingsStore } from '@/stores/settings';

/**
 * Fondo fijo de toda la aplicación: un campo de césped en perspectiva, con sus bandas de siega y las líneas blancas,
 * que se dibujan al cargar; por encima pasa despacio un haz de luz de los focos. Todo vectorial y tenue para que el
 * contenido mande; en el tema claro queda aún más suave.
 */
const settings = useSettingsStore();
const pitch = ref<SVGSVGElement | null>(null);
let tween: gsap.core.Tween | null = null;

// Bandas de siega: trapecios alternos desde la línea de fondo (arriba) hasta el borde inferior, en perspectiva.
const stripes = Array.from({ length: 12 }, (_, i) => {
  const t0 = i / 12;
  const t1 = (i + 1) / 12;
  const left = (t: number) => 560 - 440 * t;
  const right = (t: number) => 1040 + 440 * t;
  const y = (t: number) => 300 + 600 * t;
  return { id: i, points: `${left(t0)},${y(t0)} ${right(t0)},${y(t0)} ${right(t1)},${y(t1)} ${left(t1)},${y(t1)}`, light: i % 2 === 0 };
});

onMounted(() => {
  if (!pitch.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lines = Array.from(pitch.value.querySelectorAll<SVGGeometryElement>('[data-draw]'));
  for (const line of lines) {
    const length = line.getTotalLength();
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length}`;
  }
  tween = gsap.to(lines, { strokeDashoffset: 0, duration: 1.8, ease: 'power2.out', stagger: 0.06, delay: 0.2 });
});

onBeforeUnmount(() => tween?.kill());
</script>

<template>
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas" aria-hidden="true">
    <!-- Luz de los focos sobre la grada -->
    <div class="absolute inset-x-0 top-0 h-[55vh]" :class="settings.isDark ? 'bg-[radial-gradient(ellipse_at_50%_-20%,rgba(255,255,255,0.08),transparent_60%)]' : 'bg-[radial-gradient(ellipse_at_50%_-20%,rgba(255,255,255,0.9),transparent_60%)]'" />

    <!-- Campo -->
    <svg
      ref="pitch"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMax slice"
      class="absolute inset-x-0 bottom-0 h-[62vh] w-full"
      :class="settings.isDark ? 'opacity-[0.42]' : 'opacity-[0.3]'"
    >
      <defs>
        <linearGradient id="grass-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="var(--t-canvas)" stop-opacity="1" />
          <stop offset="0.35" stop-color="var(--t-canvas)" stop-opacity="0" />
        </linearGradient>
        <linearGradient id="light-sweep" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0" />
          <stop offset="0.5" stop-color="#ffffff" stop-opacity="0.22" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
        </linearGradient>
        <clipPath id="pitch-clip">
          <polygon points="560,300 1040,300 1480,900 120,900" />
        </clipPath>
      </defs>

      <!-- Césped con bandas de siega -->
      <g clip-path="url(#pitch-clip)">
        <rect x="0" y="300" width="1600" height="600" fill="#2a8a45" />
        <polygon v-for="s in stripes" :key="s.id" :points="s.points" :fill="s.light ? '#36a052' : '#2a8a45'" />
        <!-- Haz de luz que recorre el campo -->
        <rect class="sweep" x="-700" y="300" width="700" height="600" fill="url(#light-sweep)" />
      </g>

      <!-- Líneas del campo -->
      <g fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path data-draw d="M 560 300 L 1040 300 L 1480 900 L 120 900 Z" />
        <path data-draw d="M 330 600 L 1270 600" />
        <ellipse data-draw cx="800" cy="600" rx="190" ry="58" />
        <path data-draw d="M 230 900 L 330 740 L 1270 740 L 1370 900" />
        <path data-draw d="M 520 900 L 560 830 L 1040 830 L 1080 900" />
        <path data-draw d="M 690 300 L 668 342 L 932 342 L 910 300" />
        <path data-draw d="M 640 300 L 600 372 L 1000 372 L 960 300" />
        <path data-draw d="M 650 740 A 170 50 0 0 1 950 740" />
        <path data-draw d="M 760 372 A 60 20 0 0 0 840 372" />
      </g>
      <circle cx="800" cy="600" r="5" fill="#ffffff" fill-opacity="0.85" />

      <!-- Fundido con el cielo -->
      <rect x="0" y="300" width="1600" height="600" fill="url(#grass-fade)" />
    </svg>
  </div>
</template>

<style scoped>
.sweep {
  animation: sweep 14s ease-in-out infinite;
}

@keyframes sweep {
  0% { transform: translateX(0); }
  50% { transform: translateX(2300px); }
  100% { transform: translateX(0); }
}

@media (prefers-reduced-motion: reduce) {
  .sweep { animation: none; }
}
</style>
