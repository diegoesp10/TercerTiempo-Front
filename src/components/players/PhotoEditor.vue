<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, shallowRef } from 'vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';
import type { ChoiceOption } from '@/components/ui/choice';
import { figureBox, initialKept, keptMask, personAt, wholePeople, withFragments, type Box, type CutOut } from '@/utils/figureCutout';

// Editor de la foto de la ficha: se arrastra con el ratón o el dedo dentro del marco 4:5 (lo que queda fuera se ve
// oscurecido), la rueda o pellizcar cambian el tamaño y los deslizadores afinan tamaño y giro. El recorte automático se
// puede retocar a mano —con un pincel o rodeando con el lazo lo que sobra o lo que se comió— y elegir a qué personas de
// la foto se deja. Todo pasa en el navegador; solo se sube el resultado (`exportBlob`).
const props = defineProps<{ cut: CutOut }>();

const OUT_W = 800;
const OUT_H = 1000;
const MARGIN = 90;
const STAGE_W = OUT_W + 2 * MARGIN;
const STAGE_H = OUT_H + 2 * MARGIN;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 3;
const MAX_ROTATION = 45;
const HISTORY = 60;
// Máscaras y resaltados guardados: cada máscara ocupa lo que la foto (hasta ~8 MB), así que solo los últimos.
const CACHE = 8;
// Un lazo que encierra menos que esto (px² del resultado) se toma por un toque sin querer.
const MIN_LASSO_AREA = 400;

type Tool = 'move' | 'erase' | 'restore' | 'people';
type Shape = 'brush' | 'lasso';
interface Point { x: number; y: number }
// Los puntos van en píxeles de la foto: así el retoque no depende de cómo esté encuadrada.
interface Stroke { mode: 'erase' | 'restore'; shape: Shape; radius: number; points: number[] }
interface MaskState { kept: number[]; strokes: Stroke[] }
interface Placement { x: number; y: number; scale: number; rotation: number; flip: boolean }
// El resaltado de una mancha, solo de su caja (en píxeles de la foto).
interface Highlight { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }
type Gesture =
  | { kind: 'pan'; last: Point }
  | { kind: 'pinch'; ids: [number, number]; dist: number; angle: number; mid: Point; from: Placement }
  | { kind: 'stroke'; stroke: Stroke }
  | { kind: 'lasso'; stroke: Stroke; path: Point[] }
  | { kind: 'tap'; start: Point; moved: boolean };

const tools: ChoiceOption<Tool>[] = [
  { value: 'move', label: 'Mover', icon: 'up-down-left-right' },
  { value: 'erase', label: 'Borrar', icon: 'eraser' },
  { value: 'restore', label: 'Recuperar', icon: 'paintbrush' },
  { value: 'people', label: 'Personas', icon: 'user-check' },
];
const shapes: ChoiceOption<Shape>[] = [
  { value: 'brush', label: 'Pincel', icon: 'brush' },
  { value: 'lasso', label: 'Lazo', icon: 'draw-polygon' },
];

const W = props.cut.original.width;
const H = props.cut.original.height;
const stage = ref<HTMLCanvasElement | null>(null);
const tool = ref<Tool>('move');
const shape = ref<Shape>('brush');
const removeBackground = ref(props.cut.figureFound);
const brush = ref(28);
const placement = reactive<Placement>({ x: OUT_W / 2, y: OUT_H / 2, scale: 1, rotation: 0, flip: false });
const fitScale = ref(1);
const state = shallowRef<MaskState>({ kept: [...initialKept(props.cut)], strokes: [] });
const undoStack = shallowRef<MaskState[]>([]);
const redoStack = shallowRef<MaskState[]>([]);
const moving = ref(false);
// Lo que queda en la máscara después de cada retoque: para encuadrar y para avisar si sale alguien pegado.
const figureBounds = shallowRef<Box | null>(null);

const mask = document.createElement('canvas');
mask.width = W;
mask.height = H;
const figure = document.createElement('canvas');
figure.width = W;
figure.height = H;
const baseMasks = new Map<string, HTMLCanvasElement>();
const highlights = new Map<string, Highlight>();
const pointers = new Map<number, Point>();
let gesture: Gesture | null = null;
// Mientras el usuario no mueva, acerque o gire la foto, el encuadre sigue a lo que elige (personas, recorte, fondo).
let framedByHand = false;
let cursor: Point | null = null;
let hovered: number | null = null;
let figureDirty = true;
let frame = 0;
let resizer: ResizeObserver | null = null;

const dab = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.55, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return c;
})();

const zoom = computed(() => placement.scale / fitScale.value);
const brushTool = computed(() => tool.value === 'erase' || tool.value === 'restore');
const canUndo = computed(() => undoStack.value.length > 0);
const canRedo = computed(() => redoStack.value.length > 0);
const leftOut = computed(() => wholePeople(props.cut).filter((p) => !state.value.kept.includes(p.id)).length);
const help = computed(() => {
  if (tool.value === 'move') return 'Arrastra la foto para colocarla. Con la rueda del ratón o pellizcando con dos dedos cambias el tamaño.';
  if (tool.value === 'people') {
    return 'Toca a cada persona para dejarla o quitarla de tu foto; las que no salen se ven en tenue. Con el ratón encima, en verde la que se añade y en rojo la que se quita.';
  }
  if (shape.value === 'lasso') {
    return tool.value === 'erase'
      ? 'Rodea con el ratón o el dedo lo que sobra (alguien pegado a ti, un trozo de fondo) y suelta: se quita todo lo de dentro.'
      : 'Rodea con el ratón o el dedo lo que el recorte se comió y suelta: vuelve todo lo de dentro.';
  }
  return tool.value === 'erase'
    ? 'Pasa el pincel por lo que sobra. Lo que quitas se queda en tenue por si quieres recuperarlo.'
    : 'Pasa el pincel por lo que el recorte se comió (pelo, hombros, manos): lo que está en tenue vuelve a la foto.';
});
const notice = computed(() => {
  if (!removeBackground.value) return null;
  if (leftOut.value === 1) return 'Hay otra persona en la foto que no sale en tu ficha: con «Personas» puedes tocarla para dejarla.';
  if (leftOut.value > 1) return `Hay ${leftOut.value} personas más en la foto que no salen en tu ficha: con «Personas» puedes tocarlas para dejarlas.`;
  // Dos personas que se tocan son una sola mancha para el recorte: solo se nota en lo ancha que sale la figura. En cuanto
  // se retoca a mano, sobra el consejo (también avisaría de más con los brazos abiertos).
  const box = figureBounds.value;
  if (box && box.w > box.h * 1.35 && !state.value.strokes.length) return 'Si sale alguien pegado a ti, elige «Borrar» con el «Lazo» y rodéalo: se quita de una vez.';
  return null;
});
const cursorClass = computed(() => {
  if (tool.value === 'move' || !removeBackground.value) return moving.value ? 'cursor-grabbing' : 'cursor-grab';
  if (tool.value === 'people') return 'cursor-pointer';
  return shape.value === 'lasso' ? 'cursor-crosshair' : 'cursor-none';
});

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function schedule() {
  if (!frame) frame = requestAnimationFrame(draw);
}

function remember<T>(cache: Map<string, T>, key: string, value: T) {
  if (cache.size >= CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

// ---- Máscara: la de partida (las personas elegidas) más los retoques, que se pueden deshacer.

function baseMask(kept: number[]): HTMLCanvasElement {
  const key = [...kept].sort((a, b) => a - b).join(',');
  let base = baseMasks.get(key);
  if (!base) {
    base = keptMask(props.cut, new Set(kept));
    remember(baseMasks, key, base);
  }
  return base;
}

function paintDab(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.drawImage(dab, x - r, y - r, 2 * r, 2 * r);
}

function paintBrush(ctx: CanvasRenderingContext2D, stroke: Stroke, from: number) {
  const p = stroke.points;
  ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
  if (from === 0) paintDab(ctx, p[0]!, p[1]!, stroke.radius);
  const step = Math.max(1, stroke.radius * 0.25);
  for (let i = Math.max(2, from); i + 1 < p.length; i += 2) {
    const x0 = p[i - 2]!, y0 = p[i - 1]!, x1 = p[i]!, y1 = p[i + 1]!;
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 1; k <= n; k++) paintDab(ctx, x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, stroke.radius);
  }
  ctx.globalCompositeOperation = 'source-over';
}

function paintLasso(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const p = stroke.points;
  if (p.length < 6) return;
  ctx.globalCompositeOperation = stroke.mode === 'erase' ? 'destination-out' : 'source-over';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(p[0]!, p[1]!);
  for (let i = 2; i + 1 < p.length; i += 2) ctx.lineTo(p[i]!, p[i + 1]!);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
}

function paintStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.shape === 'lasso') paintLasso(ctx, stroke);
  else paintBrush(ctx, stroke, 0);
}

function maskChanged() {
  figureDirty = true;
  figureBounds.value = figureBox(mask);
  schedule();
}

function rebuildMask() {
  const ctx = mask.getContext('2d')!;
  ctx.clearRect(0, 0, W, H);
  ctx.drawImage(baseMask(state.value.kept), 0, 0);
  for (const stroke of state.value.strokes) paintStroke(ctx, stroke);
  maskChanged();
}

function refreshFigure() {
  const ctx = figure.getContext('2d')!;
  ctx.globalCompositeOperation = 'copy';
  ctx.drawImage(props.cut.original, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(mask, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  figureDirty = false;
}

// Con rebuild = false la máscara ya lleva el cambio (el trazo se pinta mientras se hace).
function commit(next: MaskState, rebuild = true) {
  undoStack.value = [...undoStack.value, state.value].slice(-HISTORY);
  redoStack.value = [];
  state.value = next;
  if (rebuild) rebuildMask();
  else maskChanged();
}

function undo() {
  const previous = undoStack.value.at(-1);
  if (!previous) return;
  undoStack.value = undoStack.value.slice(0, -1);
  redoStack.value = [...redoStack.value, state.value];
  state.value = previous;
  rebuildMask();
  if (!framedByHand) fit();
}

function redo() {
  const next = redoStack.value.at(-1);
  if (!next) return;
  redoStack.value = redoStack.value.slice(0, -1);
  undoStack.value = [...undoStack.value, state.value];
  state.value = next;
  rebuildMask();
  if (!framedByHand) fit();
}

function autoCutout() {
  commit({ kept: [...initialKept(props.cut)], strokes: [] });
  if (!framedByHand) fit();
}

function togglePerson(id: number) {
  const whole = new Set(wholePeople(props.cut).map((p) => p.id));
  const kept = new Set(state.value.kept);
  if (kept.has(id)) {
    kept.delete(id);
    // Sus trozos sueltos se van con ella, salvo los que caen junto a otra persona que se queda.
    if (whole.has(id)) {
      const others = withFragments(props.cut, new Set([...kept].filter((k) => whole.has(k))));
      for (const f of withFragments(props.cut, new Set([id]))) if (!others.has(f)) kept.delete(f);
    }
  } else {
    kept.add(id);
    if (whole.has(id)) for (const f of withFragments(props.cut, new Set([id]))) kept.add(f);
  }
  commit({ kept: [...kept], strokes: state.value.strokes });
  if (!framedByHand) fit();
}

function boxMoved(a: Box | null, b: Box | null) {
  if (!a || !b) return a !== b;
  return Math.abs(a.w - b.w) > 0.15 * a.w || Math.abs(a.h - b.h) > 0.15 * a.h || Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) > 0.15 * a.w;
}

function finishStroke(stroke: Stroke) {
  const before = figureBounds.value;
  commit({ kept: state.value.kept, strokes: [...state.value.strokes, stroke] }, false);
  // Un retoque pequeño no mueve la foto; quitar a alguien entero con el lazo sí la vuelve a encuadrar.
  if (!framedByHand && boxMoved(before, figureBounds.value)) fit();
}

// ---- Encuadre: centro de la foto en el marco (px del resultado), escala, giro y espejo.

// Una persona, por la altura (de cintura para arriba los hombros pueden salirse por los lados, como en las fichas de los
// profesionales); varias, además por el ancho, para que quepan todas. El espejo se respeta.
function fit() {
  const box = removeBackground.value ? figureBounds.value : null;
  placement.rotation = 0;
  if (box) {
    const kept = new Set(state.value.kept);
    const together = wholePeople(props.cut).filter((p) => kept.has(p.id)).length > 1;
    const s = Math.min((OUT_H * 0.94) / box.h, together ? (OUT_W * 0.96) / box.w : Infinity);
    const offset = (box.x + box.w / 2 - W / 2) * s;
    placement.scale = s;
    placement.x = OUT_W / 2 - (placement.flip ? -offset : offset);
    placement.y = OUT_H - (box.y + box.h - H / 2) * s;
  } else {
    placement.scale = Math.max(OUT_W / W, OUT_H / H);
    placement.x = OUT_W / 2;
    placement.y = OUT_H / 2;
  }
  fitScale.value = placement.scale;
  framedByHand = false;
  schedule();
}

function zoomAround(at: Point, scale: number) {
  const s = clamp(scale, fitScale.value * MIN_ZOOM, fitScale.value * MAX_ZOOM);
  const k = s / placement.scale;
  placement.x = at.x - (at.x - placement.x) * k;
  placement.y = at.y - (at.y - placement.y) * k;
  placement.scale = s;
  schedule();
}

function rotateAround(at: Point, degrees: number) {
  const r = clamp(degrees, -MAX_ROTATION, MAX_ROTATION);
  const d = ((r - placement.rotation) * Math.PI) / 180;
  const dx = placement.x - at.x;
  const dy = placement.y - at.y;
  placement.x = at.x + Math.cos(d) * dx - Math.sin(d) * dy;
  placement.y = at.y + Math.sin(d) * dx + Math.cos(d) * dy;
  placement.rotation = r;
  schedule();
}

function flip() {
  placement.x = OUT_W - placement.x;
  placement.flip = !placement.flip;
  placement.rotation = -placement.rotation;
  schedule();
}

const frameCenter = { x: OUT_W / 2, y: OUT_H / 2 };

function setZoom(value: number) {
  framedByHand = true;
  zoomAround(frameCenter, fitScale.value * value);
}

function setRotation(value: number) {
  framedByHand = true;
  rotateAround(frameCenter, Math.abs(value) < 1 ? 0 : value);
}

function applyPlacement(ctx: CanvasRenderingContext2D, p: Placement) {
  ctx.translate(p.x, p.y);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.scale(p.flip ? -p.scale : p.scale, p.scale);
  ctx.translate(-W / 2, -H / 2);
}

function toImage(p: Point): Point {
  const a = (-placement.rotation * Math.PI) / 180;
  const dx = p.x - placement.x;
  const dy = p.y - placement.y;
  const rx = dx * Math.cos(a) - dy * Math.sin(a);
  const ry = dx * Math.sin(a) + dy * Math.cos(a);
  return { x: (placement.flip ? -rx : rx) / placement.scale + W / 2, y: ry / placement.scale + H / 2 };
}

// ---- Dibujo del lienzo de trabajo.

// Solo la caja de la mancha: con muchas motas sueltas, un lienzo del tamaño de la foto por cada una agotaría la memoria.
function highlight(id: number, removing: boolean): Highlight {
  const key = `${id}:${removing}`;
  let hl = highlights.get(key);
  if (!hl) {
    const { maskWidth: w, maskHeight: h, labels } = props.cut;
    const box = props.cut.people[id]!.box;
    const sx = w / W;
    const sy = h / H;
    const x0 = Math.max(0, Math.floor(box.x * sx));
    const y0 = Math.max(0, Math.floor(box.y * sy));
    const x1 = Math.min(w, Math.ceil((box.x + box.w) * sx));
    const y1 = Math.min(h, Math.ceil((box.y + box.h) * sy));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, x1 - x0);
    canvas.height = Math.max(1, y1 - y0);
    const ctx = canvas.getContext('2d')!;
    const data = ctx.createImageData(canvas.width, canvas.height);
    // Verde para añadir: el azul se confundiría con el fondo de la ficha.
    const [r, g, b] = removing ? [239, 68, 68] : [34, 197, 94];
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        if (labels[y * w + x] !== id) continue;
        const i = ((y - y0) * canvas.width + (x - x0)) * 4;
        data.data[i] = r;
        data.data[i + 1] = g;
        data.data[i + 2] = b;
        data.data[i + 3] = 255;
      }
    }
    ctx.putImageData(data, 0, 0);
    hl = { canvas, x: x0 / sx, y: y0 / sy, w: canvas.width / sx, h: canvas.height / sy };
    remember(highlights, key, hl);
  }
  return hl;
}

function draw() {
  frame = 0;
  const canvas = stage.value;
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth;
  if (!cssWidth) return;
  const width = Math.round(cssWidth * dpr);
  const height = Math.round((width * STAGE_H) / STAGE_W);
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  if (figureDirty) refreshFigure();
  const k = width / STAGE_W;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b1220';
  ctx.fillRect(0, 0, width, height);
  ctx.setTransform(k, 0, 0, k, k * MARGIN, k * MARGIN);

  if (removeBackground.value) {
    const g = ctx.createLinearGradient(0, 0, OUT_W, OUT_H);
    g.addColorStop(0, '#16388a');
    g.addColorStop(1, '#0a1f4d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, OUT_W, OUT_H);
  }

  ctx.save();
  applyPlacement(ctx, placement);
  ctx.imageSmoothingQuality = 'high';
  if (removeBackground.value) {
    if (tool.value !== 'move') {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(props.cut.original, 0, 0);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(figure, 0, 0);
    if (tool.value === 'people' && hovered !== null) {
      const hl = highlight(hovered, state.value.kept.includes(hovered));
      ctx.globalAlpha = 0.45;
      ctx.drawImage(hl.canvas, hl.x, hl.y, hl.w, hl.h);
      ctx.globalAlpha = 1;
    }
  } else {
    ctx.drawImage(props.cut.original, 0, 0);
  }
  ctx.restore();

  // Lo que queda fuera de la foto, oscurecido; el marco, con una línea fina.
  ctx.fillStyle = 'rgba(2, 6, 23, 0.6)';
  ctx.beginPath();
  ctx.rect(-MARGIN, -MARGIN, STAGE_W, STAGE_H);
  ctx.rect(0, 0, OUT_W, OUT_H);
  ctx.fill('evenodd');
  const line = (1.5 * dpr) / k;
  ctx.lineWidth = line;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.strokeRect(0, 0, OUT_W, OUT_H);

  if (moving.value) {
    ctx.setLineDash([12, 10]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.beginPath();
    for (const f of [1 / 3, 2 / 3]) {
      ctx.moveTo(OUT_W * f, 0);
      ctx.lineTo(OUT_W * f, OUT_H);
      ctx.moveTo(0, OUT_H * f);
      ctx.lineTo(OUT_W, OUT_H * f);
    }
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const g = gesture;
  if (g?.kind === 'lasso' && g.path.length > 1) {
    const erasing = g.stroke.mode === 'erase';
    ctx.beginPath();
    ctx.moveTo(g.path[0]!.x, g.path[0]!.y);
    for (const q of g.path) ctx.lineTo(q.x, q.y);
    ctx.closePath();
    ctx.fillStyle = erasing ? 'rgba(239, 68, 68, 0.18)' : 'rgba(255, 255, 255, 0.16)';
    ctx.fill();
    ctx.lineWidth = line * 2.2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.stroke();
    ctx.lineWidth = line;
    ctx.setLineDash([6 * line, 4 * line]);
    ctx.strokeStyle = erasing ? 'rgba(254, 202, 202, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (cursor && brushTool.value && removeBackground.value && shape.value === 'brush') {
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, brush.value, 0, Math.PI * 2);
    ctx.lineWidth = line * 2.2;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.stroke();
    ctx.lineWidth = line;
    ctx.strokeStyle = tool.value === 'erase' ? 'rgba(254, 202, 202, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    ctx.stroke();
  }
}

// ---- Ratón, dedos y teclado.

function toOutput(e: { clientX: number; clientY: number }): Point {
  const r = stage.value!.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * STAGE_W - MARGIN, y: ((e.clientY - r.top) / r.height) * STAGE_H - MARGIN };
}

function polygonArea(path: Point[]) {
  let twice = 0;
  for (let i = 0; i < path.length; i++) {
    const a = path[i]!;
    const b = path[(i + 1) % path.length]!;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

function startPinch() {
  const [a, b] = [...pointers.entries()];
  if (!a || !b) return;
  if (gesture?.kind === 'stroke') rebuildMask();
  gesture = {
    kind: 'pinch',
    ids: [a[0], b[0]],
    dist: Math.max(1, Math.hypot(b[1].x - a[1].x, b[1].y - a[1].y)),
    angle: (Math.atan2(b[1].y - a[1].y, b[1].x - a[1].x) * 180) / Math.PI,
    mid: { x: (a[1].x + b[1].x) / 2, y: (a[1].y + b[1].y) / 2 },
    from: { ...placement },
  };
  moving.value = true;
}

function updatePinch(g: Extract<Gesture, { kind: 'pinch' }>) {
  const a = pointers.get(g.ids[0]);
  const b = pointers.get(g.ids[1]);
  if (!a || !b) return;
  const dist = Math.hypot(b.x - a.x, b.y - a.y);
  let turn = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI - g.angle;
  if (turn > 180) turn -= 360;
  if (turn < -180) turn += 360;
  let rotation = clamp(g.from.rotation + turn, -MAX_ROTATION, MAX_ROTATION);
  if (Math.abs(rotation) < 3) rotation = 0;
  framedByHand = true;
  Object.assign(placement, g.from);
  zoomAround(g.mid, g.from.scale * (dist / g.dist));
  rotateAround(g.mid, rotation);
  placement.x += (a.x + b.x) / 2 - g.mid.x;
  placement.y += (a.y + b.y) / 2 - g.mid.y;
}

function onPointerDown(e: PointerEvent) {
  const canvas = stage.value;
  if (!canvas) return;
  canvas.setPointerCapture(e.pointerId);
  canvas.focus({ preventScroll: true });
  const p = toOutput(e);
  pointers.set(e.pointerId, p);
  cursor = p;
  if (pointers.size === 2) {
    startPinch();
    return;
  }
  if (pointers.size > 2) return;
  const panButton = e.button === 1 || e.button === 2;
  if (tool.value === 'move' || panButton || !removeBackground.value) {
    gesture = { kind: 'pan', last: p };
    moving.value = true;
  } else if (brushTool.value) {
    const at = toImage(p);
    const mode = tool.value === 'erase' ? 'erase' : 'restore';
    if (shape.value === 'lasso') {
      gesture = { kind: 'lasso', stroke: { mode, shape: 'lasso', radius: 0, points: [at.x, at.y] }, path: [p] };
    } else {
      const stroke: Stroke = { mode, shape: 'brush', radius: brush.value / placement.scale, points: [at.x, at.y] };
      gesture = { kind: 'stroke', stroke };
      paintBrush(mask.getContext('2d')!, stroke, 0);
      figureDirty = true;
    }
  } else {
    gesture = { kind: 'tap', start: p, moved: false };
  }
  schedule();
}

function onPointerMove(e: PointerEvent) {
  const p = toOutput(e);
  cursor = p;
  if (!pointers.has(e.pointerId)) {
    if (tool.value === 'people' && removeBackground.value) {
      const at = toImage(p);
      hovered = personAt(props.cut, at.x, at.y);
    }
    schedule();
    return;
  }
  pointers.set(e.pointerId, p);
  const g = gesture;
  if (!g) return;
  if (g.kind === 'pan') {
    if (p.x !== g.last.x || p.y !== g.last.y) framedByHand = true;
    placement.x += p.x - g.last.x;
    placement.y += p.y - g.last.y;
    g.last = p;
  } else if (g.kind === 'pinch') {
    updatePinch(g);
  } else if (g.kind === 'stroke') {
    const at = toImage(p);
    const from = g.stroke.points.length;
    g.stroke.points.push(at.x, at.y);
    paintBrush(mask.getContext('2d')!, g.stroke, from);
    figureDirty = true;
  } else if (g.kind === 'lasso') {
    const last = g.path[g.path.length - 1]!;
    if (Math.hypot(p.x - last.x, p.y - last.y) >= 3) {
      g.path.push(p);
      const at = toImage(p);
      g.stroke.points.push(at.x, at.y);
    }
  } else if (Math.hypot(p.x - g.start.x, p.y - g.start.y) > 8) {
    g.moved = true;
  }
  schedule();
}

function endPointer(e: PointerEvent, cancelled: boolean) {
  if (!pointers.delete(e.pointerId)) return;
  const g = gesture;
  if (g?.kind === 'stroke') {
    if (cancelled) rebuildMask();
    else finishStroke(g.stroke);
  } else if (g?.kind === 'lasso') {
    if (!cancelled && polygonArea(g.path) >= MIN_LASSO_AREA) {
      paintLasso(mask.getContext('2d')!, g.stroke);
      finishStroke(g.stroke);
    }
  } else if (g?.kind === 'tap' && !g.moved && !cancelled) {
    const at = toImage(toOutput(e));
    const id = personAt(props.cut, at.x, at.y);
    if (id !== null) togglePerson(id);
  }
  if (g?.kind === 'pinch' && pointers.size === 1 && tool.value === 'move') {
    gesture = { kind: 'pan', last: [...pointers.values()][0]! };
  } else if (pointers.size === 0 || g?.kind !== 'pinch') {
    gesture = null;
    moving.value = false;
  }
  schedule();
}

function onPointerLeave() {
  if (pointers.size) return;
  cursor = null;
  hovered = null;
  schedule();
}

function onWheel(e: WheelEvent) {
  framedByHand = true;
  const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
  zoomAround(toOutput(e), placement.scale * factor);
}

function onKeydown(e: KeyboardEvent) {
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) redo();
    else undo();
    return;
  }
  if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    redo();
    return;
  }
  if (e.key === '[' || e.key === ']') {
    brush.value = clamp(brush.value + (e.key === ']' ? 4 : -4), 6, 90);
    schedule();
    return;
  }
  if (e.target !== stage.value) return;
  const step = e.shiftKey ? 25 : 5;
  const moves: Record<string, Point> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
  const move = moves[e.key];
  if (move) {
    e.preventDefault();
    framedByHand = true;
    placement.x += move.x;
    placement.y += move.y;
    schedule();
  } else if (e.key === '+' || e.key === '=') {
    e.preventDefault();
    framedByHand = true;
    zoomAround(frameCenter, placement.scale * 1.1);
  } else if (e.key === '-') {
    e.preventDefault();
    framedByHand = true;
    zoomAround(frameCenter, placement.scale / 1.1);
  }
}

function setTool(value: Tool) {
  tool.value = value;
  hovered = null;
  if (value !== 'move' && !removeBackground.value) setRemoveBackground(true);
  else schedule();
}

function setShape(value: Shape) {
  shape.value = value;
  schedule();
}

function setRemoveBackground(value: boolean) {
  removeBackground.value = value;
  if (!value) tool.value = 'move';
  if (!framedByHand) fit();
  else schedule();
}

async function exportBlob(): Promise<Blob> {
  if (figureDirty) refreshFigure();
  const out = document.createElement('canvas');
  out.width = OUT_W;
  out.height = OUT_H;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  applyPlacement(ctx, placement);
  ctx.drawImage(removeBackground.value ? figure : props.cut.original, 0, 0);
  const encode = (type: string, quality?: number) => new Promise<Blob | null>((resolve) => out.toBlob(resolve, type, quality));
  let blob = await encode('image/png');
  if (blob && blob.size > 2.8 * 1024 * 1024) blob = await encode('image/webp', 0.9);
  if (!blob) throw new Error('el navegador no ha podido generar la imagen');
  return blob;
}

defineExpose({ exportBlob });

onMounted(() => {
  rebuildMask();
  fit();
  if (stage.value) {
    resizer = new ResizeObserver(schedule);
    resizer.observe(stage.value);
  }
});

onBeforeUnmount(() => {
  resizer?.disconnect();
  if (frame) cancelAnimationFrame(frame);
  baseMasks.clear();
  highlights.clear();
});
</script>

<template>
  <div class="grid grid-cols-1 gap-5 md:grid-cols-[minmax(0,24rem)_1fr]" @keydown="onKeydown">
    <div class="min-w-0">
      <canvas
        ref="stage"
        tabindex="0"
        class="block w-full touch-none select-none rounded-xl border border-line shadow-card outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        :class="cursorClass"
        :style="{ aspectRatio: `${STAGE_W} / ${STAGE_H}` }"
        role="img"
        aria-label="Tu foto dentro del marco de la ficha: arrástrala para colocarla; con las flechas también se mueve"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="endPointer($event, false)"
        @pointercancel="endPointer($event, true)"
        @pointerleave="onPointerLeave"
        @wheel.prevent="onWheel"
        @contextmenu.prevent
      />
      <div class="mt-2 flex flex-wrap items-center justify-center gap-1">
        <button type="button" class="btn-ghost px-2.5" :disabled="!canUndo" title="Deshacer (Ctrl+Z)" aria-label="Deshacer" @click="undo">
          <Icon icon="arrow-rotate-left" class="h-4 w-4" />
        </button>
        <button type="button" class="btn-ghost px-2.5" :disabled="!canRedo" title="Rehacer (Ctrl+Y)" aria-label="Rehacer" @click="redo">
          <Icon icon="arrow-rotate-right" class="h-4 w-4" />
        </button>
        <button type="button" class="btn-ghost px-2.5" title="Darle la vuelta (espejo)" aria-label="Darle la vuelta" @click="flip">
          <Icon icon="left-right" class="h-4 w-4" />
        </button>
        <button type="button" class="btn-ghost px-2.5" title="Volver a encuadrar" aria-label="Volver a encuadrar" @click="fit">
          <Icon icon="crosshairs" class="h-4 w-4" />
        </button>
        <button type="button" class="btn-ghost px-2.5" :disabled="!cut.figureFound" title="Volver al recorte automático" aria-label="Volver al recorte automático" @click="autoCutout">
          <Icon icon="wand-magic-sparkles" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <div class="min-w-0 space-y-4">
      <div>
        <ChoiceToggle :model-value="tool" :options="tools" label="Herramienta" @update:model-value="setTool" />
      </div>
      <div v-if="brushTool && removeBackground">
        <ChoiceToggle :model-value="shape" :options="shapes" label="Forma del retoque" size="xs" @update:model-value="setShape" />
      </div>
      <p class="text-xs text-slate-500">{{ help }}</p>
      <p v-if="notice" class="rounded-lg bg-surface-2 px-3 py-2 text-xs text-slate-600">{{ notice }}</p>
      <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
        <input :checked="removeBackground" type="checkbox" class="h-4 w-4 cursor-pointer accent-brand-500" @change="setRemoveBackground(($event.target as HTMLInputElement).checked)" />
        Quitar el fondo
      </label>
      <div v-if="brushTool && removeBackground && shape === 'brush'">
        <label class="label" for="photo-brush">Pincel</label>
        <input id="photo-brush" v-model.number="brush" type="range" min="6" max="90" step="1" class="w-full cursor-pointer accent-brand-500" />
      </div>
      <div>
        <label class="label" for="photo-zoom">Tamaño · {{ Math.round(zoom * 100) }} %</label>
        <input
          id="photo-zoom"
          type="range"
          :min="MIN_ZOOM"
          :max="MAX_ZOOM"
          step="0.01"
          :value="zoom"
          class="w-full cursor-pointer accent-brand-500"
          @input="setZoom(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <div>
        <label class="label" for="photo-rotation">Giro · {{ Math.round(placement.rotation) }}°</label>
        <input
          id="photo-rotation"
          type="range"
          :min="-MAX_ROTATION"
          :max="MAX_ROTATION"
          step="0.5"
          :value="placement.rotation"
          class="w-full cursor-pointer accent-brand-500"
          @input="setRotation(Number(($event.target as HTMLInputElement).value))"
        />
      </div>
      <p class="text-xs text-slate-500">
        Encuádrate de cintura para arriba, con la cabeza cerca del borde de arriba, como en las fichas de los profesionales.
        <span class="hidden sm:inline">Ctrl+Z deshace y los corchetes [ ] cambian el tamaño del pincel.</span>
      </p>
    </div>
  </div>
</template>
