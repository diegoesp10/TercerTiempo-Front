import { computed, reactive } from 'vue';

// Pila de capas abiertas (modales y buscador). Todas van a <body> con Teleport, así que, con el mismo z-index, el orden
// en el DOM decidía cuál quedaba encima: el diálogo de confirmación, montado una sola vez en AppShell, salía por detrás
// del modal que lo abría. Ahora cada capa queda por encima de las que ya estaban abiertas, Escape solo cierra la de
// arriba y la página no recupera el scroll hasta que se cierra la última.
const BASE_LAYER = 50;

const stack = reactive<number[]>([]);
let lastId = 0;

function syncScroll() {
  document.body.style.overflow = stack.length ? 'hidden' : '';
}

export function openLayer(): number {
  const id = ++lastId;
  stack.push(id);
  syncScroll();
  return id;
}

export function closeLayer(id: number | null) {
  if (id === null) return;
  const index = stack.indexOf(id);
  if (index >= 0) stack.splice(index, 1);
  syncScroll();
}

export function isTopLayer(id: number | null): boolean {
  return id !== null && stack[stack.length - 1] === id;
}

export function layerZIndex(id: number | null): number {
  const index = id === null ? -1 : stack.indexOf(id);
  return BASE_LAYER + Math.max(0, index);
}

// Los desplegables que van a <body> (SearchSelect) tienen que quedar por encima de la capa más alta abierta.
export const popoverZIndex = computed(() => BASE_LAYER + 5 + stack.length);

// Con una capa abierta el fondo animado se para: no se ve y su desenfoque se recalcularía en cada fotograma.
export const anyLayerOpen = computed(() => stack.length > 0);
