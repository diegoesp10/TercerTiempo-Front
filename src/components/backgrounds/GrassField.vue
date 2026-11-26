<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSettingsStore } from '@/stores/settings';
import { anyLayerOpen } from '@/composables/useModalStack';
import { whenIdle } from '@/utils/idle';

/**
 * Fondo de toda la aplicación: un campo de fútbol real visto desde la banda a ras de césped, renderizado con
 * Three.js e iluminación física sobre dos texturas fotográficas de hierba de 1024 px (color y normales; ambientCG
 * Grass004, CC0, en public/textures/grass). Encima van las bandas de siega y las líneas de cal, y el viento peina la
 * hierba a rachas (ondas de brillo y un leve vaivén de las normales).
 *
 * El contenido tapa casi todo el fondo, así que cuesta lo mínimo: 24 fps a resolución 1×, sin antialias, y se para
 * con la pestaña oculta, con una ventana abierta o tras 20 s sin tocar nada. En el móvil, con poca memoria o con
 * animaciones reducidas se pinta una sola vez; con ahorro de datos ni se descarga (se ve un degradado).
 *
 * Tema claro = tarde de sol; tema oscuro = noche bajo los focos.
 */
const settings = useSettingsStore();
const host = ref<HTMLDivElement | null>(null);
const fallback = ref(false);
const ready = ref(false);

let dispose: (() => void) | null = null;
let unmounted = false;
let applyTheme: ((dark: boolean) => void) | null = null;
let wake: (() => void) | null = null;

const TILE_METERS = 2.2;
const FIELD_W = 160;
const FIELD_D = 120;
const FRAME_MS = 1000 / 24;
const IDLE_MS = 20_000;
const WAKE_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

const noiseGlsl = `
  float ttHash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float ttNoise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(ttHash(i), ttHash(i + vec2(1.0, 0.0)), u.x), mix(ttHash(i + vec2(0.0, 1.0)), ttHash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float ttFbm(vec2 p) { float v = 0.0; float a = 0.5; for (int i = 0; i < 3; i++) { v += a * ttNoise(p); p = p * 2.1 + 7.0; a *= 0.5; } return v; }
`;

function drawOverlay(): HTMLCanvasElement {
  // Bandas de siega (alternan el brillo) y líneas de cal, pintadas una vez sobre un lienzo que cubre el campo.
  const w = 2048;
  const h = Math.round((w * FIELD_D) / FIELD_W);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const px = w / FIELD_W;

  const bands = 22;
  for (let i = 0; i < bands; i++) {
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.075)' : 'rgba(0,0,0,0.10)';
    ctx.fillRect(0, (h / bands) * i, w, h / bands + 1);
  }

  // Campo reglamentario (105 x 68) centrado, con el área grande, el área pequeña, el círculo y el punto central.
  const L = 105 * px;
  const W = 68 * px;
  const x0 = (w - L) / 2;
  const y0 = (h - W) / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 0.12 * px;
  ctx.lineJoin = 'round';
  ctx.strokeRect(x0, y0, L, W);
  ctx.beginPath();
  ctx.moveTo(x0 + L / 2, y0);
  ctx.lineTo(x0 + L / 2, y0 + W);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x0 + L / 2, y0 + W / 2, 9.15 * px, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(x0 + L / 2, y0 + W / 2, 0.3 * px, 0, Math.PI * 2);
  ctx.fill();
  for (const side of [0, 1]) {
    const dir = side === 0 ? 1 : -1;
    const gx = side === 0 ? x0 : x0 + L;
    ctx.strokeRect(side === 0 ? gx : gx - 16.5 * px, y0 + (W - 40.32 * px) / 2, 16.5 * px, 40.32 * px);
    ctx.strokeRect(side === 0 ? gx : gx - 5.5 * px, y0 + (W - 18.32 * px) / 2, 5.5 * px, 18.32 * px);
    ctx.beginPath();
    ctx.arc(gx + dir * 11 * px, y0 + W / 2, 0.3 * px, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(gx + dir * 11 * px, y0 + W / 2, 9.15 * px, side === 0 ? -0.93 : Math.PI - 0.93, side === 0 ? 0.93 : Math.PI + 0.93);
    ctx.stroke();
  }
  return canvas;
}

onMounted(async () => {
  const el = host.value;
  if (!el) return;
  const nav = navigator as { connection?: { saveData?: boolean }; deviceMemory?: number };

  try {
    const probe = document.createElement('canvas');
    if (nav.connection?.saveData || !(probe.getContext('webgl2') ?? probe.getContext('webgl'))) throw new Error('sin fondo animado');
  } catch {
    fallback.value = true;
    return;
  }

  // Una sola imagen, sin bucle: en el móvil el campo apenas asoma por los márgenes y la batería manda.
  const still =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.innerWidth < 768 ||
    (nav.deviceMemory ?? 8) <= 4;

  // Three.js y las texturas (~800 KB) esperan a que la página y sus datos hayan llegado: el fondo es lo último.
  await whenIdle(2500);
  if (unmounted) return;
  const THREE = await import('three');
  if (unmounted) return;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 400);
  camera.position.set(-9, 1.35, -34);
  camera.lookAt(2, 0.4, 12);

  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tile = (texture: InstanceType<typeof THREE.Texture>, srgb = false) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(FIELD_W / TILE_METERS, FIELD_D / TILE_METERS);
    texture.anisotropy = maxAniso;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  // Las imágenes se decodifican fuera del hilo principal (ImageBitmap). La hierba no tiene arriba ni abajo, así que
  // no hace falta darles la vuelta; si el navegador no sabe, se cargan como siempre.
  const loadClassic = (url: string) =>
    new Promise<InstanceType<typeof THREE.Texture>>((resolve, reject) => new THREE.TextureLoader().load(url, resolve, undefined, reject));
  const loadBitmap = (url: string) =>
    new Promise<InstanceType<typeof THREE.Texture>>((resolve, reject) =>
      new THREE.ImageBitmapLoader().setOptions({ premultiplyAlpha: 'none' }).load(
        url,
        (bitmap) => {
          const texture = new THREE.Texture(bitmap);
          texture.flipY = false;
          texture.needsUpdate = true;
          resolve(texture);
        },
        undefined,
        reject,
      ),
    );
  const load = async (name: string, srgb = false) => {
    const url = `/textures/grass/${name}.webp`;
    const texture = typeof createImageBitmap === 'function' ? await loadBitmap(url).catch(() => loadClassic(url)) : await loadClassic(url);
    return tile(texture, srgb);
  };

  let map: InstanceType<typeof THREE.Texture>;
  let normalMap: InstanceType<typeof THREE.Texture>;
  try {
    [map, normalMap] = await Promise.all([load('color-1k', true), load('normal-1k')]);
  } catch {
    renderer.dispose();
    renderer.domElement.remove();
    fallback.value = true;
    return;
  }
  if (unmounted) {
    map.dispose();
    normalMap.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    return;
  }

  const uniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughness: 1,
    metalness: 0,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.uniforms.uWind = uniforms.uWind;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\n varying vec3 ttWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n ttWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n uniform float uTime; uniform float uWind; varying vec3 ttWorld;\n${noiseGlsl}`)
      // Rachas de viento: un campo lento que recorre el campo y, dentro, ondas rápidas de brillo (la hierba tumbada refleja más luz).
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float ttGust = smoothstep(0.42, 0.75, ttFbm(ttWorld.xz * 0.035 + vec2(-uTime * 0.18, uTime * 0.05)));
        float ttWave = 0.5 + 0.5 * sin(ttWorld.z * 0.6 - ttWorld.x * 0.2 - uTime * 2.4 + ttFbm(ttWorld.xz * 0.12) * 6.0);
        float ttSheen = ttGust * (0.35 + 0.65 * ttWave) * uWind;
        diffuseColor.rgb *= 1.0 + 0.22 * ttSheen;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.03, 1.05, 0.95), ttSheen);`,
      )
      // Vaivén: las normales se inclinan un poco con la racha, como briznas que se mueven.
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
        normal = normalize(normal + vec3(0.12 * (ttWave - 0.5) * ttGust * uWind, 0.0, 0.08 * (ttWave - 0.5) * ttGust * uWind));`,
      );
  };

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W, FIELD_D), material);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const overlayTexture = new THREE.CanvasTexture(drawOverlay());
  overlayTexture.colorSpace = THREE.SRGBColorSpace;
  overlayTexture.anisotropy = maxAniso;
  const overlay = new THREE.Mesh(
    new THREE.PlaneGeometry(FIELD_W, FIELD_D),
    new THREE.MeshBasicMaterial({ map: overlayTexture, transparent: true, depthWrite: false, toneMapped: false }),
  );
  overlay.rotation.x = -Math.PI / 2;
  overlay.position.y = 0.012;
  scene.add(overlay);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x3a5a2a, 1);
  const sun = new THREE.DirectionalLight(0xffffff, 1);
  sun.position.set(40, 60, -20);
  scene.add(hemi, sun);
  const fog = new THREE.Fog(0x000000, 20, 150);
  scene.fog = fog;

  let running = false;
  let compiled = false;
  let frame = 0;
  let lastDraw = 0;
  let windTime = 0;
  const draw = (now: number) => {
    // El viento avanza solo mientras se pinta: al volver de una pausa sigue donde estaba, sin saltos.
    if (!still && lastDraw) windTime += Math.min(now - lastDraw, 100) / 1000;
    lastDraw = now;
    uniforms.uTime.value = windTime;
    renderer.render(scene, camera);
  };
  const redrawIfPaused = () => { if (compiled && !running) draw(performance.now()); };

  applyTheme = (dark) => {
    const canvasColor = getComputedStyle(document.documentElement).getPropertyValue('--t-canvas').trim() || (dark ? '#0a1120' : '#eef1f6');
    fog.color.set(canvasColor);
    scene.background = new THREE.Color(canvasColor);
    // Sin el mapa de oclusión, la luz del cielo baja un poco para que la hierba no quede más clara que antes.
    if (dark) {
      hemi.color.set(0x90a8d8);
      hemi.groundColor.set(0x0c1a10);
      hemi.intensity = 0.6;
      sun.color.set(0xd8e6ff);
      sun.intensity = 2.2;
      sun.position.set(-30, 55, 10);
      renderer.toneMappingExposure = 0.9;
      fog.near = 12;
      fog.far = 85;
    } else {
      hemi.color.set(0xd6e6ff);
      hemi.groundColor.set(0x4a6a30);
      hemi.intensity = 0.8;
      sun.color.set(0xfff0d6);
      sun.intensity = 2.4;
      sun.position.set(45, 50, -25);
      renderer.toneMappingExposure = 1.0;
      fog.near = 18;
      fog.far = 100;
    }
    redrawIfPaused();
  };
  applyTheme(settings.isDark);

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 768 ? 46 : 36;
    camera.updateProjectionMatrix();
    redrawIfPaused();
  };
  resize();
  window.addEventListener('resize', resize);

  // El shader se compila sin bloquear la página (si el navegador lo permite) antes de la primera imagen.
  try {
    await renderer.compileAsync(scene, camera);
  } catch {
    renderer.compile(scene, camera);
  }
  if (unmounted) {
    for (const t of [map, normalMap, overlayTexture]) t.dispose();
    renderer.dispose();
    renderer.domElement.remove();
    window.removeEventListener('resize', resize);
    return;
  }
  compiled = true;

  let lastInput = performance.now();
  const shouldRun = () => !still && !document.hidden && !anyLayerOpen.value && performance.now() - lastInput < IDLE_MS;
  const loop = (now: number) => {
    if (!shouldRun()) {
      running = false;
      return;
    }
    frame = requestAnimationFrame(loop);
    if (now - lastDraw < FRAME_MS) return;
    draw(now);
  };
  wake = () => {
    lastInput = performance.now();
    if (!running && shouldRun()) {
      running = true;
      frame = requestAnimationFrame(loop);
    }
  };

  draw(performance.now());
  ready.value = true;
  if (!still) {
    for (const name of WAKE_EVENTS) window.addEventListener(name, wake, { passive: true });
    document.addEventListener('visibilitychange', wake);
    wake();
  }

  dispose = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    if (wake) {
      for (const name of WAKE_EVENTS) window.removeEventListener(name, wake);
      document.removeEventListener('visibilitychange', wake);
    }
    ground.geometry.dispose();
    overlay.geometry.dispose();
    material.dispose();
    overlay.material.dispose();
    for (const t of [map, normalMap, overlayTexture]) t.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
});

watch(() => settings.isDark, (dark) => applyTheme?.(dark));
// Al cerrar la última ventana, el campo vuelve a moverse.
watch(anyLayerOpen, (open) => { if (!open) wake?.(); });
onBeforeUnmount(() => { unmounted = true; dispose?.(); });
</script>

<template>
  <div class="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas" aria-hidden="true">
    <div ref="host" class="absolute inset-0 transition-opacity duration-700" :class="[ready ? 'opacity-100' : 'opacity-0', { 'grass-fallback': fallback }]" />
    <!-- Velo: el contenido manda; el campo asoma más abajo y en los márgenes. -->
    <div class="grass-veil absolute inset-0" />
  </div>
</template>

<style scoped>
.grass-veil {
  background: linear-gradient(to bottom, var(--t-canvas) 0%, color-mix(in srgb, var(--t-canvas) 85%, transparent) 28%, color-mix(in srgb, var(--t-canvas) 30%, transparent) 58%, color-mix(in srgb, var(--t-canvas) 22%, transparent) 100%);
}
:root[data-theme="dark"] .grass-veil {
  background: linear-gradient(to bottom, var(--t-canvas) 0%, color-mix(in srgb, var(--t-canvas) 85%, transparent) 30%, color-mix(in srgb, var(--t-canvas) 30%, transparent) 60%, color-mix(in srgb, var(--t-canvas) 22%, transparent) 100%);
}
.grass-fallback {
  opacity: 1;
  background: linear-gradient(to bottom, var(--t-canvas) 0%, var(--t-canvas) 45%, #1d4a27 70%, #0d2a16 100%);
}
</style>
