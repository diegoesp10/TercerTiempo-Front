import { ref } from 'vue';
import { defineStore } from 'pinia';

const RECENT_KEY = 'tt.search-recent';
const RECENT_MAX = 6;

function readRecent(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((q): q is string => typeof q === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

/** Buscador global: si está abierto, con qué texto empieza y las últimas búsquedas (solo en este navegador). */
export const useSearchStore = defineStore('search', () => {
  const open = ref(false);
  const initialQuery = ref('');
  const recent = ref<string[]>(readRecent());

  function show(query = '') {
    initialQuery.value = query;
    open.value = true;
  }

  function hide() {
    open.value = false;
  }

  function remember(query: string) {
    const clean = query.trim();
    if (clean.length < 2) return;
    recent.value = [clean, ...recent.value.filter((q) => q.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_MAX);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value)); } catch { /* sin almacenamiento: solo en memoria */ }
  }

  function forget() {
    recent.value = [];
    try { localStorage.removeItem(RECENT_KEY); } catch { /* sin almacenamiento */ }
  }

  return { open, initialQuery, recent, show, hide, remember, forget };
});
