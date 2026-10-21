<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import gsap from 'gsap';

/**
 * Fondo fijo de toda la aplicación: cielo nocturno con focos de estadio, un campo en perspectiva cuyas líneas se
 * dibujan al cargar y unas motas de luz flotando. Todo vectorial y muy sutil para no competir con el contenido.
 */
const pitch = ref<SVGSVGElement | null>(null);
const particles = Array.from({ length: 14 }, (_, i) => ({
  id: i,
  left: `${(i * 37) % 100}%`,
  top: `${15 + ((i * 53) % 70)}%`,
  size: 2 + (i % 3),
  delay: `${(i * 0.7) % 6}s`,
  duration: `${9 + (i % 5) * 2}s`,
}));

let tween: gsap.core.Tween | null = null;

onMounted(() => {
  if (!pitch.value) return;
  const lines = Array.from(pitch.value.querySelectorAll<SVGGeometryElement>('[data-draw]'));
  for (const line of lines) {
    const length = line.getTotalLength();
    line.style.strokeDasharray = `${length}`;
    line.style.strokeDashoffset = `${length}`;
  }
  tween = gsap.to(lines, { strokeDashoffset: 0, duration: 2.2, ease: 'power2.out', stagger: 0.08, delay: 0.2 });
});

onBeforeUnmount(() => tween?.kill());
</script>

<template>
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-navy-950" aria-hidden="true">
    <!-- Focos del estadio -->
    <div class="absolute -left-40 -top-40 h-[42rem] w-[42rem] rounded-full bg-brand-600/25 blur-[140px]" />
    <div class="absolute -right-48 top-1/3 h-[36rem] w-[36rem] rounded-full bg-accent-500/15 blur-[150px]" />
    <div class="absolute bottom-0 left-1/2 h-[30rem] w-[70rem] -translate-x-1/2 rounded-[100%] bg-emerald-500/10 blur-[120px]" />

    <!-- Campo en perspectiva -->
    <svg ref="pitch" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice" class="absolute inset-x-0 bottom-0 h-[70vh] w-full opacity-[0.28]">
      <defs>
        <linearGradient id="pitch-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#35d3ff" stop-opacity="0" />
          <stop offset="0.55" stop-color="#35d3ff" stop-opacity="0.9" />
          <stop offset="1" stop-color="#2f7bff" stop-opacity="1" />
        </linearGradient>
      </defs>
      <g fill="none" stroke="url(#pitch-fade)" stroke-width="2.5" stroke-linecap="round">
        <!-- Bandas laterales y fondo -->
        <path data-draw d="M 560 300 L 120 900" />
        <path data-draw d="M 1040 300 L 1480 900" />
        <path data-draw d="M 560 300 L 1040 300" />
        <!-- Línea de medio campo y círculo central -->
        <path data-draw d="M 330 600 L 1270 600" />
        <ellipse data-draw cx="800" cy="600" rx="190" ry="58" />
        <!-- Área grande y área pequeña -->
        <path data-draw d="M 230 900 L 330 740 L 1270 740 L 1370 900" />
        <path data-draw d="M 520 900 L 560 830 L 1040 830 L 1080 900" />
        <path data-draw d="M 690 300 L 668 342 L 932 342 L 910 300" />
        <path data-draw d="M 640 300 L 600 372 L 1000 372 L 960 300" />
        <!-- Semicírculos -->
        <path data-draw d="M 650 740 A 170 50 0 0 1 950 740" />
      </g>
    </svg>

    <!-- Motas de luz -->
    <span
      v-for="p in particles"
      :key="p.id"
      class="particle absolute rounded-full bg-accent-300"
      :style="{ left: p.left, top: p.top, width: `${p.size}px`, height: `${p.size}px`, animationDelay: p.delay, animationDuration: p.duration }"
    />

    <!-- Viñeta -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,11,26,0.85)_100%)]" />
  </div>
</template>

<style scoped>
.particle {
  opacity: 0;
  box-shadow: 0 0 10px 2px rgba(143, 232, 255, 0.5);
  animation-name: drift;
  animation-timing-function: ease-in-out;
  animation-iteration-count: infinite;
}

@keyframes drift {
  0% { transform: translate3d(0, 0, 0); opacity: 0; }
  15% { opacity: 0.8; }
  50% { transform: translate3d(28px, -60px, 0); opacity: 0.5; }
  85% { opacity: 0.6; }
  100% { transform: translate3d(-18px, -120px, 0); opacity: 0; }
}

@media (prefers-reduced-motion: reduce) {
  .particle { animation: none; opacity: 0.35; }
}
</style>
