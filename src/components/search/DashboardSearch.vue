<script setup lang="ts">
import { useSearchStore } from '@/stores/search';

/** Lupa del panel de inicio: abre el buscador de toda la app (también con Ctrl+F o «/»). */
const store = useSearchStore();
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
const shortcut = isMac ? '⌘ F' : 'Ctrl F';
</script>

<template>
  <button
    type="button"
    class="group inline-flex shrink-0 cursor-pointer items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-px hover:border-brand-400/60 hover:text-slate-900 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    :title="`Buscar ligas, equipos, clubes, jugadores, técnicos, partidos o árbitros (${shortcut})`"
    aria-label="Buscar en Tercer Tiempo"
    @click="store.show()"
  >
    <span class="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-sm transition-transform group-hover:scale-110">
      <Icon icon="magnifying-glass" class="h-3.5 w-3.5" />
    </span>
    Buscar
    <kbd class="hidden rounded border border-line px-1.5 font-sans text-[10px] font-medium text-slate-500 sm:inline">{{ shortcut }}</kbd>
  </button>
</template>
