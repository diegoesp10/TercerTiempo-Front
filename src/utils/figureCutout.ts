// Recorte de la figura de una persona en el navegador con MediaPipe (segmentación «selfie», Apache-2.0). El modelo y el
// motor WASM se sirven desde nuestra propia web (public/models y public/vendor/mediapipe) y solo se descargan cuando
// alguien abre el asistente de foto.

export interface CutOut {
  /** Foto original reducida (máx. 1400 px de lado). */
  original: HTMLCanvasElement;
  /** La misma foto con el fondo transparente. */
  figure: HTMLCanvasElement;
  /** Caja que ocupa la figura dentro de la foto. */
  box: { x: number; y: number; w: number; h: number };
  /** false si el modelo apenas ha encontrado una persona. */
  figureFound: boolean;
}

const MAX_SIDE = 1400;

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

export async function cutOutFigure(file: File): Promise<CutOut> {
  const original = await loadImage(file);
  const seg = await getSegmenter();
  const result = seg.segment(original);
  const mask = result.confidenceMasks?.[0];
  if (!mask) throw new Error('el modelo no ha devuelto máscara');

  const mw = mask.width;
  const mh = mask.height;
  const confidence = mask.getAsFloat32Array();

  // Máscara suavizada: borde progresivo entre 0,35 y 0,75 de confianza para que el pelo y los hombros no queden dentados.
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mw;
  maskCanvas.height = mh;
  const maskCtx = maskCanvas.getContext('2d')!;
  const data = maskCtx.createImageData(mw, mh);
  let minX = mw, minY = mh, maxX = -1, maxY = -1, covered = 0;
  for (let i = 0; i < confidence.length; i++) {
    const c = confidence[i] ?? 0;
    const a = Math.min(1, Math.max(0, (c - 0.35) / 0.4));
    data.data[i * 4] = 255;
    data.data[i * 4 + 1] = 255;
    data.data[i * 4 + 2] = 255;
    data.data[i * 4 + 3] = Math.round(a * 255);
    if (a > 0.5) {
      covered++;
      const x = i % mw;
      const y = (i / mw) | 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  maskCtx.putImageData(data, 0, 0);
  result.close();

  const figure = document.createElement('canvas');
  figure.width = original.width;
  figure.height = original.height;
  const ctx = figure.getContext('2d')!;
  ctx.drawImage(original, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.imageSmoothingQuality = 'high';
  ctx.filter = 'blur(1px)';
  ctx.drawImage(maskCanvas, 0, 0, figure.width, figure.height);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'source-over';

  const figureFound = covered > mw * mh * 0.03 && maxX > minX && maxY > minY;
  const sx = original.width / mw;
  const sy = original.height / mh;
  const pad = 0.03;
  const box = figureFound
    ? {
        x: Math.max(0, Math.floor((minX / mw - pad) * original.width)),
        y: Math.max(0, Math.floor((minY / mh - pad) * original.height)),
        w: 0,
        h: 0,
      }
    : { x: 0, y: 0, w: original.width, h: original.height };
  if (figureFound) {
    box.w = Math.min(original.width - box.x, Math.ceil((maxX + 1) * sx + pad * original.width) - box.x);
    box.h = Math.min(original.height - box.y, Math.ceil((maxY + 1) * sy) - box.y);
  }

  return { original, figure, box, figureFound };
}
