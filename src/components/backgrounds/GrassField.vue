<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { anyLayerOpen } from '@/composables/useModalStack';
import { whenIdle } from '@/utils/idle';

const photo = ref<HTMLImageElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const showPhoto = ref(false);
const showMotion = ref(false);

const FRAME_MS = 1000 / 24;
const IDLE_MS = 20_000;
const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

let unmounted = false;
let wake: (() => void) | undefined;
let dispose: (() => void) | undefined;

onMounted(async () => {
  const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return;
  await whenIdle();
  if (!unmounted) showPhoto.value = true;
});

async function startWind() {
  const image = photo.value;
  const target = canvas.value;
  const stage = image?.parentElement;
  if (!image || !target || !stage) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const smallScreen = window.matchMedia('(pointer: coarse), (max-width: 767px)');
  const nav = navigator as Navigator & { deviceMemory?: number };
  if (reducedMotion.matches || smallScreen.matches || (nav.deviceMemory ?? 8) <= 4) return;
  const context = target.getContext('webgl2', { alpha: false, antialias: false, powerPreference: 'low-power' });
  if (!context) return;

  const THREE = await import('three');
  if (unmounted) return;

  const renderer = new THREE.WebGLRenderer({ canvas: target, context, alpha: false, antialias: false });
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  const texture = new THREE.Texture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const uniforms = {
    uPhoto: { value: texture },
    uCrop: { value: new THREE.Vector2(1, 1) },
    uPhotoPixel: { value: new THREE.Vector2(1, 1) },
    uTime: { value: 0 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vPhoto;
      uniform vec2 uCrop;
      void main() {
        vPhoto = vec2(0.5 + (uv.x - 0.5) * uCrop.x, 1.0 - (1.0 - uv.y) * uCrop.y);
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 vPhoto;
      uniform sampler2D uPhoto;
      uniform vec2 uPhotoPixel;
      uniform float uTime;

      float grassMask(vec3 color) {
        return smoothstep(0.014, 0.055, color.g - max(color.r, color.b));
      }

      void main() {
        vec3 original = texture2D(uPhoto, vPhoto).rgb;
        float foreground = 1.0 - smoothstep(0.10, 0.53, vPhoto.y);
        float grass = grassMask(original) * foreground;

        // Rachas superpuestas de menos de dos píxeles. La pintura y el horizonte quedan fijos.
        float gust = sin(dot(vPhoto, vec2(19.0, 24.0)) - 0.95 * uTime);
        float flutter = sin(dot(vPhoto, vec2(58.0, -47.0)) + 1.65 * uTime);
        vec2 drift = vec2(1.3 * gust + 0.5 * flutter, 0.35 * gust - 0.15 * flutter);
        vec3 displaced = texture2D(uPhoto, vPhoto + drift * uPhotoPixel * foreground).rgb;
        vec3 color = mix(original, displaced, grass * grassMask(displaced));

        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const plate = new THREE.Mesh(geometry, material);
  plate.frustumCulled = false;
  scene.add(plate);

  let frame = 0;
  let lastDraw = 0;
  let lastInput = performance.now();
  let contextLost = false;
  const canAnimate = () => !contextLost && !reducedMotion.matches && !smallScreen.matches;
  const shouldAnimate = () => canAnimate() && !document.hidden && !anyLayerOpen.value && performance.now() - lastInput < IDLE_MS;
  const draw = () => renderer.render(scene, camera);

  const resize = () => {
    const { clientWidth: width, clientHeight: height } = stage;
    if (!width || !height) return;
    const fit = Math.max(width / image.naturalWidth, height / image.naturalHeight);
    const displayWidth = image.naturalWidth * fit;
    const displayHeight = image.naturalHeight * fit;
    // En pantallas de alta densidad, tantos píxeles como tiene la foto y no más: si no, al empezar el viento el césped
    // se vería más borroso que la imagen fija.
    renderer.setPixelRatio(Math.max(1, Math.min(window.devicePixelRatio || 1, 1 / fit)));
    renderer.setSize(width, height, false);
    // Mismo encuadre que object-fit: cover y object-position: center top.
    uniforms.uCrop.value.set(width / displayWidth, height / displayHeight);
    uniforms.uPhotoPixel.value.set(1 / displayWidth, 1 / displayHeight);
    if (showMotion.value && !document.hidden) draw();
  };

  const stop = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    lastDraw = 0;
  };
  const tick = (now: number) => {
    if (!shouldAnimate()) {
      stop();
      return;
    }
    frame = requestAnimationFrame(tick);
    if (lastDraw && now - lastDraw < FRAME_MS) return;
    if (lastDraw) uniforms.uTime.value += Math.min(now - lastDraw, 100) / 1000;
    lastDraw = now;
    draw();
    showMotion.value = true;
  };
  const sync = () => {
    if (!canAnimate()) showMotion.value = false;
    if (!shouldAnimate()) stop();
    else if (!frame) frame = requestAnimationFrame(tick);
  };
  const onActivity = () => {
    lastInput = performance.now();
    sync();
  };
  const onContextLost = () => {
    contextLost = true;
    sync();
  };

  const observer = new ResizeObserver(resize);
  observer.observe(stage);
  resize();
  for (const event of WAKE_EVENTS) window.addEventListener(event, onActivity, { passive: true });
  document.addEventListener('visibilitychange', onActivity);
  reducedMotion.addEventListener('change', onActivity);
  smallScreen.addEventListener('change', onActivity);
  target.addEventListener('webglcontextlost', onContextLost);
  wake = onActivity;
  sync();

  dispose = () => {
    stop();
    observer.disconnect();
    for (const event of WAKE_EVENTS) window.removeEventListener(event, onActivity);
    document.removeEventListener('visibilitychange', onActivity);
    reducedMotion.removeEventListener('change', onActivity);
    smallScreen.removeEventListener('change', onActivity);
    target.removeEventListener('webglcontextlost', onContextLost);
    geometry.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
  };
}

watch(anyLayerOpen, () => wake?.());
onBeforeUnmount(() => {
  unmounted = true;
  dispose?.();
});
</script>

<template>
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas" aria-hidden="true">
    <div class="grass-stage">
      <img
        v-if="showPhoto"
        ref="photo"
        class="grass-plate"
        src="/textures/grass/pitch-sideline.webp"
        width="2172"
        height="724"
        alt=""
        fetchpriority="low"
        decoding="async"
        @load="startWind"
      />
      <canvas ref="canvas" class="grass-plate" :hidden="!showMotion" />
    </div>
    <div class="grass-veil" />
  </div>
</template>

<style scoped>
.grass-stage,
.grass-veil {
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  block-size: clamp(300px, max(45vh, 33.4vw), 68vh);
}

.grass-plate {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
  object-fit: cover;
  object-position: center top;
}

.grass-veil {
  background: linear-gradient(
    to bottom,
    var(--t-canvas) 0%,
    color-mix(in srgb, var(--t-canvas) 58%, transparent) 4%,
    color-mix(in srgb, var(--t-canvas) 24%, transparent) 11%,
    color-mix(in srgb, var(--t-canvas) 10%, transparent) 26%,
    transparent 52%
  );
}

:root[data-theme='dark'] .grass-stage {
  filter: brightness(0.65) saturate(0.84);
}
</style>
