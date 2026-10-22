<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useSettingsStore } from '@/stores/settings';

/**
 * Fondo de toda la aplicación: un campo de césped medio largo, visto desde la banda a ras de suelo, con el viento
 * peinándolo a rachas. Se dibuja entero en un shader (un solo plano a pantalla completa): cada píxel lanza un rayo
 * desde la cámara hasta el suelo y calcula allí la hierba (ruido anisótropo, las briznas se estiran hacia la cámara),
 * las bandas de siega, las líneas de cal y la racha de viento que recorre el campo. Sin texturas ni modelos.
 *
 * Va a media resolución y a 30 fps como máximo, se para cuando la pestaña no está visible y, con animaciones
 * reducidas o sin WebGL, se queda en un fotograma fijo (o en un degradado CSS). WebGL sin librerías: un programa y
 * un triángulo que cubre la pantalla.
 */
const settings = useSettingsStore();
const host = ref<HTMLDivElement | null>(null);
const fallback = ref(false);

let dispose: (() => void) | null = null;
let setTheme: ((dark: boolean) => void) | null = null;

const vertexShader = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragmentShader = `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uDark;
  uniform float uStrength;

  // --- ruido -------------------------------------------------------------------------------------------------
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = p * 2.03 + vec2(17.0, 9.0);
      a *= 0.5;
    }
    return v;
  }

  // --- líneas de cal: una banda y el círculo central, en coordenadas del campo (metros) ---------------------------
  float chalk(vec2 w, float px) {
    float width = 0.12 + px * 1.5;
    float side = smoothstep(width, 0.0, abs(w.y - 34.0));
    float mid = smoothstep(width, 0.0, abs(w.x));
    float circle = smoothstep(width, 0.0, abs(length(w - vec2(0.0, 0.0)) - 9.15));
    float spot = smoothstep(0.35 + px, 0.0, length(w));
    return clamp(side + mid + circle + spot, 0.0, 1.0);
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / uResolution.y;

    // Cámara a 1,1 m del suelo mirando ligeramente hacia abajo, hacia el centro del campo.
    vec3 ro = vec3(-7.0, 1.1, -24.0);
    float pitch = -0.085;
    vec3 rd = normalize(vec3(uv.x, uv.y * cos(pitch) - 0.62 * sin(pitch) - 0.07, 0.62 * cos(pitch) + uv.y * sin(pitch)));

    float horizon = smoothstep(-0.02, 0.06, rd.y);
    vec3 skyDark = vec3(0.039, 0.067, 0.125);
    vec3 skyLight = vec3(0.93, 0.95, 0.97);
    vec3 sky = mix(skyLight, skyDark, uDark);

    vec3 col = sky;
    if (rd.y < 0.0) {
      float t = -ro.y / rd.y;
      vec3 w = ro + rd * t;
      float dist = t;
      float px = dist * 0.004;

      // Racha de viento: un campo de ruido lento que viaja en diagonal; donde pasa, las briznas se tumban y brillan,
      // y por encima corre una ondulación más rápida, como las olas que levanta el viento en la hierba alta.
      float gust = fbm(w.xz * 0.04 + vec2(-uTime * 0.14, uTime * 0.04));
      gust = smoothstep(0.38, 0.72, gust);
      float wave = 0.5 + 0.5 * sin(w.z * 0.9 - w.x * 0.25 - uTime * 2.2 + fbm(w.xz * 0.15) * 5.0);
      float sway = (fbm(w.xz * 0.3 + uTime * 0.4) - 0.5) * 0.6 * (0.35 + gust) + wave * gust * 0.25;

      // Briznas: ruido muy fino a lo ancho y laxo en profundidad (en pantalla, trazos verticales cortos), inclinado
      // por el viento. Dos capas con umbral para que se distingan tallos claros y sombra entre ellos; se funden con
      // la distancia para no chisporrotear en el horizonte.
      float detail = exp(-dist * 0.045);
      vec2 bladeUv = vec2(w.x * 16.0 + sway * 6.0, w.z * 2.2 + sway * 1.5);
      float tall = smoothstep(0.28, 0.82, noise(bladeUv));
      float fine = smoothstep(0.35, 0.8, noise(bladeUv * 2.7 + vec2(11.0, 3.0)));
      float blades = mix(0.5, tall * 0.65 + fine * 0.35, detail);
      float clumps = fbm(w.xz * 0.5);

      // Bandas de siega a lo ancho: la hierba peinada en sentidos alternos refleja la luz de forma distinta.
      float band = step(0.5, fract(w.z / 5.5 + 0.25)) * 2.0 - 1.0;
      float stripe = 0.5 + 0.5 * band * (0.11 + 0.05 * gust);

      vec3 deep = mix(vec3(0.13, 0.38, 0.17), vec3(0.045, 0.15, 0.07), uDark);
      vec3 bright = mix(vec3(0.38, 0.68, 0.30), vec3(0.17, 0.40, 0.17), uDark);
      vec3 grass = mix(deep, bright, blades * 0.7 + clumps * 0.3);
      grass *= 0.8 + 0.4 * stripe;

      // Reflejo de la luz sobre las briznas que tumba el viento, siguiendo la ondulación.
      float sheen = gust * (0.45 + 0.55 * wave) * (0.5 + 0.5 * blades) * detail;
      grass += vec3(0.16, 0.20, 0.09) * sheen * mix(1.0, 0.7, uDark);

      // Cal
      float lines = chalk(w.xz, px) * exp(-dist * 0.02);
      vec3 chalkColor = mix(vec3(0.97), vec3(0.78, 0.82, 0.86), uDark);
      grass = mix(grass, chalkColor, lines * mix(0.9, 0.55, uDark));

      // Bruma hacia el horizonte: el campo se funde con el fondo de la aplicación.
      float fog = 1.0 - exp(-dist * mix(0.012, 0.02, uDark));
      col = mix(grass, sky, fog);
    }

    col = mix(col, sky, horizon);

    // Viñeta y atenuación general para que el contenido mande sobre el fondo.
    float vignette = smoothstep(1.35, 0.35, length(uv * vec2(0.9, 1.3)));
    col = mix(sky, col, mix(0.65, 1.0, vignette) * uStrength);

    gl_FragColor = vec4(col, 1.0);
  }
`;

onMounted(() => {
  const el = host.value;
  if (!el) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = (canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' }) ??
      canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null;
  } catch {
    gl = null;
  }
  if (!gl) {
    fallback.value = true;
    return;
  }
  el.appendChild(canvas);

  // WebGL a pelo: un programa, un triángulo que cubre la pantalla y cuatro uniformes. Sin librerías.
  const compile = (type: number, source: string) => {
    const shader = gl.createShader(type)!;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) ?? 'shader');
    return shader;
  };
  const program = gl.createProgram()!;
  try {
    gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexShader));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentShader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? 'program');
  } catch {
    canvas.remove();
    fallback.value = true;
    return;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const position = gl.getAttribLocation(program, 'position');
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

  const uniforms = {
    uResolution: gl.getUniformLocation(program, 'uResolution'),
    uTime: gl.getUniformLocation(program, 'uTime'),
    uDark: gl.getUniformLocation(program, 'uDark'),
    uStrength: gl.getUniformLocation(program, 'uStrength'),
  };
  const state = {
    dark: settings.isDark ? 1 : 0,
    strength: settings.isDark ? 0.62 : 0.8,
  };
  if (import.meta.env.DEV) (window as unknown as { __ttGrass?: typeof state }).__ttGrass = state;

  // Media resolución: el césped es suave por naturaleza y así cuesta poco en portátiles.
  const ratio = Math.min(window.devicePixelRatio, 1.5) * 0.8;
  const resize = () => {
    canvas.width = Math.max(1, Math.round(window.innerWidth * ratio));
    canvas.height = Math.max(1, Math.round(window.innerHeight * ratio));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uniforms.uResolution, canvas.width, canvas.height);
  };
  resize();
  window.addEventListener('resize', resize);

  const draw = (time: number) => {
    gl.uniform1f(uniforms.uTime, time);
    gl.uniform1f(uniforms.uDark, state.dark);
    gl.uniform1f(uniforms.uStrength, state.strength);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  // El tema cambia el tinte en caliente, con una transición corta entre claro y oscuro.
  let target = state.dark;
  setTheme = (dark) => { target = dark ? 1 : 0; state.strength = dark ? 0.62 : 0.8; };

  const start = performance.now();
  let frame = 0;
  let last = 0;
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (document.hidden) return;
    const needsTint = Math.abs(state.dark - target) > 0.001;
    if (!needsTint && (reduced || now - last < 1000 / 30)) return;
    last = now;
    state.dark += (target - state.dark) * 0.12;
    if (Math.abs(state.dark - target) < 0.002) state.dark = target;
    draw(reduced ? 0 : (now - start) / 1000);
  };
  draw(0);
  frame = requestAnimationFrame(loop);

  dispose = () => {
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', resize);
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    canvas.remove();
  };
});

watch(() => settings.isDark, (dark) => setTheme?.(dark));
onBeforeUnmount(() => dispose?.());
</script>

<template>
  <div ref="host" class="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-canvas" :class="{ 'grass-fallback': fallback }" aria-hidden="true" />
</template>

<style scoped>
.grass-fallback {
  background:
    linear-gradient(to bottom, var(--t-canvas) 0%, var(--t-canvas) 45%, transparent 100%),
    linear-gradient(to bottom, #1d4a27, #0d2a16);
}
</style>
