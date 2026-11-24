// Recorte de la figura de una persona en el navegador con MediaPipe (segmentación «selfie», Apache-2.0). El modelo y el
// motor WASM se sirven desde nuestra propia web (public/models y public/vendor/mediapipe) y solo se descargan cuando
// alguien abre el asistente de foto. Además del recorte, separa las manchas de la máscara que no se tocan (cada persona,
// o un trozo suelto) para que el usuario elija con cuáles se queda; el retoque a mano lo hace el editor (`PhotoEditor.vue`).

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Una mancha de la máscara: una persona o un trozo suelto (una mano separada del cuerpo, un reflejo). */
export interface Person {
  id: number;
  /** Píxeles de la máscara (a su resolución). */
  area: number;
  /** Caja en píxeles de la foto. */
  box: Box;
}

export interface CutOut {
  /** Foto original reducida (máx. 1400 px de lado). */
  original: HTMLCanvasElement;
  /** Máscara automática al tamaño de la foto: blanco con la transparencia de lo que se queda (borde suave). */
  mask: HTMLCanvasElement;
  /** Mancha de cada píxel de la máscara (-1: fondo). */
  labels: Int32Array;
  maskWidth: number;
  maskHeight: number;
  people: Person[];
  /** La persona principal (la mancha más grande), o null si no hay ninguna. */
  main: number | null;
  /** false si el modelo apenas ha encontrado una persona. */
  figureFound: boolean;
}

const MAX_SIDE = 1400;
// Por debajo de esta parte de la persona principal, una mancha es un trozo suelto y no otra persona.
const FRAGMENT = 0.15;

type Segmenter = import('@mediapipe/tasks-vision').ImageSegmenter;
let segmenter: Promise<Segmenter> | null = null;

function getSegmenter(): Promise<Segmenter> {
  segmenter ??= (async () => {
    const { FilesetResolver, ImageSegmenter } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks('/vendor/mediapipe');
    const create = (delegate: 'GPU' | 'CPU') =>
      ImageSegmenter.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: '/models/selfie_segmenter.tflite', delegate },
        runningMode: 'IMAGE',
        outputConfidenceMasks: true,
        outputCategoryMask: false,
      });
    try {
      return await create('GPU');
    } catch {
      return await create('CPU');
    }
  })();
  segmenter.catch(() => { segmenter = null; });
  return segmenter;
}

async function loadImage(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas;
}

// Manchas de 4 vecinos por encima del umbral, con su área y su caja (a la resolución de la máscara, que el modelo da al
// tamaño de la foto: hasta 1400 × 1400 píxeles, de ahí que se recorra sin crear nada por píxel).
function findPeople(confidence: Float32Array, w: number, h: number) {
  const labels = new Int32Array(w * h).fill(-1);
  const stack = new Int32Array(w * h);
  const found: { area: number; minX: number; minY: number; maxX: number; maxY: number }[] = [];
  const on = (i: number) => labels[i] === -1 && confidence[i]! >= 0.5;
  for (let start = 0; start < w * h; start++) {
    if (!on(start)) continue;
    const id = found.length;
    const blob = { area: 0, minX: w, minY: h, maxX: -1, maxY: -1 };
    let top = 0;
    stack[top++] = start;
    labels[start] = id;
    while (top > 0) {
      const p = stack[--top]!;
      const x = p % w;
      const y = (p - x) / w;
      blob.area++;
      if (x < blob.minX) blob.minX = x;
      if (x > blob.maxX) blob.maxX = x;
      if (y < blob.minY) blob.minY = y;
      if (y > blob.maxY) blob.maxY = y;
      if (x > 0 && on(p - 1)) { labels[p - 1] = id; stack[top++] = p - 1; }
      if (x < w - 1 && on(p + 1)) { labels[p + 1] = id; stack[top++] = p + 1; }
      if (y > 0 && on(p - w)) { labels[p - w] = id; stack[top++] = p - w; }
      if (y < h - 1 && on(p + w)) { labels[p + w] = id; stack[top++] = p + w; }
    }
    found.push(blob);
  }
  return { labels, found };
}

export async function cutOutFigure(file: File): Promise<CutOut> {
  const original = await loadImage(file);
  const seg = await getSegmenter();
  const result = seg.segment(original);
  const confidenceMask = result.confidenceMasks?.[0];
  if (!confidenceMask) throw new Error('el modelo no ha devuelto máscara');

  const mw = confidenceMask.width;
  const mh = confidenceMask.height;
  const confidence = confidenceMask.getAsFloat32Array().slice();
  result.close();

  // Máscara suavizada: borde progresivo entre 0,35 y 0,75 de confianza para que el pelo y los hombros no queden dentados.
  const small = document.createElement('canvas');
  small.width = mw;
  small.height = mh;
  const smallCtx = small.getContext('2d')!;
  const data = smallCtx.createImageData(mw, mh);
  for (let i = 0; i < confidence.length; i++) {
    const a = Math.min(1, Math.max(0, ((confidence[i] ?? 0) - 0.35) / 0.4));
    data.data[i * 4] = 255;
    data.data[i * 4 + 1] = 255;
    data.data[i * 4 + 2] = 255;
    data.data[i * 4 + 3] = Math.round(a * 255);
  }
  smallCtx.putImageData(data, 0, 0);

  const mask = document.createElement('canvas');
  mask.width = original.width;
  mask.height = original.height;
  const maskCtx = mask.getContext('2d')!;
  maskCtx.imageSmoothingQuality = 'high';
  maskCtx.filter = 'blur(1px)';
  maskCtx.drawImage(small, 0, 0, mask.width, mask.height);
  maskCtx.filter = 'none';

  const { labels, found } = findPeople(confidence, mw, mh);
  const sx = original.width / mw;
  const sy = original.height / mh;
  const people: Person[] = found.map((b, id) => ({
    id,
    area: b.area,
    box: { x: b.minX * sx, y: b.minY * sy, w: (b.maxX + 1 - b.minX) * sx, h: (b.maxY + 1 - b.minY) * sy },
  }));
  const covered = found.reduce((sum, b) => sum + b.area, 0);
  const main = people.length ? people.reduce((best, p) => (p.area > best.area ? p : best)).id : null;
  return { original, mask, labels, maskWidth: mw, maskHeight: mh, people, main, figureFound: covered > mw * mh * 0.03 };
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Las manchas que son personas (no trozos sueltos de la principal). */
export function wholePeople(cut: CutOut): Person[] {
  const main = cut.main === null ? null : cut.people[cut.main]!;
  if (!main) return [];
  return cut.people.filter((p) => p.id === main.id || p.area >= main.area * FRAGMENT);
}

/** Con qué se empieza: la persona principal y los trozos sueltos que caen junto a ella (una mano que quedó separada del
 * cuerpo); ni el resto de la gente ni las motas sueltas del fondo, que el usuario puede añadir con «Personas». */
export function initialKept(cut: CutOut): Set<number> {
  return cut.main === null ? new Set() : withFragments(cut, new Set([cut.main]));
}

/** Las personas elegidas más los trozos sueltos que caen junto a alguna de ellas. */
export function withFragments(cut: CutOut, chosen: Set<number>): Set<number> {
  const whole = new Set(wholePeople(cut).map((p) => p.id));
  const kept = new Set(chosen);
  for (const p of cut.people) {
    if (whole.has(p.id) || kept.has(p.id)) continue;
    const near = [...chosen].some((id) => {
      const c = cut.people[id]!.box;
      const padX = c.w * 0.1;
      const padY = c.h * 0.1;
      return overlaps(p.box, { x: c.x - padX, y: c.y - padY, w: c.w + 2 * padX, h: c.h + 2 * padY });
    });
    if (near) kept.add(p.id);
  }
  return kept;
}

/** La mancha (persona o trozo suelto) que hay en ese punto de la foto o justo al lado, o null. */
export function personAt(cut: CutOut, x: number, y: number): number | null {
  const mx = Math.floor((x / cut.original.width) * cut.maskWidth);
  const my = Math.floor((y / cut.original.height) * cut.maskHeight);
  if (mx < 0 || my < 0 || mx >= cut.maskWidth || my >= cut.maskHeight) return null;
  // Un toque justo en el borde también vale: se mira alrededor, cada vez más lejos (hasta un 1 % de la foto).
  const reach = Math.max(3, Math.round(Math.max(cut.maskWidth, cut.maskHeight) * 0.01));
  for (let r = 0; r <= reach; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const px = mx + dx;
        const py = my + dy;
        if (px < 0 || py < 0 || px >= cut.maskWidth || py >= cut.maskHeight) continue;
        const id = cut.labels[py * cut.maskWidth + px]!;
        if (id >= 0) return id;
      }
    }
  }
  return null;
}

// Dilatación cuadrada de radio r de una máscara binaria, con sumas acumuladas por filas y luego por columnas.
function dilate(on: Uint8Array, w: number, h: number, r: number): Uint8Array {
  const rows = new Uint8Array(w * h);
  const rowSum = new Int32Array(w + 1);
  for (let y = 0; y < h; y++) {
    const o = y * w;
    for (let x = 0; x < w; x++) rowSum[x + 1] = rowSum[x]! + on[o + x]!;
    for (let x = 0; x < w; x++) rows[o + x] = rowSum[Math.min(w, x + r + 1)]! > rowSum[Math.max(0, x - r)]! ? 1 : 0;
  }
  const out = new Uint8Array(w * h);
  const colSum = new Int32Array(h + 1);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) colSum[y + 1] = colSum[y]! + rows[y * w + x]!;
    for (let y = 0; y < h; y++) out[y * w + x] = colSum[Math.min(h, y + r + 1)]! > colSum[Math.max(0, y - r)]! ? 1 : 0;
  }
  return out;
}

/** Máscara de partida al tamaño de la foto: la automática, solo en las manchas elegidas, con un margen alrededor para no
 * comerse el borde suave (las manchas se cortan en 0,5 de confianza y el borde empieza en 0,35). */
export function keptMask(cut: CutOut, kept: Set<number>): HTMLCanvasElement {
  const { maskWidth: w, maskHeight: h } = cut;
  const on = new Uint8Array(w * h);
  for (let i = 0; i < on.length; i++) on[i] = kept.has(cut.labels[i]!) ? 1 : 0;
  const grown = dilate(on, w, h, Math.max(2, Math.round(Math.max(w, h) / 128)));
  const small = document.createElement('canvas');
  small.width = w;
  small.height = h;
  const smallCtx = small.getContext('2d')!;
  const data = smallCtx.createImageData(w, h);
  for (let i = 0; i < grown.length; i++) data.data[i * 4 + 3] = grown[i] ? 255 : 0;
  smallCtx.putImageData(data, 0, 0);

  const out = document.createElement('canvas');
  out.width = cut.mask.width;
  out.height = cut.mask.height;
  const ctx = out.getContext('2d')!;
  ctx.drawImage(cut.mask, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(small, 0, 0, out.width, out.height);
  ctx.globalCompositeOperation = 'source-over';
  return out;
}

/** Caja de lo que queda en una máscara ya retocada (con un pequeño margen a los lados y arriba), o null si no queda nada.
 * Se mide sobre una copia reducida: sobra para encuadrar y las motas sueltas se pierden al reducir. */
export function figureBox(mask: HTMLCanvasElement): Box | null {
  const k = Math.min(1, 240 / Math.max(mask.width, mask.height));
  const w = Math.max(1, Math.round(mask.width * k));
  const h = Math.max(1, Math.round(mask.height * k));
  const probe = document.createElement('canvas');
  probe.width = w;
  probe.height = h;
  const ctx = probe.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(mask, 0, 0, w, h);
  const alpha = ctx.getImageData(0, 0, w, h).data;
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[(y * w + x) * 4 + 3]! <= 127) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
  if (x1 < 0) return null;
  const sx = mask.width / w;
  const sy = mask.height / h;
  const pad = 0.03;
  const x = Math.max(0, x0 * sx - pad * mask.width);
  const y = Math.max(0, y0 * sy - pad * mask.height);
  return { x, y, w: Math.min(mask.width, (x1 + 1) * sx + pad * mask.width) - x, h: Math.min(mask.height, (y1 + 1) * sy) - y };
}
