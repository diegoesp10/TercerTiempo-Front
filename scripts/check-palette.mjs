// Comprueba que el frontal no usa los colores de la paleta de Tailwind a pelo (text-red-600, bg-amber-400/20,
// var(--color-emerald-500)…). Lo que tiene significado va por su token de src/style.css (danger, warning, success, info,
// win, draw, loss, own, starter, gold, scrim); solo quedan en la paleta los grises de la interfaz (los slate del 50 al
// 900, que cambian con el tema) y los colores de categoría que se justifican abajo, uno a uno y archivo por archivo.
// Se ejecuta antes de cada build (npm run build) y suelto con npm run lint:colors. Sin dependencias: solo Node.
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Colores de categoría (no de estado) que se quedan en la paleta, con su motivo. Las clases van sin variante ni opacidad
// (dark:text-orange-300 y bg-orange-500/15 se apuntan como text-orange-300 y bg-orange-500). Una justificación que deja
// de usarse también hace fallar la comprobación, para que la lista no crezca sola.
const PERMITIDOS = {
  'src/components/trainings/exerciseTypes.ts': {
    motivo:
      'Tipos de ejercicio: un color por categoría, no por estado. El fondo va al 15-20 % y se mezcla con la superficie de cada tema; la letra es un tono del tema o lleva su variante dark:, y llega a 4,5:1 en los dos (24861cc).',
    clases: [
      'bg-orange-500', 'text-orange-800', 'text-orange-300',
      'bg-violet-500', 'text-violet-700', 'text-violet-300',
      'bg-red-500', 'text-red-700',
      'bg-amber-400', 'text-amber-700',
      'bg-sky-500', 'text-sky-700',
      'bg-emerald-500', 'text-emerald-700',
      'bg-cyan-500', 'text-cyan-800', 'text-cyan-300',
    ],
  },
  'src/components/trainings/trainingKinds.ts': {
    motivo: 'Tipos de entrenamiento en el calendario: pretemporada en ámbar y recuperación en verde son categorías, no avisos; tonos del tema.',
    clases: ['border-amber-400', 'bg-amber-400', 'text-amber-700', 'border-l-amber-400', 'border-emerald-400', 'bg-emerald-400', 'text-emerald-700', 'border-l-emerald-400'],
  },
  'src/components/matches/MatchPreview.vue': {
    motivo: 'Previa: el local en azul y el visitante en ámbar (pronóstico y enfrentamientos), y el rival recuadrado en ámbar. Son lados, no estados; tonos del tema.',
    clases: ['bg-sky-100', 'text-sky-800', 'bg-amber-100', 'text-amber-800', 'border-amber-400'],
  },
  'src/components/sheet/SheetComparison.vue': {
    motivo: 'Comparación de actas: la cabecera del acta interna en azul y la de la oficial en ámbar, para distinguir las dos fuentes; tonos del tema.',
    clases: ['text-sky-700', 'text-amber-700'],
  },
  'src/components/home/HomePredictorShowcase.vue': {
    motivo: 'Previsor del inicio: título en dorado, ascenso en verde y descenso en rojo, los mismos colores que cada métrica en los gráficos (charts/predictions.ts); tonos del tema.',
    clases: ['text-amber-700', 'text-emerald-700', 'text-red-700'],
  },
  'src/components/trainings/calendar-theme.css': {
    motivo: 'Calendario: la línea de la hora actual en rojo, como en cualquier agenda; no es un error. Tono del tema.',
    clases: ['--t-red-600'],
  },
};

const HUES = [
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple',
  'fuchsia', 'pink', 'rose', 'slate', 'gray', 'zinc', 'neutral', 'stone', 'mauve', 'olive', 'mist', 'taupe',
].join('|');
const UTILITY =
  'text|bg|border(?:-[xytrblse])?|outline|ring(?:-offset)?|inset-ring|shadow|inset-shadow|drop-shadow|text-shadow|divide|decoration|accent|caret|fill|stroke|placeholder|from|via|to';
// La clase entera, con o sin variante delante (hover:, dark:, group-hover:…) y con o sin opacidad detrás (/15).
const CLASS_RE = new RegExp(`(?<![\\w-])((?:${UTILITY})-(${HUES})-(\\d{2,3}))(?![\\w-])`, 'g');
// Las variables de la paleta en valores arbitrarios o en CSS: var(--color-emerald-500), var(--t-red-600).
const VAR_RE = new RegExp(`(?<![\\w-])(--(?:color|t)-(${HUES})-(\\d{2,3}))(?![\\w-])`, 'g');
// Los grises de la interfaz: cambian con el tema y son la escala de grises de todo el diseño.
const SLATE_THEMED = new Set(['50', '100', '200', '300', '400', '500', '600', '700', '800', '900']);
const EXTENSIONS = new Set(['.vue', '.ts', '.tsx', '.js', '.mjs', '.css', '.html']);
// Donde se definen los tokens: aquí las variables de la paleta son la propia definición.
const TOKEN_FILE = 'src/style.css';

const root = fileURLToPath(new URL('..', import.meta.url));
const toKey = (file) => relative(root, file).split(sep).join('/');

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.has(extname(entry.name))) yield full;
  }
}

const files = [...walk(join(root, 'src')), join(root, 'index.html')];
const problems = [];
const used = new Set();
for (const file of files) {
  const key = toKey(file);
  const allowed = new Set(PERMITIDOS[key]?.clases ?? []);
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    const matches = [...line.matchAll(CLASS_RE)];
    if (key !== TOKEN_FILE) matches.push(...line.matchAll(VAR_RE));
    for (const m of matches) {
      const [, name, hue, shade] = m;
      if (hue === 'slate' && SLATE_THEMED.has(shade)) continue;
      if (allowed.has(name)) {
        used.add(`${key}\u0000${name}`);
        continue;
      }
      problems.push(`  ${key}:${i + 1}:${m.index + 1}  ${name}`);
    }
  });
}

const stale = Object.entries(PERMITIDOS).flatMap(([key, { clases }]) =>
  clases.filter((name) => !used.has(`${key}\u0000${name}`)).map((name) => `  ${key}  ${name}`),
);

if (problems.length) {
  console.error(`Colores de la paleta de Tailwind sin token (${problems.length}):`);
  console.error(problems.join('\n'));
  console.error(
    '\nCámbialos por el token de lo que significan (danger, warning, success, info y sus -strong, -soft y -line; win, draw y loss;\n' +
      'own, starter, gold o scrim; ver src/style.css). Si es un color de categoría y no de estado, justifícalo en PERMITIDOS\n' +
      '(scripts/check-palette.mjs).',
  );
}
if (stale.length) {
  console.error(`${problems.length ? '\n' : ''}Justificaciones que ya no se usan (quítalas de PERMITIDOS en scripts/check-palette.mjs):`);
  console.error(stale.join('\n'));
}
if (problems.length || stale.length) process.exit(1);
console.log(`Colores: ningún tono de la paleta sin token ni justificar (${files.length} archivos).`);
