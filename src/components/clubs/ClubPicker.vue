<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import type { ClubCatalogDto } from '@/types/api';

/**
 * Desplegable con búsqueda sobre el catálogo de clubes (GET /api/clubs/catalog): se escribe para filtrar y se elige
 * uno de la lista. El valor es el nombre canónico del club elegido o '' si no hay ninguno elegido.
 */
const props = defineProps<{ modelValue: string; id?: string }>();
const emit = defineEmits<{ 'update:modelValue': [value: string] }>();

const catalog = ref<ClubCatalogDto[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const query = ref(props.modelValue);
const open = ref(false);
const highlighted = ref(0);
const listId = `${props.id ?? 'club'}-options`;

onMounted(async () => {
  loading.value = true;
  try {
    catalog.value = await api.clubs.catalog();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
});

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const matches = computed(() => {
  const needle = normalize(query.value);
  const list = needle
    ? catalog.value.filter((club) => normalize(club.name).includes(needle) || club.teams.some((t) => normalize(t.name).includes(needle)))
    : catalog.value;
  return list.slice(0, 40);
});

const selected = computed(() => catalog.value.find((club) => club.name === props.modelValue) ?? null);

watch(matches, () => { highlighted.value = 0; });

function onInput() {
  open.value = true;
  // Escribir deshace la elección: solo vale un club de la lista.
  if (props.modelValue && query.value !== props.modelValue) emit('update:modelValue', '');
}

function choose(club: ClubCatalogDto) {
  if (club.registered) return;
  query.value = club.name;
  emit('update:modelValue', club.name);
  open.value = false;
}

function onKeydown(event: KeyboardEvent) {
  if (!open.value && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    open.value = true;
    event.preventDefault();
    return;
  }
  if (!open.value) return;
  if (event.key === 'ArrowDown') {
    highlighted.value = Math.min(highlighted.value + 1, matches.value.length - 1);
    event.preventDefault();
  } else if (event.key === 'ArrowUp') {
    highlighted.value = Math.max(highlighted.value - 1, 0);
    event.preventDefault();
  } else if (event.key === 'Enter') {
    const club = matches.value[highlighted.value];
    if (club) choose(club);
    event.preventDefault();
  } else if (event.key === 'Escape') {
    open.value = false;
  }
}

function onBlur() {
  // Se cierra tras el clic en una opción (mousedown la elige antes de que el input pierda el foco).
  setTimeout(() => { open.value = false; }, 120);
}
</script>

<template>
  <div class="relative">
    <input
      :id="id"
      v-model="query"
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      :aria-expanded="open"
      :aria-controls="listId"
      :aria-activedescendant="open && matches[highlighted] ? `${listId}-${highlighted}` : undefined"
      :placeholder="loading ? 'Cargando clubes…' : 'Escribe para buscar tu club'"
      class="input pr-9"
      @focus="open = true"
      @input="onInput"
      @keydown="onKeydown"
      @blur="onBlur"
    />
    <Icon icon="chevron-down" class="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 transition-transform" :class="open ? 'rotate-180' : ''" />

    <ul
      v-if="open && !loading"
      :id="listId"
      role="listbox"
      class="absolute z-30 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-card"
    >
      <li v-if="error" class="px-3 py-2 text-sm text-red-600">{{ error }}</li>
      <li v-else-if="matches.length === 0" class="px-3 py-2 text-sm text-slate-500">Ningún club coincide. Solo pueden darse de alta los clubes de las ligas que sigue Tercer Tiempo.</li>
      <li
        v-for="(club, index) in matches"
        v-else
        :id="`${listId}-${index}`"
        :key="club.name"
        role="option"
        :aria-selected="club.name === modelValue"
        :aria-disabled="club.registered"
        class="cursor-pointer px-3 py-2 text-sm"
        :class="[
          index === highlighted ? 'bg-brand-500/10' : '',
          club.registered ? 'cursor-not-allowed text-slate-400' : 'text-slate-800',
        ]"
        @mousedown.prevent="choose(club)"
        @mousemove="highlighted = index"
      >
        <div class="flex items-center justify-between gap-3">
          <span class="font-medium">{{ club.name }}</span>
          <span v-if="club.registered" class="shrink-0 text-xs">Ya tiene cuenta</span>
        </div>
        <p class="mt-0.5 truncate text-xs text-slate-500">
          {{ club.teams.map((t) => t.competitionName ? `${t.name} (${t.competitionName})` : t.name).join(' · ') }}
        </p>
      </li>
    </ul>

    <p v-if="selected" class="mt-1 text-xs text-slate-500">
      Se vincularán sus {{ selected.teams.length === 1 ? 'equipo' : `${selected.teams.length} equipos` }}:
      {{ selected.teams.map((t) => t.name).join(', ') }}.
    </p>
  </div>
</template>
