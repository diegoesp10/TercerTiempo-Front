import { CanvasTexture, SRGBColorSpace } from 'three';

type Vec3 = [number, number, number];

/**
 * Textura equirrectangular de un balón de paneles de estrella, al estilo de los balones de final de competición:
 * cuero blanco nacarado con doce estrellas azules ribeteadas en oro, colocadas en los vértices de un icosaedro
 * (la misma simetría que los pentágonos del balón clásico), cuyas puntas apuntan a las estrellas vecinas.
 *
 * Cada estrella se dibuja en el plano tangente de su vértice y se proyecta punto a punto a latitud/longitud, así
 * que no se deforma cerca de los polos. Se genera en un canvas: no hay que descargar ni licenciar ninguna imagen.
 */
export function createBallTexture(width = 2048): CanvasTexture {
  const height = width / 2;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Cuero: blanco nacarado con un ligero degradado para que las luces tengan algo que modelar.
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#ffffff');
  base.addColorStop(0.5, '#f4f7fc');
  base.addColorStop(1, '#e3e9f4');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const vertices = icosahedronVertices();
  const tip = 0.5; // radio angular de las puntas (rad): las puntas de estrellas vecinas casi se tocan
  const waist = 0.2; // radio angular de los entrantes

  for (const vertex of vertices) {
    const [e1, e2] = tangentFrame(vertex);
    const neighbours = vertices
      .filter((other) => other !== vertex)
      .map((other) => ({ other, dot: dot(vertex, other) }))
      .sort((a, b) => b.dot - a.dot)
      .slice(0, 5)
      .map(({ other }) => Math.atan2(dot(other, e2), dot(other, e1)))
      .sort((a, b) => a - b);

    // Contorno de la estrella en el plano tangente: puntas hacia las vecinas, entrantes a mitad de camino,
    // con los lados ligeramente cóncavos; cada lado se muestrea para proyectarlo sin deformación.
    const outline: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const a0 = neighbours[i]!;
      const a1 = neighbours[(i + 1) % 5]! + (i === 4 ? 2 * Math.PI : 0);
      const mid = (a0 + a1) / 2;
      outline.push(...edge(a0, tip, mid, waist, 10));
      outline.push(...edge(mid, waist, a1, tip, 10));
    }
    const points = outline.map(([angle, rho]) => project(vertex, e1, e2, rho, angle));
    const star = toTexture(points, vertex, width, height);

    // La estrella se repite a ambos lados del borde para que no se corte en la costura de la textura.
    for (const shift of [-width, 0, width]) {
      ctx.save();
      ctx.translate(shift, 0);

      const centre = toTexture([vertex], vertex, width, height)[0]!;
      const fill = ctx.createLinearGradient(centre[0] - width * 0.07, centre[1] - height * 0.14, centre[0] + width * 0.07, centre[1] + height * 0.14);
      fill.addColorStop(0, '#2b6cf0');
      fill.addColorStop(0.55, '#1548c4');
      fill.addColorStop(1, '#0b2a7a');

      path(ctx, star);
      ctx.fillStyle = fill;
      ctx.fill();

      // Ribete dorado y pespunte interior en blanco.
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#d4a53a';
      ctx.lineWidth = Math.max(3, width / 170);
      ctx.stroke();

      const stitched = toTexture(outline.map(([angle, rho]) => project(vertex, e1, e2, rho * 0.86, angle)), vertex, width, height);
      path(ctx, stitched);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = Math.max(1.5, width / 700);
      ctx.setLineDash([width / 260, width / 400]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.restore();
    }
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Los doce vértices del icosaedro, normalizados. */
function icosahedronVertices(): Vec3[] {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices: Vec3[] = [];
  for (const a of [-1, 1]) {
    for (const b of [-1, 1]) {
      vertices.push([0, a, b * phi], [a, b * phi, 0], [a * phi, 0, b]);
    }
  }
  return vertices.map(normalize);
}

/** Dos vectores tangentes ortonormales en el vértice. */
function tangentFrame(vertex: Vec3): [Vec3, Vec3] {
  const helper: Vec3 = Math.abs(vertex[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const e1 = normalize(cross(vertex, helper));
  const e2 = cross(vertex, e1);
  return [e1, e2];
}

/** Punto de la esfera a distancia angular `rho` del vértice, en la dirección `angle` del plano tangente. */
function project(vertex: Vec3, e1: Vec3, e2: Vec3, rho: number, angle: number): Vec3 {
  const t = Math.sin(rho);
  const c = Math.cos(rho);
  const dx = Math.cos(angle) * t;
  const dy = Math.sin(angle) * t;
  return [
    vertex[0] * c + e1[0] * dx + e2[0] * dy,
    vertex[1] * c + e1[1] * dx + e2[1] * dy,
    vertex[2] * c + e1[2] * dx + e2[2] * dy,
  ];
}

/** Lado de la estrella entre dos radios, muestreado y ligeramente cóncavo (hundido hacia el centro). */
function edge(a0: number, r0: number, a1: number, r1: number, samples: number): [number, number][] {
  const result: [number, number][] = [];
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const x = r0 * Math.cos(a0) * (1 - t) + r1 * Math.cos(a1) * t;
    const y = r0 * Math.sin(a0) * (1 - t) + r1 * Math.sin(a1) * t;
    const sag = 1 - 0.14 * Math.sin(Math.PI * t);
    result.push([Math.atan2(y, x), Math.hypot(x, y) * sag]);
  }
  return result;
}

/** Puntos de la esfera → píxeles de la textura, con la longitud desenrollada alrededor del centro de la estrella. */
function toTexture(points: Vec3[], centre: Vec3, width: number, height: number): [number, number][] {
  const centreLon = Math.atan2(centre[2], centre[0]);
  return points.map(([x, y, z]) => {
    let lon = Math.atan2(z, x);
    if (lon - centreLon > Math.PI) lon -= 2 * Math.PI;
    if (centreLon - lon > Math.PI) lon += 2 * Math.PI;
    const lat = Math.asin(Math.max(-1, Math.min(1, y)));
    return [(lon / (2 * Math.PI) + 0.5) * width, (0.5 - lat / Math.PI) * height];
  });
}

function path(ctx: CanvasRenderingContext2D, points: [number, number][]) {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function normalize([x, y, z]: Vec3): Vec3 {
  const length = Math.hypot(x, y, z);
  return [x / length, y / length, z / length];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
