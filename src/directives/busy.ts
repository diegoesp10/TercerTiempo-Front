import type { Directive } from 'vue';

// v-busy="estado": mientras el estado sea verdadero el botón queda deshabilitado y muestra un anillo girando delante
// del texto. Sustituye al patrón de cambiar el texto a «Guardando…» a mano en cada botón.
const SPINNER_CLASS = 'busy-spinner';

function apply(el: HTMLElement, busy: boolean, disabled?: unknown) {
  const button = el as HTMLButtonElement;
  if (busy) {
    if (!el.dataset.busyDisabled) {
      el.dataset.busyDisabled = button.disabled ? 'already' : 'byBusy';
    }
    button.disabled = true;
    el.setAttribute('aria-busy', 'true');
    el.classList.add('is-busy');
    if (!el.querySelector(`:scope > .${SPINNER_CLASS}`)) {
      const spinner = document.createElement('span');
      spinner.className = SPINNER_CLASS;
      spinner.setAttribute('aria-hidden', 'true');
      el.prepend(spinner);
    }
  } else {
    if (disabled !== undefined) button.disabled = disabled === '' || !!disabled;
    else if (el.dataset.busyDisabled === 'byBusy') button.disabled = false;
    delete el.dataset.busyDisabled;
    el.removeAttribute('aria-busy');
    el.classList.remove('is-busy');
    el.querySelector(`:scope > .${SPINNER_CLASS}`)?.remove();
  }
}

export const busy: Directive<HTMLElement, unknown> = {
  mounted: (el, binding, vnode) => apply(el, !!binding.value, vnode.props?.disabled),
  updated: (el, binding, vnode) => apply(el, !!binding.value, vnode.props?.disabled),
  unmounted: (el) => apply(el, false),
};
