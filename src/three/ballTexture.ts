import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * Textura equirrectangular de un balón clásico: cuero blanco con los doce pentágonos negros colocados en los vértices
 * de un icosaedro (la geometría real del balón de 32 paneles), más costuras suaves. Se genera en un canvas, así que no
 * hay que descargar ni licenciar ninguna imagen.
 */
export function createBallTexture(width = 2048): CanvasTexture {
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Cuero: blanco roto con un ligero degradado para que las luces tengan algo que modelar.
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#fbfcff');
  base.addColorStop(1, '#e6ebf5');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  // Costuras hexagonales sutiles: rejilla de hexágonos en gris muy claro.
  ctx.strokeStyle = 'rgba(120, 135, 170, 0.22)';
  ctx.lineWidth = Math.max(2, width / 700);
  const r = width / 24;
  const h = Math.sqrt(3) * r;
  for (let row = -1; row * (h / 2) < height + h; row++) {
    const offset = row % 2 === 0 ? 0 : 1.5 * r;
    for (let x = -3 * r + offset; x < width + 3 * r; x += 3 * r) {
      hexagon(ctx, x, row * (h / 2), r);
      ctx.stroke();
    }
  }

  // Pentágonos: vértices del icosaedro → latitud/longitud → posición en la textura.
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices: [number, number, number][] = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      vertices.push([0, a, b * phi], [a, b * phi, 0], [a * phi, 0, b]);
    }
  }

  ctx.fillStyle = '#111827';
  for (const [x, y, z] of vertices) {
    const length = Math.hypot(x, y, z);
    const lat = Math.asin(y / length);
    const lon = Math.atan2(z / length, x / length);
    const cx = (lon / (2 * Math.PI) + 0.5) * width;
    const cy = (0.5 - lat / Math.PI) * height;
    const radius = height * 0.105;
    const stretch = Math.min(2.4, 1 / Math.max(0.35, Math.cos(lat)));

    // El pentágono se repite a ambos lados del borde para que no se corte en la costura de la textura.
    for (const shift of [-width, 0, width]) {
      ctx.save();
      ctx.translate(cx + shift, cy);
      ctx.scale(stretch, 1);
      polygon(ctx, 0, 0, radius, 5, -Math.PI / 2);
      ctx.fill();
      ctx.restore();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function polygon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, sides: number, rotation: number) {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i * 2 * Math.PI) / sides;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function hexagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  polygon(ctx, cx, cy, radius, 6, 0);
}
