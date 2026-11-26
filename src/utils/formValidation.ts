// Los formularios siguen usando la validación del navegador (required, type="email", min, max, minlength…) para no
// enviar nada a medias, pero sin sus globos, que salen en el idioma y con el estilo del navegador: el aviso va debajo
// del campo, en español y como el resto de errores de la app (.field-error), el primer campo con aviso recibe el foco y
// cada campo queda marcado (aria-invalid) hasta que se corrige. Los formularios con novalidate validan por su cuenta y
// no pasan por aquí.

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const notes = new WeakMap<Field, HTMLElement>();
let focused = false;
let counter = 0;

const isField = (target: EventTarget | null): target is Field =>
  target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;

function limit(value: string, type: string) {
  const [year, month, day] = value.split('-');
  return type === 'date' && day ? `${day}-${month}-${year}` : value;
}

function messageFor(field: Field): string {
  const v = field.validity;
  const input = field instanceof HTMLInputElement ? field : null;
  if (v.valueMissing) {
    if (input?.type === 'checkbox') return 'Marca esta casilla para seguir.';
    if (input?.type === 'radio') return 'Elige una opción.';
    if (input?.type === 'file') return 'Elige un archivo.';
    return field instanceof HTMLSelectElement ? 'Elige una opción.' : 'Rellena este campo.';
  }
  if (v.typeMismatch) {
    if (input?.type === 'email') return 'Escribe un correo válido, como nombre@dominio.es.';
    if (input?.type === 'url') return 'Escribe una dirección web completa (https://…).';
    return 'Revisa el formato.';
  }
  if (v.badInput) return input?.type === 'number' ? 'Escribe un número.' : 'Revisa este campo.';
  if (v.tooShort) return `Escribe al menos ${(field as HTMLInputElement | HTMLTextAreaElement).minLength} caracteres.`;
  if (v.tooLong) return `Como mucho, ${(field as HTMLInputElement | HTMLTextAreaElement).maxLength} caracteres.`;
  if (v.rangeUnderflow && input) return `Como mínimo, ${limit(input.min, input.type)}.`;
  if (v.rangeOverflow && input) return `Como máximo, ${limit(input.max, input.type)}.`;
  if (v.stepMismatch) return 'Ese valor no vale aquí: revisa los decimales.';
  if (v.patternMismatch) return field.title || 'Revisa el formato.';
  return field.validationMessage || 'Revisa este campo.';
}

// Debajo del campo; las casillas, debajo de su etiqueta (dentro irían en la misma fila), y un campo con un icono o un
// botón encima (colocados respecto a un contenedor pequeño), debajo de ese contenedor, para no moverlos.
function anchorOf(field: Field): Element {
  if (field instanceof HTMLInputElement && (field.type === 'checkbox' || field.type === 'radio')) return field.closest('label') ?? field;
  const parent = field.parentElement;
  if (parent && parent.tagName !== 'FORM' && parent.children.length <= 3 && getComputedStyle(parent).position === 'relative') return parent;
  return field;
}

function show(field: Field) {
  let note = notes.get(field);
  if (!note?.isConnected) {
    note = document.createElement('p');
    note.className = 'field-error';
    note.id = `aviso-campo-${++counter}`;
    anchorOf(field).insertAdjacentElement('afterend', note);
    notes.set(field, note);
    field.setAttribute('aria-describedby', [field.getAttribute('aria-describedby'), note.id].filter(Boolean).join(' '));
  }
  note.textContent = messageFor(field);
  field.setAttribute('aria-invalid', 'true');
}

function clear(field: Field) {
  const note = notes.get(field);
  if (!note) return;
  notes.delete(field);
  note.remove();
  field.removeAttribute('aria-invalid');
  const rest = (field.getAttribute('aria-describedby') ?? '').split(' ').filter((id) => id && id !== note.id);
  if (rest.length) field.setAttribute('aria-describedby', rest.join(' '));
  else field.removeAttribute('aria-describedby');
}

function onInvalid(event: Event) {
  if (!isField(event.target)) return;
  event.preventDefault();
  const field = event.target;
  show(field);
  // Todos los avisos de un envío llegan seguidos: el foco va al primero.
  if (focused) return;
  focused = true;
  setTimeout(() => (focused = false));
  field.focus({ preventScroll: true });
  field.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// Mientras se corrige: el aviso cambia con lo que falta y se va cuando el campo ya vale.
function onEdit(event: Event) {
  if (!isField(event.target) || !notes.has(event.target)) return;
  if (event.target.validity.valid) clear(event.target);
  else show(event.target);
}

export function installFormValidation() {
  document.addEventListener('invalid', onInvalid, true);
  document.addEventListener('input', onEdit, true);
  document.addEventListener('change', onEdit, true);
}
