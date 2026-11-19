<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { popoverZIndex } from '@/composables/useModalStack';
import { trackSearch } from '@/utils/analytics';

export interface ComboboxOption {
  value: string;
  label: string;
  /** Texto secundario a la derecha; no cuenta para buscar. */
  hint?: string;
  /** Otras palabras por las que encontrarlo (la posición, el equipo…). */
  keywords?: string;
  /** Jugadores: foto junto al nombre (o sus iniciales). */
  photo?: string | null;
  /** Equipos: escudo junto al nombre. */
  crest?: string | null;
  /** Sigue saliendo, pero en gris (p. ej., ya no está en la plantilla). */
  muted?: boolean;
}

/**
 * Buscador que no toca la página: mientras se escribe, las coincidencias salen en un desplegable bajo el propio campo y
 * elegir una (con el ratón, o con las flechas y Enter) la emite con `pick`. Lo de debajo no cambia con cada letra. El
 * desplegable flota sobre la página (va en el body) para que ninguna tarjeta lo corte, y se abre hacia arriba si abajo
 * no cabe.
 */
const props = withDefaults(
  defineProps<{
    options: ComboboxOption[];
    placeholder?: string;
    ariaLabel?: string;
    /** Nombre del buscador en las estadísticas de búsquedas. */
    id?: string;
    /** Cuántas coincidencias se enseñan como mucho. */
    max?: number;
    /** Principio del aviso cuando nada coincide: «… «lo escrito».». */
    emptyLabel?: string;
  }>(),
  { placeholder: 'Buscar…', ariaLabel: undefined, id: undefined, max: 8, emptyLabel: 'Nada coincide con' },
);
const emit = defineEmits<{ pick: [value: string] }>();

const listId = useId();
const root = ref<HTMLElement | null>(null);
const input = ref<HTMLInputElement | null>(null);
const panel = ref<HTMLElement | null>(null);
const query = ref('');
const open = ref(false);
const highlighted = ref(0);
watch(query, (text) => trackSearch(props.id ?? 'combobox', text));

const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const words = computed(() => fold(query.value.trim()).split(/\s+/).filter(Boolean));

// Tienen que estar todas las palabras; primero lo que empieza por lo escrito y luego lo que lo tiene al principio de una palabra.
const matches = computed(() => {
  const all = words.value;
  if (all.length === 0) return [];
  const needle = all.join(' ');
  const first = all[0] ?? '';
  return props.options
    .map((option, index) => {
      const label = fold(option.label);
      const text = `${label} ${fold(option.keywords ?? '')}`;
      if (!all.every((word) => text.includes(word))) return null;
      const score = label.startsWith(needle) ? 0 : label.split(/\s+/).some((part) => part.startsWith(first)) ? 1 : 2;
      return { option, score, index };
    })
    .filter((match): match is { option: ComboboxOption; score: number; index: number } => match !== null)
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((match) => match.option);
});
const visible = computed(() => matches.value.slice(0, props.max));
const more = computed(() => matches.value.length - visible.value.length);
const showPanel = computed(() => open.value && words.value.length > 0);
watch(matches, () => (highlighted.value = 0));

// Trozos de la etiqueta con lo escrito marcado; letra a letra, para que las tildes no descuadren las posiciones.
function segments(label: string) {
  const letters = [...label].map((char) => ({ char, folded: fold(char), start: 0, hit: false }));
  let position = 0;
  for (const letter of letters) {
    letter.start = position;
    position += letter.folded.length;
  }
  const text = letters.map((letter) => letter.folded).join('');
  for (const word of words.value) {
    const at = text.indexOf(word);
    if (at < 0) continue;
    for (const letter of letters) if (letter.start < at + word.length && letter.start + letter.folded.length > at) letter.hit = true;
  }
  const parts: { text: string; hit: boolean }[] = [];
  for (const { char, hit } of letters) {
    const last = parts[parts.length - 1];
    if (last && last.hit === hit) last.text += char;
    else parts.push({ text: char, hit });
  }
  return parts;
}

const GAP = 4;
const MARGIN = 16;
const MIN_WIDTH = 240;
const LIST_MAX = 320;
const panelStyle = ref<Record<string, string>>({});

// Debajo del campo si cabe; si no, encima cuando ahí hay más sitio.
function place() {
  const box = root.value?.getBoundingClientRect();
  if (!box) return;
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  if (box.bottom < 0 || box.top > viewportHeight) {
    open.value = false;
    return;
  }
  const width = Math.min(Math.max(box.width, MIN_WIDTH), viewportWidth - 2 * MARGIN);
  const left = Math.min(Math.max(box.left, MARGIN), viewportWidth - MARGIN - width);
  const needed = Math.min(panel.value?.scrollHeight ?? LIST_MAX, LIST_MAX);
  const below = viewportHeight - box.bottom - GAP - MARGIN;
  const above = box.top - GAP - MARGIN;
  panelStyle.value =
    below < needed && above > below
      ? { left: `${left}px`, width: `${width}px`, bottom: `${viewportHeight - box.top + GAP}px`, maxHeight: `${Math.min(above, LIST_MAX)}px` }
      : { left: `${left}px`, width: `${width}px`, top: `${box.bottom + GAP}px`, maxHeight: `${Math.min(below, LIST_MAX)}px` };
}

// Sigue al campo cuando se mueve la página o cualquier contenedor con scroll (no el propio desplegable).
function follow(event: Event) {
  if (event.target instanceof Node && panel.value?.contains(event.target)) return;
  place();
}

function stopFollowing() {
  window.removeEventListener('scroll', follow, { capture: true });
  window.removeEventListener('resize', follow);
}

watch(showPanel, (shown) => {
  if (!shown) {
    stopFollowing();
    return;
  }
  window.addEventListener('scroll', follow, { capture: true, passive: true });
  window.addEventListener('resize', follow);
});

watch([showPanel, visible], async () => {
  if (!showPanel.value) return;
  place();
  await nextTick();
  place();
});

function choose(option: ComboboxOption) {
  emit('pick', option.value);
  query.value = '';
  open.value = false;
}

function clear() {
  query.value = '';
  input.value?.focus();
}

function scrollToHighlighted() {
  void nextTick(() => panel.value?.querySelector<HTMLElement>(`[data-index="${highlighted.value}"]`)?.scrollIntoView({ block: 'nearest' }));
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    open.value = true;
    const count = visible.value.length;
    if (count === 0) return;
    highlighted.value = (highlighted.value + (event.key === 'ArrowDown' ? 1 : -1) + count) % count;
    scrollToHighlighted();
  } else if (event.key === 'Enter') {
    const option = showPanel.value ? visible.value[highlighted.value] : undefined;
    if (option) {
      event.preventDefault();
      choose(option);
    }
  } else if (event.key === 'Escape' && (showPanel.value || query.value)) {
    // Dentro de un modal, Escape cierra primero el desplegable y luego borra lo escrito; el modal sigue abierto.
    event.preventDefault();
    event.stopPropagation();
    if (showPanel.value) open.value = false;
    else query.value = '';
  } else if (event.key === 'Tab') {
    open.value = false;
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target as Node;
  if (open.value && !root.value?.contains(target) && !panel.value?.contains(target)) open.value = false;
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown));
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  stopFollowing();
});
</script>

<template>
  <div ref="root" class="relative">
    <Icon icon="magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
    <input
      ref="input"
      v-model="query"
      type="text"
      autocomplete="off"
      autocapitalize="off"
      spellcheck="false"
      enterkeyhint="search"
      role="combobox"
      aria-autocomplete="list"
      :aria-controls="listId"
      :aria-expanded="showPanel"
      :aria-activedescendant="showPanel && visible[highlighted] ? `${listId}-${highlighted}` : undefined"
      :aria-label="ariaLabel"
      :placeholder="placeholder"
      class="input w-full pl-9 pr-9"
      @input="open = true"
      @focus="open = true"
      @keydown="onKeydown"
    />
    <button
      v-if="query"
      type="button"
      class="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-slate-400 hover:text-slate-700"
      aria-label="Borrar la búsqueda"
      title="Borrar la búsqueda"
      @click="clear"
    >
      <Icon icon="xmark" class="h-3.5 w-3.5" />
    </button>

    <Teleport to="body">
      <div
        v-if="showPanel"
        ref="panel"
        class="fixed overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-card"
        :style="[panelStyle, { zIndex: popoverZIndex }]"
      >
        <ul :id="listId" role="listbox" :aria-label="ariaLabel">
          <li
            v-for="(option, i) in visible"
            :id="`${listId}-${i}`"
            :key="option.value"
            :data-index="i"
            role="option"
            :aria-selected="i === highlighted"
            class="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm"
            :class="[i === highlighted ? 'bg-brand-500/10' : '', option.muted ? 'text-slate-400' : 'text-slate-800']"
            @mousedown.prevent
            @mousemove="highlighted = i"
            @click="choose(option)"
          >
            <TeamCrest v-if="option.crest !== undefined" :src="option.crest" :name="option.label" size="xs" />
            <PlayerAvatar v-else-if="option.photo !== undefined" :src="option.photo" :name="option.label" size="xs" />
            <span class="min-w-0 flex-1 truncate">
              <template v-for="(part, p) in segments(option.label)" :key="p"><strong v-if="part.hit" class="font-bold">{{ part.text }}</strong><template v-else>{{ part.text }}</template></template>
            </span>
            <span v-if="option.hint" class="shrink-0 text-xs text-slate-500">{{ option.hint }}</span>
          </li>
        </ul>
        <p v-if="visible.length === 0" class="px-3 py-2 text-sm text-slate-500">{{ emptyLabel }} «{{ query.trim() }}».</p>
        <p v-else-if="more > 0" class="mt-1 border-t border-line px-3 pt-1.5 text-[11px] text-slate-500">
          Y {{ more }} más: sigue escribiendo para afinar.
        </p>
      </div>
    </Teleport>
  </div>
</template>
