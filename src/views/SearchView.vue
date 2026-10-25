<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import SearchResultItem from '@/components/search/SearchResultItem.vue';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useSearchStore } from '@/stores/search';
import type { SearchResultsDto, SearchType } from '@/types/api';

/** Todos los resultados de una búsqueda (/buscar?q=…&tipo=…), por tipos y con más resultados que el buscador rápido. */
const route = useRoute();
const router = useRouter();
const store = useSearchStore();

const types: SearchType[] = ['squad', 'competition', 'team', 'club', 'player', 'match'];
const query = computed(() => (typeof route.query.q === 'string' ? route.query.q : ''));
const type = computed<SearchType | null>(() => (typeof route.query.tipo === 'string' && (types as string[]).includes(route.query.tipo) ? (route.query.tipo as SearchType) : null));

const text = ref(query.value);
const results = ref<SearchResultsDto | null>(null);
const all = ref<SearchResultsDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  text.value = query.value;
  if (query.value.trim().length < 2) {
    results.value = null;
    all.value = null;
    return;
  }
  loading.value = true;
  error.value = null;
  try {
    // Los totales por tipo salen de la búsqueda sin filtro; la lista, del tipo elegido con hasta 50 resultados.
    all.value = await api.search.query(query.value, null, type.value ? 1 : 12);
    results.value = type.value ? await api.search.query(query.value, type.value, 50) : all.value;
    store.remember(query.value);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch(() => [query.value, type.value], load, { immediate: true });

function submit() {
  void router.replace({ query: { q: text.value.trim(), ...(type.value ? { tipo: type.value } : {}) } });
}

function setType(value: SearchType | null) {
  void router.replace({ query: { q: query.value, ...(value ? { tipo: value } : {}) } });
}

const counts = computed(() => new Map((all.value?.groups ?? []).map((g) => [g.type, { label: g.label, total: g.total }])));
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <PageHeader title="Buscar" subtitle="Ligas, equipos, clubes, jugadores, partidos y tus plantillas." />

    <form class="card flex items-center gap-3 py-3" role="search" @submit.prevent="submit">
      <Icon icon="magnifying-glass" class="h-4 w-4 shrink-0 text-slate-400" />
      <input
        v-model="text"
        type="search"
        class="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
        placeholder="Nombre de una liga, un equipo, un club o un jugador; dos equipos para un partido"
        aria-label="Buscar"
        autocomplete="off"
      />
      <button type="submit" class="btn-primary px-4 py-1.5" v-busy="loading" :disabled="text.trim().length < 2">Buscar</button>
    </form>

    <div v-if="all && all.total > 0" class="mt-4 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo">
      <button
        type="button"
        class="rounded-full border px-3 py-1 text-xs"
        :class="!type ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
        @click="setType(null)"
      >Todo · {{ all.total }}</button>
      <template v-for="t in types" :key="t">
        <button
          v-if="counts.get(t)"
          type="button"
          class="rounded-full border px-3 py-1 text-xs"
          :class="type === t ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
          @click="setType(t)"
        >{{ counts.get(t)!.label }} · {{ counts.get(t)!.total }}</button>
      </template>
    </div>

    <Alert v-if="error" kind="error" class="mt-4">{{ error }}</Alert>

    <div v-if="loading && !results" class="mt-4 space-y-2" aria-hidden="true">
      <div v-for="n in 6" :key="n" class="card flex items-center gap-3 py-3">
        <span class="h-10 w-10 animate-pulse rounded-full bg-surface-3" />
        <span class="flex-1 space-y-1.5"><span class="block h-3 w-1/2 animate-pulse rounded bg-surface-3" /><span class="block h-2.5 w-1/4 animate-pulse rounded bg-surface-3" /></span>
      </div>
    </div>

    <p v-else-if="query.trim().length < 2" class="mt-6 text-center text-sm text-slate-500">Escribe al menos dos letras.</p>

    <div v-else-if="results && results.total === 0" class="card mt-4 py-10 text-center">
      <Icon icon="magnifying-glass" class="h-6 w-6 text-slate-400" />
      <p class="mt-2 font-semibold text-slate-800">Nada para «{{ results.query }}»</p>
      <p class="mt-1 text-sm text-slate-500">Prueba con menos palabras o con el nombre corto del equipo.</p>
    </div>

    <template v-else-if="results">
      <p class="mt-3 text-xs text-slate-500">
        {{ type ? results.total : all?.total }} resultados en {{ results.elapsedMs }} ms
        <template v-if="results.partial"> · nada coincide con todas las palabras: se muestran los que coinciden con casi todas</template>
      </p>
      <section v-for="group in results.groups" :key="group.type" class="card mt-4 px-2 py-2">
        <header class="flex items-center justify-between px-3 py-2">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">{{ group.label }} <span class="font-normal">· {{ group.total }}</span></h2>
          <button v-if="!type && group.total > group.items.length" type="button" class="text-xs font-medium text-brand-500 hover:underline" @click="setType(group.type)">
            Ver los {{ group.total }}
          </button>
        </header>
        <SearchResultItem v-for="item in group.items" :key="`${item.type}-${item.id}`" :item="item" :terms="results.terms" />
        <p v-if="type && group.total > group.items.length" class="px-3 py-2 text-xs text-slate-500">
          Se muestran los {{ group.items.length }} más relevantes de {{ group.total }}: afina la búsqueda para ver otros.
        </p>
      </section>
    </template>
  </div>
</template>
