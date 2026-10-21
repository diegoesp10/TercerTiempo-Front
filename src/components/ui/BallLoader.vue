<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import gsap from 'gsap';

withDefaults(defineProps<{ size?: number }>(), { size: 36 });

const ball = ref<SVGSVGElement | null>(null);
const shadow = ref<HTMLSpanElement | null>(null);
let timeline: gsap.core.Timeline | null = null;

// Bote con aplastamiento al tocar el suelo y giro continuo; la sombra se encoge cuando el balón sube.
onMounted(() => {
  if (!ball.value || !shadow.value) return;
  timeline = gsap.timeline({ repeat: -1 });
  timeline
    .to(ball.value, { y: -22, duration: 0.42, ease: 'power2.out' })
    .to(shadow.value, { scaleX: 0.55, opacity: 0.35, duration: 0.42, ease: 'power2.out' }, '<')
    .to(ball.value, { y: 0, duration: 0.38, ease: 'power2.in' })
    .to(shadow.value, { scaleX: 1, opacity: 0.7, duration: 0.38, ease: 'power2.in' }, '<')
    .to(ball.value, { scaleY: 0.82, scaleX: 1.12, duration: 0.08, ease: 'power1.out' })
    .to(ball.value, { scaleY: 1, scaleX: 1, duration: 0.12, ease: 'power1.out' });
  gsap.to(ball.value.querySelector('g')!, { rotation: 360, transformOrigin: '50% 50%', duration: 1.6, repeat: -1, ease: 'none' });
});

onBeforeUnmount(() => {
  timeline?.kill();
  if (ball.value) gsap.killTweensOf(ball.value.querySelector('g')!);
});
</script>

<template>
  <span class="inline-flex flex-col items-center" :style="{ width: `${size}px` }" aria-hidden="true">
    <svg ref="ball" viewBox="0 0 100 100" :width="size" :height="size" class="origin-bottom drop-shadow-[0_6px_14px_rgba(53,211,255,0.35)]">
      <defs>
        <radialGradient id="loader-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" stop-color="#c3cde3" />
        </radialGradient>
      </defs>
      <g>
        <circle cx="50" cy="50" r="46" fill="url(#loader-shade)" />
        <g fill="#111827">
          <polygon points="50,29 63,38 58,53 42,53 37,38" />
          <polygon points="16,46 27,38 35,50 26,61 14,58" />
          <polygon points="84,46 73,38 65,50 74,61 86,58" />
          <polygon points="32,86 40,72 55,76 57,90 42,94" />
          <polygon points="68,86 60,72 45,76 43,90 58,94" transform="translate(20 0)" />
        </g>
      </g>
    </svg>
    <span ref="shadow" class="mt-1 block h-1.5 rounded-full bg-accent-400/70 blur-[2px]" :style="{ width: `${size * 0.8}px` }" />
  </span>
</template>
