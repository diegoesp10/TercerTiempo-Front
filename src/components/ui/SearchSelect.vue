<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';

/** Opción del desplegable: valor, texto, texto secundario y grupo (cabecera) opcionales. */
export interface SelectOption {
  value: string | number;
  label: string;
  hint?: string;
  group?: string;
  disabled?: boolean;
}

/**
 * Desplegable único de la aplicación: botón con el valor elegido, panel con buscador por nombre, grupos, teclado
 * (flechas, Enter, Escape) y cierre al pulsar fuera. Sustituye a los <select> nativos para que todos se vean igual.
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
const searchInput = ref<HTMLInputElement | null>(null);
const open = ref(false);
const query = ref('');
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

async function toggle() {
  if (props.disabled) return;
  open.value = !open.value;
  if (open.value) {
    query.value = '';
    highlighted.value = Math.max(0, flat.value.findIndex((o) => o.value === props.modelValue));
    await nextTick();
    searchInput.value?.focus();
    scrollToHighlighted();
  }
}

function choose(option: SelectOption | null) {
  if (option?.disabled) return;
  emit('update:modelValue', option ? option.value : null);
  open.value = false;
}

function move(delta: number) {
  if (flat.value.length === 0) return;
  highlighted.value = (highlighted.value + delta + flat.value.length) % flat.value.length;
  scrollToHighlighted();
}

function scrollToHighlighted() {
  void nextTick(() => root.value?.querySelector<HTMLElement>(`[data-index="${highlighted.value}"]`)?.scrollIntoView({ block: 'nearest' }));
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
  else if (event.key === 'Escape') { event.preventDefault(); open.value = false; }
  else if (event.key === 'Tab') { open.value = false; }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown));
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown));

const sizeClasses = computed(() => (props.size === 'sm' ? 'px-2.5 py-1 text-sm' : 'px-3 py-2 text-sm'));
</script>

<template>
  <div ref="root" class="relative" @keydown="onKeydown">
    <button
      :id="id"
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
          {{ selected.label }}<span v-if="selected.hint" class="ml-1 text-xs text-slate-500">· {{ selected.hint }}</span>
        </template>
        <template v-else>{{ placeholder }}</template>
      </span>
      <Icon icon="chevron-down" class="h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <div
      v-if="open"
      class="absolute left-0 z-30 mt-1 w-full min-w-56 overflow-hidden rounded-lg border border-line bg-surface shadow-card"
      role="listbox"
    >
      <div v-if="showSearch" class="flex items-center gap-2 border-b border-line px-3 py-2">
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

      <ul class="max-h-72 overflow-y-auto py-1">
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
            <span class="min-w-0 truncate">
              {{ option.label }}<span v-if="option.hint" class="ml-1 text-xs text-slate-500">· {{ option.hint }}</span>
            </span>
            <Icon v-if="option.value === modelValue" icon="check" class="h-3.5 w-3.5 shrink-0 text-brand-500" />
          </li>
        </template>
      </ul>
    </div>
  </div>
</template>
