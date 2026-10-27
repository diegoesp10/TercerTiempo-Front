<script setup lang="ts">
import { ref } from 'vue';
import { useSearchStore } from '@/stores/search';
import { useAuthStore } from '@/stores/auth';

/** Buscador grande del panel de inicio: al escribir se abre el buscador completo con lo escrito. */
const store = useSearchStore();
const auth = useAuthStore();
const text = ref('');

function open() {
  store.show(text.value);
  text.value = '';
}

const examples = ['nalón roces', '3ª rfef', 'vallobín', 'garcía'];
</script>

<template>
  <section class="card relative overflow-hidden">
    <div class="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-brand-500/10 blur-2xl" aria-hidden="true" />
    <p class="eyebrow">Buscador</p>
    <h2 class="mt-1 text-lg font-bold text-slate-900">Encuentra cualquier liga, equipo, club, jugador{{ auth.isClub || auth.isCoach ? ', partido o árbitro' : ' o partido' }}</h2>
    <form class="mt-3 flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 focus-within:border-brand-400" role="search" @submit.prevent="open">
      <Icon icon="magnifying-glass" class="h-4 w-4 shrink-0 text-slate-400" />
      <input
        v-model="text"
        type="search"
        class="min-w-0 flex-1 bg-transparent text-base text-slate-900 outline-none placeholder:text-slate-400"
        placeholder="Escribe un nombre: «roces», «garcía», «nalón roces»…"
        aria-label="Buscar en Tercer Tiempo"
        autocomplete="off"
        @input="open"
        @focus="text && open()"
      />
      <kbd class="hidden shrink-0 rounded border border-line px-1.5 font-sans text-[10px] text-slate-500 sm:inline">/</kbd>
    </form>
    <div class="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
      <span>Prueba:</span>
      <button v-for="example in examples" :key="example" type="button" class="rounded-full border border-line px-2.5 py-0.5 hover:border-brand-400/60 hover:text-slate-800" @click="store.show(example)">{{ example }}</button>
    </div>
  </section>
</template>
