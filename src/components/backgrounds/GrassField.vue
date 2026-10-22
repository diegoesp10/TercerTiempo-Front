<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSettingsStore } from '@/stores/settings';

/**
 * Fondo de toda la aplicación: un campo de fútbol real visto desde la banda a ras de césped, renderizado con
 * Three.js e iluminación física sobre un juego de texturas fotográficas de hierba (color, normales, rugosidad y
 * oclusión; ambientCG Grass004, CC0, en public/textures/grass). Encima van las bandas de siega y las líneas de cal,
 * y el viento peina la hierba a rachas (ondas de brillo y un leve vaivén de las normales).
 *
 * Tema claro = tarde de sol; tema oscuro = noche bajo los focos. 30 fps como máximo, se para con la pestaña oculta,
 * con animaciones reducidas se queda quieto y sin WebGL se ve un degradado.
 */
const settings = useSettingsStore();
const host = ref<HTMLDivElement | null>(null);
const fallback = ref(false);
const ready = ref(false);

let dispose: (() => void) | null = null;
let applyTheme: ((dark: boolean) => void) | null = null;

const TILE_METERS = 2.2;
const FIELD_W = 160;
const FIELD_D = 120;

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
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') ?? probe.getContext('webgl'))) throw new Error('no webgl');
  } catch {
    fallback.value = true;
    return;
  }

  const THREE = await import('three');

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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

  // Texturas: 2K siempre; en pantallas grandes y densas, color y normales a 4K.
  const big = (window.screen.width ?? 0) * window.devicePixelRatio >= 3000 && !(navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
  const loader = new THREE.TextureLoader();
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const tile = (texture: InstanceType<typeof THREE.Texture>, srgb = false) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(FIELD_W / TILE_METERS, FIELD_D / TILE_METERS);
    texture.anisotropy = maxAniso;
    if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  };
  const load = (name: string, srgb = false) =>
    new Promise<InstanceType<typeof THREE.Texture>>((resolve, reject) => loader.load(`/textures/grass/${name}.webp`, (t) => resolve(tile(t, srgb)), undefined, reject));

  let map: InstanceType<typeof THREE.Texture>;
  let normalMap: InstanceType<typeof THREE.Texture>;
  let roughnessMap: InstanceType<typeof THREE.Texture>;
  let aoMap: InstanceType<typeof THREE.Texture>;
  try {
    [map, normalMap, roughnessMap, aoMap] = await Promise.all([
      load(big ? 'color-4k' : 'color-2k', true),
      load(big ? 'normal-4k' : 'normal-2k'),
      load('roughness-2k'),
      load('ao-2k'),
    ]);
  } catch {
    renderer.dispose();
    renderer.domElement.remove();
    fallback.value = true;
    return;
  }
  aoMap.channel = 0;

  const uniforms = { uTime: { value: 0 }, uWind: { value: 1 } };
  const material = new THREE.MeshStandardMaterial({
    map,
    normalMap,
    normalScale: new THREE.Vector2(0.9, 0.9),
    roughnessMap,
    roughness: 1,
    aoMap,
    aoMapIntensity: 0.7,
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
  scene.fog = new THREE.Fog(0x000000, 20, 150);

  applyTheme = (dark) => {
    const canvasColor = getComputedStyle(document.documentElement).getPropertyValue('--t-canvas').trim() || (dark ? '#0a1120' : '#eef1f6');
    scene.fog!.color.set(canvasColor);
    scene.background = new THREE.Color(canvasColor);
    if (dark) {
      hemi.color.set(0x90a8d8);
      hemi.groundColor.set(0x0c1a10);
      hemi.intensity = 0.7;
      sun.color.set(0xd8e6ff);
      sun.intensity = 2.2;
      sun.position.set(-30, 55, 10);
      renderer.toneMappingExposure = 0.9;
      scene.fog!.near = 12;
      scene.fog!.far = 85;
    } else {
      hemi.color.set(0xd6e6ff);
      hemi.groundColor.set(0x4a6a30);
      hemi.intensity = 0.95;
      sun.color.set(0xfff0d6);
      sun.intensity = 2.4;
      sun.position.set(45, 50, -25);
      renderer.toneMappingExposure = 1.0;
      scene.fog!.near = 18;
      scene.fog!.far = 100;
    }
  };
  applyTheme(settings.isDark);

  const resize = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 768 ? 46 : 36;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener('resize', resize);

  const start = performance.now();
  let frame = 0;
  let last = 0;
  const draw = (now: number) => {
    uniforms.uTime.value = reduced ? 0 : (now - start) / 1000;
    renderer.render(scene, camera);
  };
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (document.hidden || reduced || now - last < 1000 / 30) return;
    last = now;
    draw(now);
  };
  draw(start);
  ready.value = true;
  frame = requestAnimationFrame(loop);

  dispose = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    ground.geometry.dispose();
    overlay.geometry.dispose();
    material.dispose();
    overlay.material.dispose();
    for (const t of [map, normalMap, roughnessMap, aoMap, overlayTexture]) t.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
});

watch(() => settings.isDark, (dark) => applyTheme?.(dark));
onBeforeUnmount(() => dispose?.());
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
