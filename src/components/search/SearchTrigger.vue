<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue';
import { useSearchStore } from '@/stores/search';

/**
 * Acceso al buscador en la cabecera: una caja en escritorio y una lupa en móvil. Ctrl+K (o ⌘K) y «/» lo abren desde
 * cualquier página, salvo si se está escribiendo en otro campo.
 */
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });
const store = useSearchStore();
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

function onKey(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null;
  const typing = !!target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    if (store.open) store.hide();
    else store.show();
  } else if (event.key === '/' && !typing && !store.open) {
    event.preventDefault();
    store.show();
  }
}

// Solo una instancia escucha el teclado (la de escritorio), aunque haya dos accesos en la cabecera.
onMounted(() => { if (!props.compact) window.addEventListener('keydown', onKey); });
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <button
    v-if="compact"
    type="button"
    class="btn-ghost px-2"
    aria-label="Buscar"
    title="Buscar"
    @click="store.show()"
  >
    <Icon icon="magnifying-glass" class="h-4 w-4" />
  </button>
  <button
    v-else
    type="button"
    class="flex h-9 w-full min-w-0 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 text-sm text-slate-500 transition hover:border-brand-400/60 hover:text-slate-700"
    aria-label="Buscar en Tercer Tiempo"
    @click="store.show()"
  >
    <Icon icon="magnifying-glass" class="h-3.5 w-3.5 shrink-0" />
    <span class="min-w-0 flex-1 truncate text-left">Buscar…</span>
    <kbd class="hidden shrink-0 rounded border border-line px-1.5 font-sans text-[10px] xl:inline">{{ isMac ? '⌘' : 'Ctrl' }} K</kbd>
  </button>
</template>
