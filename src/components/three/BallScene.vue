<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  AmbientLight,
  Clock,
  DirectionalLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  PointLight,
  Scene,
  SphereGeometry,
  WebGLRenderer,
} from 'three';
import { createBallTexture } from '@/three/ballTexture';

/**
 * Balón 3D con Three.js "a pelo": solo se importan las clases que se usan (renderer, escena, cámara, esfera, material y
 * luces), así el chunk pesa la mitad que con un wrapper que registra toda la librería. Gira y flota; se pausa cuando
 * no está a la vista o la pestaña está oculta.
 */
const props = withDefaults(defineProps<{ spin?: number; float?: number; zoom?: number }>(), { spin: 0.35, float: 0.12, zoom: 1 });

/** Sin WebGL o con animaciones reducidas se muestra un balón estático en SVG. */
const supported = computed(() => {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
});

const container = ref<HTMLDivElement | null>(null);
let cleanup: (() => void) | null = null;

onMounted(() => {
  const host = container.value;
  if (!host || !supported.value) return;

  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.set(0, 0.2, 3.6 / props.zoom);

  const texture = createBallTexture();
  const geometry = new SphereGeometry(1, 96, 96);
  const material = new MeshStandardMaterial({ map: texture, roughness: 0.42, metalness: 0.08 });
  const ball = new Mesh(geometry, material);
  scene.add(ball);

  // Luces de estadio: una principal blanca y dos de relleno en cian y azul eléctrico.
  scene.add(new AmbientLight(0xffffff, 0.9));
  const key = new DirectionalLight(0xffffff, 2.6);
  key.position.set(4, 6, 5);
  scene.add(key);
  const cyan = new PointLight(0x35d3ff, 60, 12);
  cyan.position.set(-4, -1, 3);
  scene.add(cyan);
  const blue = new PointLight(0x2f7bff, 40, 12);
  blue.position.set(3, -3, -2);
  scene.add(blue);

  const resize = () => {
    const size = Math.max(1, Math.min(host.clientWidth, host.clientHeight || host.clientWidth));
    renderer.setSize(size, size, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
  };
  resize();
  const observer = new ResizeObserver(resize);
  observer.observe(host);

  // Solo se renderiza mientras el balón está a la vista y la pestaña activa.
  let visible = true;
  const visibility = new IntersectionObserver(([entry]) => { visible = entry?.isIntersecting ?? true; }, { threshold: 0.05 });
  visibility.observe(host);

  const clock = new Clock();
  const draw = () => {
    const elapsed = clock.getElapsedTime();
    ball.rotation.y = elapsed * props.spin;
    ball.rotation.x = Math.sin(elapsed * 0.6) * 0.18 + 0.35;
    ball.position.y = Math.sin(elapsed * 1.4) * props.float;
    renderer.render(scene, camera);
  };

  // Primer fotograma en el acto (no espera al siguiente ciclo de animación) y después el bucle.
  draw();
  let frame = 0;
  const render = () => {
    frame = requestAnimationFrame(render);
    if (visible && !document.hidden) draw();
  };
  render();

  cleanup = () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    visibility.disconnect();
    geometry.dispose();
    material.dispose();
    texture.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
});

onBeforeUnmount(() => cleanup?.());
</script>

<template>
  <div class="relative h-full w-full">
    <div v-if="supported" ref="container" class="absolute inset-0" />

    <svg v-else viewBox="0 0 200 200" class="h-full w-full" aria-hidden="true">
      <defs>
        <radialGradient id="ball-shade" cx="35%" cy="30%" r="75%">
          <stop offset="0" stop-color="#ffffff" />
          <stop offset="1" stop-color="#b9c4dd" />
        </radialGradient>
      </defs>
      <circle cx="100" cy="100" r="88" fill="url(#ball-shade)" />
      <g fill="#111827">
        <polygon points="100,62 122,78 114,104 86,104 78,78" />
        <polygon points="40,96 58,84 70,104 56,122 36,116" />
        <polygon points="160,96 142,84 130,104 144,122 164,116" />
        <polygon points="70,160 86,144 110,152 110,174 84,180" />
        <polygon points="130,160 114,144 90,152 90,174 116,180" transform="translate(40 0)" />
      </g>
    </svg>
  </div>
</template>
