<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import { trackSearch } from '@/utils/analytics';

/** Opción del desplegable: valor, texto, texto secundario y grupo (cabecera) opcionales. */
export interface SelectOption {
  value: string | number;
  label: string;
  hint?: string;
  group?: string;
  disabled?: boolean;
  /** Equipos: escudo junto al nombre (URL o, si no hay, la ruta de la API por id). */
  crest?: string | null;
  /** Jugadores: foto junto al nombre (o sus iniciales). */
  photo?: string | null;
}

/**
 * Desplegable único de la aplicación: botón con el valor elegido, panel con buscador por nombre, grupos, teclado
 * (flechas, Enter, Escape) y cierre al pulsar fuera. Sustituye a los <select> nativos para que todos se vean igual.
 * El panel flota sobre la página (va en el body) para que ninguna tarjeta, tabla o modal con overflow lo corte, y se
 * abre hacia arriba cuando abajo no cabe.
 */
const props = withDefaults(
  defineProps<{
    modelValue: string | number | null;
    options: SelectOption[];
    placeholder?: string;
    /** Muestra el buscador; por defecto solo cuando hay más de seis opciones. */
    searchable?: boolean;
    disabled?: boolean;
    id?: string;
    ariaLabel?: string;
    size?: 'sm' | 'md';
    /** Con una opción vacía al principio para poder "deselegir". */
    clearable?: boolean;
  }>(),
  { placeholder: '— Elige —', searchable: undefined, disabled: false, id: undefined, ariaLabel: undefined, size: 'md', clearable: false },
);
const emit = defineEmits<{ 'update:modelValue': [value: string | number | null] }>();

const root = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const list = ref<HTMLElement | null>(null);
const searchInput = ref<HTMLInputElement | null>(null);
const open = ref(false);
const query = ref('');
watch(query, (text) => trackSearch(props.id ?? 'select', text));
const highlighted = ref(0);

const showSearch = computed(() => props.searchable ?? props.options.length > 6);
const selected = computed(() => props.options.find((o) => o.value === props.modelValue) ?? null);

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const filtered = computed(() => {
  const needle = normalize(query.value.trim());
  const list = needle ? props.options.filter((o) => normalize(`${o.label} ${o.hint ?? ''} ${o.group ?? ''}`).includes(needle)) : props.options;
  return list;
});

/** Opciones agrupadas conservando el orden de aparición de cada grupo. */
const groups = computed(() => {
  const map = new Map<string, SelectOption[]>();
  for (const option of filtered.value) {
    const key = option.group ?? '';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(option);
  }
  return [...map.entries()].map(([name, options]) => ({ name, options }));
});

const flat = computed(() => groups.value.flatMap((g) => g.options));

watch(filtered, () => {
  highlighted.value = Math.max(0, flat.value.findIndex((o) => o.value === props.modelValue));
});

const GAP = 4;
const MARGIN = 16;
const MIN_WIDTH = 224;
const LIST_MAX = 288;
const panelStyle = ref<Record<string, string>>({});

// Debajo del botón si cabe; si no, encima cuando ahí hay más sitio. Con la lista recortada a lo que quepa.
function place() {
  const box = trigger.value?.getBoundingClientRect();
  if (!box) return;
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  if (box.bottom < 0 || box.top > viewportHeight) {
    open.value = false;
    return;
  }
  const width = Math.min(Math.max(box.width, MIN_WIDTH), viewportWidth - 2 * MARGIN);
  const left = Math.min(Math.max(box.left, MARGIN), viewportWidth - MARGIN - width);
  const needed = panel.value && list.value
    ? panel.value.offsetHeight - list.value.clientHeight + Math.min(list.value.scrollHeight, LIST_MAX)
    : LIST_MAX + 48;
  const below = viewportHeight - box.bottom - GAP - MARGIN;
  const above = box.top - GAP - MARGIN;
  const upward = below < needed && above > below;
  panelStyle.value = upward
    ? { left: `${left}px`, width: `${width}px`, bottom: `${viewportHeight - box.top + GAP}px`, maxHeight: `${above}px` }
    : { left: `${left}px`, width: `${width}px`, top: `${box.bottom + GAP}px`, maxHeight: `${below}px` };
}

// Sigue al botón cuando se mueve la página o cualquier contenedor con scroll (no la propia lista del panel).
function follow(event: Event) {
  if (event.target instanceof Node && panel.value?.contains(event.target)) return;
  place();
}

function stopFollowing() {
  window.removeEventListener('scroll', follow, { capture: true });
  window.removeEventListener('resize', follow);
}

watch(open, (isOpen) => {
  if (!isOpen) {
    stopFollowing();
    return;
  }
  window.addEventListener('scroll', follow, { capture: true, passive: true });
  window.addEventListener('resize', follow);
});

async function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    query.value = '';
    highlighted.value = Math.max(0, flat.value.findIndex((o) => o.value === props.modelValue));
    place();
    await nextTick();
    place();
    searchInput.value?.focus();
    scrollToHighlighted();
  }
}

function close(returnFocus: boolean) {
  open.value = false;
  if (returnFocus) trigger.value?.focus();
}

function choose(option: SelectOption | null) {
  if (option?.disabled) return;
  emit('update:modelValue', option ? option.value : null);
  close(true);
}

function move(delta: number) {
  if (flat.value.length === 0) return;
  highlighted.value = (highlighted.value + delta + flat.value.length) % flat.value.length;
  scrollToHighlighted();
}

function scrollToHighlighted() {
  void nextTick(() => panel.value?.querySelector<HTMLElement>(`[data-index="${highlighted.value}"]`)?.scrollIntoView({ block: 'nearest' }));
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void toggle();
    }
    return;
  }
  if (event.key === 'ArrowDown') { event.preventDefault(); move(1); }
  else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1); }
  else if (event.key === 'Enter') { event.preventDefault(); choose(flat.value[highlighted.value] ?? null); }
  // Dentro de un modal, Escape cierra solo el desplegable.
  else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
  // El panel está al final del body: el tabulador vuelve al botón para seguir desde ahí por la página.
  else if (event.key === 'Tab') { event.preventDefault(); close(true); }
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node;
  if (open.value && !root.value?.contains(target) && !panel.value?.contains(target)) close(false);
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown));
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  stopFollowing();
});

const sizeClasses = computed(() => (props.size === 'sm' ? 'px-2.5 py-1 text-sm' : 'px-3 py-2 text-sm'));
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown">
    <button
      :id="id"
      ref="trigger"
      type="button"
      role="combobox"
      :aria-expanded="open"
      :aria-label="ariaLabel"
      :disabled="disabled"
      class="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-surface text-left text-slate-900 shadow-sm transition hover:border-brand-400/60 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:opacity-60"
      :class="sizeClasses"
      @click="toggle"
    >
      <span class="min-w-0 flex-1 truncate" :class="selected ? '' : 'text-slate-400'">
        <template v-if="selected">
          <TeamCrest v-if="selected.crest !== undefined" :src="selected.crest" :name="selected.label" size="xs" class="mr-1.5 align-middle" />
          <PlayerAvatar v-else-if="selected.photo !== undefined" :src="selected.photo" :name="selected.label" size="xs" class="mr-1.5 align-middle" />
          {{ selected.label }}<span v-if="selected.hint" class="ml-1 text-xs text-slate-500">· {{ selected.hint }}</span>
        </template>
        <template v-else>{{ placeholder }}</template>
      </span>
      <Icon icon="chevron-down" class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <Teleport to="body">
      <div
        v-if="open"
        ref="panel"
        class="fixed z-[55] flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-card"
        :style="panelStyle"
        role="listbox"
        @keydown="onKeydown"
      >
        <div v-if="showSearch" class="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
          <Icon icon="magnifying-glass" class="h-3.5 w-3.5 text-slate-400" />
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder="Buscar por nombre…"
            class="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            aria-label="Buscar"
          />
          <button v-if="query" type="button" class="text-slate-400 hover:text-slate-700" aria-label="Borrar búsqueda" @click="query = ''">
            <Icon icon="xmark" class="h-3 w-3" />
          </button>
        </div>

        <ul ref="list" class="max-h-72 min-h-0 overflow-y-auto py-1">
          <li v-if="clearable && !query" class="cursor-pointer px-3 py-1.5 text-sm text-slate-500 hover:bg-brand-500/10" @click="choose(null)">
            {{ placeholder }}
          </li>
          <li v-if="flat.length === 0" class="px-3 py-2 text-sm text-slate-500">Nada coincide con «{{ query }}».</li>
          <template v-for="group in groups" :key="group.name">
            <li v-if="group.name" class="px-3 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{{ group.name }}</li>
            <li
              v-for="option in group.options"
              :key="option.value"
              :data-index="flat.indexOf(option)"
              role="option"
              :aria-selected="option.value === modelValue"
              class="flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm"
              :class="[
                flat.indexOf(option) === highlighted ? 'bg-brand-500/10' : '',
                option.disabled ? 'cursor-not-allowed text-slate-400' : 'text-slate-800',
              ]"
              @mousemove="highlighted = flat.indexOf(option)"
              @click="choose(option)"
            >
              <span class="flex min-w-0 items-center gap-1.5">
                <TeamCrest v-if="option.crest !== undefined" :src="option.crest" :name="option.label" size="xs" />
                <PlayerAvatar v-else-if="option.photo !== undefined" :src="option.photo" :name="option.label" size="xs" />
                <span class="truncate">{{ option.label }}<span v-if="option.hint" class="ml-1 text-xs text-slate-500">· {{ option.hint }}</span></span>
              </span>
              <Icon v-if="option.value === modelValue" icon="check" class="h-3.5 w-3.5 shrink-0 text-brand-500" />
            </li>
          </template>
        </ul>
      </div>
    </Teleport>
  </div>
</template>
