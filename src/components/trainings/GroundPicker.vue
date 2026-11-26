<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import GroundCard from '@/components/trainings/GroundCard.vue';
import type { GroundDto } from '@/types/api';

/**
 * Dónde se cita a los convocados: un campo de la liga, buscándolo al escribir (nombre, localidad, dirección o equipo
 * que juega allí), con su dirección y el mapa; o, si hay obras o se juega en otro sitio, lo que se escriba a mano.
 * Lo escrito es el sitio alternativo mientras no se elija un campo de la lista.
 */
const props = defineProps<{
  grounds: GroundDto[];
  homeGroundId: string | null;
  matchGroundId: string | null;
  disabled?: boolean;
}>();
const groundId = defineModel<string | null>('groundId', { required: true });
const place = defineModel<string>('place', { required: true });

const MAX = 8;
const input = ref<HTMLInputElement | null>(null);
const open = ref(false);
const highlighted = ref(0);

const selected = computed(() => props.grounds.find((g) => g.id === groundId.value) ?? null);

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const suggestions = computed(() => {
  const needle = normalize(place.value.trim());
  if (!needle) {
    // Sin escribir nada: primero el campo del partido y el de casa.
    const first = [props.matchGroundId, props.homeGroundId].filter((id, i, all): id is string => !!id && all.indexOf(id) === i);
    const picked = first.map((id) => props.grounds.find((g) => g.id === id)).filter((g): g is GroundDto => !!g);
    return [...picked, ...props.grounds.filter((g) => !first.includes(g.id))].slice(0, MAX);
  }
  const words = needle.split(/\s+/).filter(Boolean);
  return props.grounds
    .map((g) => {
      const name = normalize(g.name);
      const text = normalize([g.name, g.locality, g.address, ...g.homeTeams].filter(Boolean).join(' '));
      if (!words.every((w) => text.includes(w))) return null;
      return { g, score: name.startsWith(needle) ? 0 : name.includes(needle) ? 1 : 2 };
    })
    .filter((x): x is { g: GroundDto; score: number } => x !== null)
    .sort((a, b) => a.score - b.score)
    .slice(0, MAX)
    .map((x) => x.g);
});

const showCustom = computed(() => place.value.trim().length > 0 && !suggestions.value.some((g) => normalize(g.name) === normalize(place.value.trim())));
const optionCount = computed(() => suggestions.value.length + (showCustom.value ? 1 : 0));
watch(suggestions, () => (highlighted.value = 0));

function onInput(event: Event) {
  place.value = (event.target as HTMLInputElement).value;
  groundId.value = null;
  open.value = true;
}

function choose(ground: GroundDto) {
  groundId.value = ground.id;
  place.value = '';
  open.value = false;
}

function keepWritten() {
  place.value = place.value.trim();
  groundId.value = null;
  open.value = false;
}

async function change() {
  groundId.value = null;
  place.value = '';
  open.value = true;
  await nextTick();
  input.value?.focus();
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    open.value = true;
    if (optionCount.value === 0) return;
    highlighted.value = (highlighted.value + (event.key === 'ArrowDown' ? 1 : -1) + optionCount.value) % optionCount.value;
  } else if (event.key === 'Enter' && open.value && optionCount.value > 0) {
    event.preventDefault();
    const ground = suggestions.value[highlighted.value];
    if (ground) choose(ground);
    else keepWritten();
  } else if (event.key === 'Escape' && open.value) {
    event.stopPropagation();
    open.value = false;
  }
}

// Un pequeño margen para que el clic en una sugerencia llegue antes de cerrar la lista.
function onBlur() {
  window.setTimeout(() => (open.value = false), 150);
}
</script>

<template>
  <div>
    <div v-if="selected" class="rounded-lg border border-line bg-surface-2 p-3">
      <GroundCard :ground="selected" :home="selected.id === homeGroundId" />
      <div class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span v-if="selected.id === matchGroundId" class="text-[11px] text-slate-500">Es el campo del partido.</span>
        <button v-if="!disabled" type="button" class="text-xs font-medium text-accent-400 hover:underline" @click="change"><Icon icon="pen" class="mr-1 h-3 w-3" />Cambiar de sitio</button>
      </div>
    </div>

    <div v-else class="relative">
      <Icon icon="magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
      <input
        id="cu-place"
        ref="input"
        :value="place"
        type="text"
        maxlength="150"
        autocomplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="cu-place-list"
        :aria-expanded="open"
        class="input pl-8"
        placeholder="Busca un campo de la liga o escribe el sitio"
        :disabled="disabled"
        @input="onInput"
        @focus="open = true"
        @blur="onBlur"
        @keydown="onKey"
      />
      <ul
        v-if="open && optionCount > 0"
        id="cu-place-list"
        role="listbox"
        class="absolute left-0 right-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-card"
      >
        <li
          v-for="(g, i) in suggestions"
          :key="g.id"
          role="option"
          :aria-selected="i === highlighted"
          class="cursor-pointer px-3 py-2 text-sm"
          :class="i === highlighted ? 'bg-brand-500/10' : 'hover:bg-surface-2'"
          @mousedown.prevent="choose(g)"
          @mouseenter="highlighted = i"
        >
          <p class="flex items-center gap-1.5 font-medium text-slate-900">
            {{ g.name }}
            <span v-if="g.id === homeGroundId" class="rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-500">En casa</span>
            <span v-else-if="g.id === matchGroundId" class="rounded bg-accent-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-400">Del partido</span>
          </p>
          <p class="break-words text-xs text-slate-500">{{ g.address ?? g.locality ?? 'Sin dirección exacta' }}<template v-if="g.homeTeams.length"> · {{ g.homeTeams.join(', ') }}</template></p>
        </li>
        <li
          v-if="showCustom"
          role="option"
          :aria-selected="highlighted === suggestions.length"
          class="cursor-pointer border-t border-line px-3 py-2 text-sm"
          :class="highlighted === suggestions.length ? 'bg-brand-500/10' : 'hover:bg-surface-2'"
          @mousedown.prevent="keepWritten"
          @mouseenter="highlighted = suggestions.length"
        >
          <p class="font-medium text-slate-900"><Icon icon="pen" class="mr-1.5 h-3 w-3 text-warning" />Usar «{{ place.trim() }}» como sitio alternativo</p>
          <p class="text-xs text-slate-500">Por obras, un campo prestado o cualquier otro sitio que no sea de la liga.</p>
        </li>
      </ul>
      <p v-if="place.trim() && !open" class="mt-1.5 text-xs text-warning">Sitio alternativo: no es uno de los campos de la liga.</p>
      <p v-else-if="!grounds.length" class="mt-1.5 text-xs text-slate-500">Todavía no hay campos de la liga en el catálogo: escribe el sitio.</p>
    </div>
  </div>
</template>
