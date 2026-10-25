<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import SearchResultItem from '@/components/search/SearchResultItem.vue';
import { useSearchStore } from '@/stores/search';
import type { SearchItemDto, SearchResultsDto, SearchType } from '@/types/api';

/**
 * Buscador de toda la app (Ctrl+K o «/»): ligas, equipos, clubes, jugadores, partidos (dos equipos: «nalón roces») y
 * las plantillas propias. Busca mientras se escribe, se maneja con el teclado y lleva a la página de cada resultado.
 */
const store = useSearchStore();
const router = useRouter();
const route = useRoute();

const query = ref('');
const type = ref<SearchType | null>(null);
const results = ref<SearchResultsDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const active = ref(0);
const input = ref<HTMLInputElement | null>(null);
const list = ref<HTMLElement | null>(null);
let timer: ReturnType<typeof setTimeout> | null = null;
let sequence = 0;

const filters: { value: SearchType | null; label: string }[] = [
  { value: null, label: 'Todo' },
  { value: 'squad', label: 'Tus plantillas' },
  { value: 'competition', label: 'Ligas' },
  { value: 'team', label: 'Equipos' },
  { value: 'club', label: 'Clubes' },
  { value: 'player', label: 'Jugadores' },
  { value: 'match', label: 'Partidos' },
];
const examples = ['nalón roces', '3ª rfef', 'vallobín', 'garcía'];

const counts = computed(() => new Map((results.value?.groups ?? []).map((g) => [g.type, g.total])));
const flat = computed<SearchItemDto[]>(() => (results.value?.groups ?? []).flatMap((g) => g.items));
const searched = computed(() => query.value.trim().length >= 2);

function run() {
  if (timer) clearTimeout(timer);
  const text = query.value.trim();
  if (text.length < 2) {
    results.value = null;
    loading.value = false;
    error.value = null;
    return;
  }
  loading.value = true;
  timer = setTimeout(async () => {
    const mine = ++sequence;
    try {
      const response = await api.search.query(text, type.value, type.value ? 20 : 5);
      if (mine !== sequence) return;
      results.value = response;
      error.value = null;
      active.value = 0;
    } catch (e) {
      if (mine === sequence) error.value = errorMessage(e);
    } finally {
      if (mine === sequence) loading.value = false;
    }
  }, 160);
}

watch(query, run);
watch(type, run);

watch(
  () => store.open,
  async (open) => {
    if (!open) return;
    query.value = store.initialQuery;
    type.value = null;
    results.value = null;
    run();
    await nextTick();
    // El cursor al final: si se empezó a escribir en el buscador del inicio, se sigue escribiendo aquí.
    input.value?.focus();
    input.value?.setSelectionRange(query.value.length, query.value.length);
  },
);

// Al cambiar de página (por un resultado o por el historial) el buscador se cierra.
watch(() => route.fullPath, () => store.hide());

watch(
  () => store.open,
  (open) => { document.body.style.overflow = open ? 'hidden' : ''; },
);
onBeforeUnmount(() => { document.body.style.overflow = ''; });

function go(item: SearchItemDto) {
  store.remember(query.value);
  store.hide();
  void router.push(item.link);
}

function seeAll(only: SearchType | null = type.value) {
  const text = query.value.trim();
  if (text.length < 2) return;
  store.remember(text);
  store.hide();
  void router.push({ name: 'search', query: { q: text, ...(only ? { tipo: only } : {}) } });
}

function move(step: number) {
  if (flat.value.length === 0) return;
  active.value = (active.value + step + flat.value.length) % flat.value.length;
  void nextTick(() => list.value?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' }));
}

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    store.hide();
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    move(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    move(-1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    const item = flat.value[active.value];
    if ((event.ctrlKey || event.metaKey || !item) && searched.value) seeAll();
    else if (item) go(item);
  }
}

const indexOf = (item: SearchItemDto) => flat.value.indexOf(item);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="store.open"
        class="fixed inset-0 z-[60] flex items-start justify-center bg-slate-950/70 backdrop-blur-sm sm:px-4 sm:pt-[8vh]"
        @click.self="store.hide()"
      >
        <div
          class="flex h-full w-full max-w-2xl flex-col overflow-hidden border border-line bg-surface shadow-card sm:h-auto sm:max-h-[80vh] sm:rounded-2xl"
          role="dialog"
          aria-modal="true"
          aria-label="Buscar en Tercer Tiempo"
        >
          <!-- Caja de búsqueda -->
          <div class="flex items-center gap-3 border-b border-line px-4 py-3">
            <Icon v-if="loading" icon="spinner" class="h-4 w-4 shrink-0 animate-spin text-brand-500" />
            <Icon v-else icon="magnifying-glass" class="h-4 w-4 shrink-0 text-slate-400" />
            <input
              ref="input"
              v-model="query"
              type="text"
              inputmode="search"
              enterkeyhint="search"
              class="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
              placeholder="Busca ligas, equipos, clubes, jugadores o «equipo equipo» para un partido"
              aria-label="Buscar"
              aria-controls="search-results"
              autocomplete="off"
              spellcheck="false"
              @keydown="onKey"
            />
            <button v-if="query" type="button" class="rounded-md p-1 text-slate-400 hover:text-slate-700" aria-label="Borrar" @click="query = ''; input?.focus()">
              <Icon icon="xmark" class="h-3.5 w-3.5" />
            </button>
            <button type="button" class="rounded-md border border-line px-2 py-0.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800" @click="store.hide()">Esc</button>
          </div>

          <!-- Filtros -->
          <div class="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-2" role="radiogroup" aria-label="Tipo">
            <button
              v-for="filter in filters"
              :key="filter.label"
              type="button"
              role="radio"
              :aria-checked="type === filter.value"
              class="shrink-0 rounded-full border px-3 py-1 text-xs transition"
              :class="type === filter.value ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
              @click="type = filter.value"
            >
              {{ filter.label }}<span v-if="filter.value && !type && counts.get(filter.value)" class="ml-1 opacity-70">{{ counts.get(filter.value) }}</span>
            </button>
          </div>

          <!-- Resultados -->
          <div id="search-results" ref="list" class="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <p v-if="error" class="px-3 py-6 text-center text-sm text-red-500">{{ error }}</p>

            <!-- Antes de escribir: lo último que buscaste y ejemplos -->
            <div v-else-if="!searched" class="px-3 py-3">
              <template v-if="store.recent.length">
                <div class="flex items-center justify-between">
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Búsquedas recientes</p>
                  <button type="button" class="text-xs text-slate-500 hover:text-slate-800" @click="store.forget()">Borrar</button>
                </div>
                <ul class="mt-2 space-y-1">
                  <li v-for="recent in store.recent" :key="recent">
                    <button type="button" class="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-surface-2" @click="query = recent">
                      <Icon icon="clock" class="h-3 w-3 text-slate-400" />{{ recent }}
                    </button>
                  </li>
                </ul>
              </template>
              <p class="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Prueba con</p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button v-for="example in examples" :key="example" type="button" class="rounded-full border border-line px-3 py-1 text-xs text-slate-600 hover:border-brand-400/60" @click="query = example">{{ example }}</button>
              </div>
              <p class="mt-4 text-xs leading-relaxed text-slate-500">
                Sin tildes ni mayúsculas, por el principio de cada palabra y aunque haya alguna errata. Escribe dos equipos para encontrar su partido y un
                apellido o un dorsal con su equipo para encontrar a un jugador.
              </p>
            </div>

            <!-- Cargando la primera vez -->
            <div v-else-if="loading && !results" class="space-y-2 px-3 py-2" aria-hidden="true">
              <div v-for="n in 5" :key="n" class="flex items-center gap-3">
                <span class="h-10 w-10 animate-pulse rounded-full bg-surface-3" />
                <span class="flex-1 space-y-1.5"><span class="block h-3 w-2/3 animate-pulse rounded bg-surface-3" /><span class="block h-2.5 w-1/3 animate-pulse rounded bg-surface-3" /></span>
              </div>
            </div>

            <div v-else-if="results && results.total === 0" class="px-3 py-10 text-center">
              <Icon icon="magnifying-glass" class="h-6 w-6 text-slate-400" />
              <p class="mt-2 font-semibold text-slate-800">Nada para «{{ results.query }}»</p>
              <p class="mt-1 text-sm text-slate-500">Prueba con menos palabras, con el nombre corto del equipo o quita el filtro.</p>
            </div>

            <template v-else-if="results">
              <p v-if="results.partial" class="mx-3 mb-2 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-500">
                Nada coincide con todas las palabras: estos resultados coinciden con casi todas.
              </p>
              <section v-for="group in results.groups" :key="group.type" class="mb-2" :aria-label="group.label">
                <header class="flex items-center justify-between px-3 py-1.5">
                  <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ group.label }} <span class="font-normal">· {{ group.total }}</span></p>
                  <button v-if="group.total > group.items.length" type="button" class="text-xs font-medium text-brand-500 hover:underline" @click="seeAll(group.type)">Ver los {{ group.total }}</button>
                </header>
                <SearchResultItem
                  v-for="item in group.items"
                  :key="`${item.type}-${item.id}`"
                  :item="item"
                  :terms="results.terms"
                  :active="indexOf(item) === active"
                  :data-active="indexOf(item) === active"
                  compact
                  @mousemove="active = indexOf(item)"
                  @click="store.remember(query)"
                />
              </section>
            </template>
          </div>

          <!-- Pie -->
          <footer class="hidden items-center justify-between gap-3 border-t border-line px-4 py-2 text-[11px] text-slate-500 sm:flex">
            <span class="flex items-center gap-3">
              <span><kbd class="rounded border border-line px-1 font-sans text-[10px]">↑</kbd> <kbd class="rounded border border-line px-1 font-sans text-[10px]">↓</kbd> moverse</span>
              <span><kbd class="rounded border border-line px-1 font-sans text-[10px]">Enter</kbd> abrir</span>
              <span><kbd class="rounded border border-line px-1 font-sans text-[10px]">Ctrl</kbd> + <kbd class="rounded border border-line px-1 font-sans text-[10px]">Enter</kbd> todos los resultados</span>
            </span>
            <span v-if="results">{{ results.total }} resultados · {{ results.elapsedMs }} ms</span>
            <button v-if="searched" type="button" class="font-medium text-brand-500 hover:underline sm:hidden" @click="seeAll()">Ver todos</button>
          </footer>
          <button v-if="searched" type="button" class="border-t border-line px-4 py-3 text-sm font-medium text-brand-500 sm:hidden" @click="seeAll()">Ver todos los resultados</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
