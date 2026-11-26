<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useId } from 'vue';

// Pizarra táctica de las pantallas de acceso: una jugada que se dibuja sola en bucle (desmarques punteados, pases
// discontinuos, tiro y gol) y vuelve a empezar. Los nuestros van rellenos y los rivales en hueco, como en una pizarra.
// En vertical (el panel estrecho de «Darme de alta») es el mismo dibujo girado. Con «reducir movimiento» se queda
// quieta en el gol.
withDefaults(defineProps<{ vertical?: boolean }>(), { vertical: false });

type Point = readonly [number, number];
type Frame = readonly [number, number, number];
// Desde el segundo t0 hasta t1 va de donde esté a (x, y); con run, deja su desmarque punteado.
type Leg = readonly [number, number, number, number, boolean?];

const LOOP = 10;
const W = 440;
const H = 292;
const RESET = [8.6, 9.8] as const;
const MOVE = '0.45 0 0.25 1';
const KICK = '0.1 0.6 0.3 1';
const HOLD = '0 0 1 1';
const CYAN = '#35d3ff';
const NAVY = '#081a42';

const at = (t: number) => +(t / LOOP).toFixed(4);

function track(frames: Frame[], ease: string) {
  return {
    x: frames[0][1],
    y: frames[0][2],
    keyTimes: frames.map(([t]) => at(t)).join(';'),
    xs: frames.map(([, x]) => x).join(';'),
    ys: frames.map(([, , y]) => y).join(';'),
    splines: frames.slice(1).map(([, x, y], i) => (x === frames[i][1] && y === frames[i][2] ? HOLD : ease)).join(';'),
  };
}

function player(start: Point, legs: Leg[] = []) {
  const frames: Frame[] = [[0, ...start]];
  let from: Point = start;
  const runs: { from: Point; to: Point; t0: number; t1: number }[] = [];
  for (const [t0, t1, x, y, run] of legs) {
    if (frames[frames.length - 1][0] !== t0) frames.push([t0, ...from]);
    frames.push([t1, x, y]);
    if (run) runs.push({ from, to: [x, y], t0, t1 });
    from = [x, y];
  }
  if (legs.length) frames.push([RESET[0], ...from], [RESET[1], ...start]);
  frames.push([LOOP, ...start]);
  return { track: legs.length ? track(frames, MOVE) : null, x: start[0], y: start[1], runs };
}

// Un segmento que crece de a a b entre t0 y t1 y que no se ve hasta que empieza.
function growing(a: Point, b: Point, t0: number, t1: number, ease: string) {
  return {
    x1: a[0],
    y1: a[1],
    show: `0;${at(t0 + 0.03)}`,
    keyTimes: `0;${at(t0)};${at(t1)};1`,
    xs: `${a[0]};${a[0]};${b[0]};${b[0]}`,
    ys: `${a[1]};${a[1]};${b[1]};${b[1]}`,
    splines: `${HOLD};${ease};${HOLD}`,
  };
}

function trim(a: Point, b: Point, start: number, end: number): [Point, Point] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / length;
  const uy = (b[1] - a[1]) / length;
  const round = (n: number) => +n.toFixed(2);
  return [
    [round(a[0] + ux * start), round(a[1] + uy * start)],
    [round(b[0] - ux * end), round(b[1] - uy * end)],
  ];
}

// La jugada: sale el central, apoyo, cambio a la banda, el extremo la mete al delantero, que la deja de cara al que
// llega desde atrás, y gol a la escuadra con el portero llegando tarde.
const P1: Point = [120, 172];
const P2: Point = [200, 110];
const P3: Point = [300, 60];
const P4: Point = [330, 160];
const P5: Point = [372, 132];
const GOAL: Point = [434, 141];

const ours = [
  player([26, 146]),
  player([92, 104]),
  player([160, 244], [[1.2, 4.2, 196, 236]]),
  player(P1, [[1.6, 3.2, 150, 160]]),
  player([182, 128], [[0.3, 1.3, ...P2, true], [2.8, 4.4, 238, 116]]),
  player([262, 88], [[1.1, 2.5, ...P3, true]]),
  player([362, 206], [[2.3, 3.7, ...P4, true]]),
  player([292, 140], [[3.3, 4.35, ...P5, true]]),
];

const rivals = [
  player([421, 152], [[4.8, 5.2, 419, 149]]),
  player([340, 92], [[2.3, 3.3, 321, 77]]),
  player([380, 196], [[2.9, 3.9, 344, 174]]),
  player([393, 111], [[4.3, 5.0, 389, 121]]),
  player([236, 152], [[0.4, 1.4, 226, 140]]),
  player([246, 58], [[1.6, 2.6, 268, 52]]),
];

const passes = [
  { from: P1, to: P2, t0: 0.6, t1: 1.4 },
  { from: P2, to: P3, t0: 1.7, t1: 2.6 },
  { from: P3, to: P4, t0: 2.9, t1: 3.8 },
  { from: P4, to: P5, t0: 4.0, t1: 4.45 },
  { from: P5, to: GOAL, t0: 4.7, t1: 5.05, shot: true },
];

const ballFrames: Frame[] = [[0, ...P1]];
for (const p of passes) ballFrames.push([p.t0, ...p.from], [p.t1, ...p.to]);
ballFrames.push([LOOP, ...GOAL]);
const ball = track(ballFrames, KICK);

const passLines = passes.map((p) => {
  const [a, b] = trim(p.from, p.to, 9, p.shot ? 4 : 9);
  return { ...growing(a, b, p.t0, p.t1, KICK), shot: !!p.shot };
});
const runLines = ours.flatMap((p) => p.runs.map((r) => growing(r.from, r.to, r.t0, r.t1, MOVE)));

// La red se abomba al entrar el balón y vuelve a su sitio.
const NET_FLAT = 'M430 131.36 L437 131.36 Q437 146 437 160.64 L430 160.64';
const NET_HIT = 'M430 131.36 L437 131.36 Q447 141 437 160.64 L430 160.64';
const netValues = [NET_FLAT, NET_FLAT, NET_HIT, NET_FLAT, NET_FLAT].join(';');
const netTimes = [0, 5.05, 5.3, 6, LOOP].map(at).join(';');
// Lo dibujado se borra antes de volver a empezar; el «GOL» sale con el gol.
const fadeTimes = [0, 8.4, 9.2, LOOP].map(at).join(';');
const goalTimes = [0, 5.1, 5.3, 8.4, 9.2, LOOP].map(at).join(';');
const ballOpacityTimes = [0, 0.4, 8.4, 9.2, LOOP].map(at).join(';');

const uid = useId();
const ids = { pass: `${uid}-pass`, shot: `${uid}-shot`, net: `${uid}-net` };

const svg = ref<SVGSVGElement | null>(null);
// Con movimiento reducido se queda quieta en el gol. Si no, solo se mueve mientras se ve: fuera de la pantalla o con la
// pestaña oculta se para (son 16 animaciones en bucle) y sigue donde iba al volver.
let observer: IntersectionObserver | null = null;
let onScreen = true;
function sync() {
  if (!svg.value) return;
  if (onScreen && document.visibilityState === 'visible') svg.value.unpauseAnimations();
  else svg.value.pauseAnimations();
}
onMounted(() => {
  if (!svg.value) return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    svg.value.pauseAnimations();
    svg.value.setCurrentTime(6.5);
    return;
  }
  if (typeof IntersectionObserver !== 'undefined') {
    observer = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      sync();
    });
    observer.observe(svg.value);
  }
  document.addEventListener('visibilitychange', sync);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  document.removeEventListener('visibilitychange', sync);
});
</script>

<template>
  <svg ref="svg" :viewBox="vertical ? `0 0 ${H} ${W}` : `0 0 ${W} ${H}`" fill="none" aria-hidden="true" focusable="false" class="block select-none">
    <defs>
      <marker :id="ids.pass" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="4.5" markerHeight="4.5" orient="auto" markerUnits="strokeWidth">
        <path d="M0 0.5 L7.5 4 L0 7.5 Z" :fill="CYAN" />
      </marker>
      <marker :id="ids.shot" viewBox="0 0 8 8" refX="6.5" refY="4" markerWidth="4" markerHeight="4" orient="auto" markerUnits="strokeWidth">
        <path d="M0 0.5 L7.5 4 L0 7.5 Z" fill="#fff" />
      </marker>
      <pattern :id="ids.net" width="3" height="3" patternUnits="userSpaceOnUse">
        <path d="M0 0 L3 3 M3 0 L0 3" stroke="#fff" stroke-opacity=".22" stroke-width=".6" />
      </pattern>
    </defs>

    <g :transform="vertical ? `translate(0 ${W}) rotate(-90)` : undefined">
      <rect x="10" y="10" width="420" height="272" rx="3" fill="#fff" fill-opacity=".03" />
      <rect v-for="k in 5" :key="k" :x="10 + (k - 1) * 84" y="10" width="42" height="272" fill="#fff" fill-opacity=".03" />

      <g stroke="#fff" stroke-opacity=".28" stroke-width="1.2">
        <rect x="10" y="10" width="420" height="272" rx="3" />
        <path d="M220 10 V282" />
        <circle cx="220" cy="146" r="36.6" />
        <rect x="10" y="65.4" width="66" height="161.2" />
        <rect x="10" y="109.35" width="22" height="73.3" />
        <path d="M76 116.75 A36.6 36.6 0 0 1 76 175.25" />
        <rect x="364" y="65.4" width="66" height="161.2" />
        <rect x="408" y="109.35" width="22" height="73.3" />
        <path d="M364 116.75 A36.6 36.6 0 0 0 364 175.25" />
        <path d="M10 14 A4 4 0 0 0 14 10 M426 10 A4 4 0 0 0 430 14 M430 278 A4 4 0 0 0 426 282 M14 282 A4 4 0 0 0 10 278" />
      </g>
      <g fill="#fff" fill-opacity=".4">
        <circle cx="220" cy="146" r="1.6" />
        <circle cx="54" cy="146" r="1.4" />
        <circle cx="386" cy="146" r="1.4" />
      </g>

      <rect x="3" y="131.36" width="7" height="29.28" :fill="`url(#${ids.net})`" stroke="#fff" stroke-opacity=".5" stroke-width="1.3" />
      <path :d="NET_FLAT" :fill="`url(#${ids.net})`" stroke="#fff" stroke-opacity=".5" stroke-width="1.3">
        <animate attributeName="d" :values="netValues" :keyTimes="netTimes" dur="10s" repeatCount="indefinite" />
      </path>

      <g>
        <animate attributeName="opacity" values="1;1;0;0" :keyTimes="fadeTimes" dur="10s" repeatCount="indefinite" />
        <line
          v-for="(r, i) in runLines"
          :key="`run-${i}`"
          :x1="r.x1"
          :y1="r.y1"
          :x2="r.x1"
          :y2="r.y1"
          opacity="0"
          stroke="#fff"
          stroke-opacity=".5"
          stroke-width="1.4"
          stroke-linecap="round"
          stroke-dasharray="0.01 4"
        >
          <animate attributeName="opacity" calcMode="discrete" values="0;1" :keyTimes="r.show" dur="10s" repeatCount="indefinite" />
          <animate attributeName="x2" calcMode="spline" :values="r.xs" :keyTimes="r.keyTimes" :keySplines="r.splines" dur="10s" repeatCount="indefinite" />
          <animate attributeName="y2" calcMode="spline" :values="r.ys" :keyTimes="r.keyTimes" :keySplines="r.splines" dur="10s" repeatCount="indefinite" />
        </line>
        <line
          v-for="(p, i) in passLines"
          :key="`pass-${i}`"
          :x1="p.x1"
          :y1="p.y1"
          :x2="p.x1"
          :y2="p.y1"
          opacity="0"
          :stroke="p.shot ? '#fff' : CYAN"
          :stroke-opacity="p.shot ? 0.9 : 0.85"
          :stroke-width="p.shot ? 1.8 : 1.6"
          :stroke-dasharray="p.shot ? undefined : '5 4'"
          :marker-end="`url(#${p.shot ? ids.shot : ids.pass})`"
        >
          <animate attributeName="opacity" calcMode="discrete" values="0;1" :keyTimes="p.show" dur="10s" repeatCount="indefinite" />
          <animate attributeName="x2" calcMode="spline" :values="p.xs" :keyTimes="p.keyTimes" :keySplines="p.splines" dur="10s" repeatCount="indefinite" />
          <animate attributeName="y2" calcMode="spline" :values="p.ys" :keyTimes="p.keyTimes" :keySplines="p.splines" dur="10s" repeatCount="indefinite" />
        </line>
      </g>

      <circle v-for="(p, i) in rivals" :key="`rival-${i}`" :cx="p.x" :cy="p.y" r="6" fill="#0b2152" stroke="#fff" stroke-opacity=".65" stroke-width="1.5">
        <template v-if="p.track">
          <animate attributeName="cx" calcMode="spline" :values="p.track.xs" :keyTimes="p.track.keyTimes" :keySplines="p.track.splines" dur="10s" repeatCount="indefinite" />
          <animate attributeName="cy" calcMode="spline" :values="p.track.ys" :keyTimes="p.track.keyTimes" :keySplines="p.track.splines" dur="10s" repeatCount="indefinite" />
        </template>
      </circle>
      <circle v-for="(p, i) in ours" :key="`ours-${i}`" :cx="p.x" :cy="p.y" r="6.5" :fill="CYAN" :stroke="NAVY" stroke-width="1.2">
        <template v-if="p.track">
          <animate attributeName="cx" calcMode="spline" :values="p.track.xs" :keyTimes="p.track.keyTimes" :keySplines="p.track.splines" dur="10s" repeatCount="indefinite" />
          <animate attributeName="cy" calcMode="spline" :values="p.track.ys" :keyTimes="p.track.keyTimes" :keySplines="p.track.splines" dur="10s" repeatCount="indefinite" />
        </template>
      </circle>

      <circle :cx="ball.x" :cy="ball.y" r="3.2" fill="#fff" :stroke="NAVY" stroke-width="1" opacity="0">
        <animate attributeName="opacity" values="0;1;1;0;0" :keyTimes="ballOpacityTimes" dur="10s" repeatCount="indefinite" />
        <animate attributeName="cx" calcMode="spline" :values="ball.xs" :keyTimes="ball.keyTimes" :keySplines="ball.splines" dur="10s" repeatCount="indefinite" />
        <animate attributeName="cy" calcMode="spline" :values="ball.ys" :keyTimes="ball.keyTimes" :keySplines="ball.splines" dur="10s" repeatCount="indefinite" />
      </circle>

      <g opacity="0" :transform="vertical ? 'rotate(90 397 201)' : undefined">
        <animate attributeName="opacity" values="0;0;1;1;0;0" :keyTimes="goalTimes" dur="10s" repeatCount="indefinite" />
        <rect x="375" y="191.5" width="44" height="19" rx="9.5" :fill="CYAN" />
        <text x="398" y="205.2" text-anchor="middle" class="font-display" font-size="12" font-weight="700" letter-spacing="1.5" :fill="NAVY">GOL</text>
      </g>
    </g>
  </svg>
</template>
