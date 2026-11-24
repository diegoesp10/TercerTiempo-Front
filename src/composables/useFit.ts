import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

// Formas de presentar un menú, de la más completa a la más recogida: cada paso es un juego de marcas data-* que se pone
// al elemento, y su CSS (group-data-[…]) decide qué se ve en cada una. Se prueban en orden midiendo de verdad, al
// momento y antes de que se pinte nada, y se queda la primera con la que nada se sale: así un menú nunca queda cortado
// ni con puntos suspensivos, sea cual sea el ancho, el zoom, la letra o el número de enlaces. La última es el recurso
// final (la hamburguesa) y no se mide.
export function useFit(target: Ref<HTMLElement | null>, steps: readonly (readonly string[])[]) {
  const step = ref(0);
  const flags = [...new Set(steps.flat())];
  const widths = new WeakMap<Element, number>();
  let resizer: ResizeObserver | null = null;
  let watcher: MutationObserver | null = null;

  function apply(el: HTMLElement, index: number) {
    const on = steps[index] ?? [];
    for (const flag of flags) el.toggleAttribute(`data-${flag}`, on.includes(flag));
  }

  function fit() {
    const el = target.value;
    if (!el?.isConnected || steps.length === 0) return;
    // Al medir, lo que está oculto en la forma actual se ve un instante (sin llegar a pintarse): si tenía el foco, se le
    // devuelve, para que el teclado no lo pierda.
    const focused = document.activeElement instanceof HTMLElement && el.contains(document.activeElement) ? document.activeElement : null;
    let index = 0;
    apply(el, index);
    while (index < steps.length - 1 && overflows(el)) apply(el, ++index);
    if (step.value !== index) step.value = index;
    if (focused && document.activeElement !== focused && focused.isConnected) focused.focus({ preventScroll: true });
  }

  // El sitio disponible lo dice el ancho del propio elemento y el de su contenedor (un menú que se ajusta a su contenido
  // no crece solo cuando se le hace sitio). La altura cambia al plegarse y no dice nada del sitio, así que no cuenta.
  function onResize(entries: ResizeObserverEntry[]) {
    let changed = false;
    for (const entry of entries) {
      const width = Math.round(entry.contentRect.width);
      if (widths.get(entry.target) !== width) {
        widths.set(entry.target, width);
        changed = true;
      }
    }
    if (changed) fit();
  }

  // Cambios del contenido (un enlace más, un texto más largo, un contador): se vuelve a medir. Lo que va dentro de
  // [data-fit-ignore] (paneles desplegables que no ocupan sitio en la fila) no cuenta.
  function onMutation(records: MutationRecord[]) {
    const relevant = records.some((record) => {
      const node = record.target instanceof Element ? record.target : record.target.parentElement;
      return !node?.closest('[data-fit-ignore]');
    });
    if (relevant) fit();
  }

  onMounted(() => {
    const el = target.value;
    if (!el) return;
    fit();
    resizer = new ResizeObserver(onResize);
    resizer.observe(el);
    if (el.parentElement) resizer.observe(el.parentElement);
    watcher = new MutationObserver(onMutation);
    watcher.observe(el, { childList: true, subtree: true, characterData: true });
    // La letra de la marca llega después del primer pintado y cambia los anchos.
    void document.fonts?.ready.then(() => fit());
    document.fonts?.addEventListener('loadingdone', fit);
  });

  onBeforeUnmount(() => {
    resizer?.disconnect();
    watcher?.disconnect();
    document.fonts?.removeEventListener('loadingdone', fit);
  });

  return { step, fit };
}

// Se sale si el contenido es más ancho que el elemento o si algún hijo pisa su relleno: en ese caso ya no hay aire
// alrededor y el menú se lee apretado aunque técnicamente quepa.
function overflows(el: HTMLElement): boolean {
  if (el.scrollWidth - el.clientWidth > 1) return true;
  const box = el.getBoundingClientRect();
  if (box.width === 0) return false;
  const style = getComputedStyle(el);
  const left = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
  const right = box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
  for (const child of el.children) {
    const rect = child.getBoundingClientRect();
    if (rect.width > 0 && (rect.left < left - 1 || rect.right > right + 1)) return true;
  }
  return false;
}
