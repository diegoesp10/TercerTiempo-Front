import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { api } from '@/api';
import { clearHttpCache } from '@/api/http';
import type { SeasonYearDto } from '@/types/api';

const SEASON_KEY = 'tt.season';

function readSaved(): string | null {
  try {
    return localStorage.getItem(SEASON_KEY);
  } catch {
    return null;
  }
}

function save(id: string | null) {
  try {
    if (id) localStorage.setItem(SEASON_KEY, id);
    else localStorage.removeItem(SEASON_KEY);
  } catch {
    /* sin almacenamiento: la elección dura lo que la pestaña */
  }
}

/**
 * Temporada que se está viendo: el dato padre de toda la app. Viaja en cada petición (cabecera X-Season) y, al
 * cambiarla, todas las páginas se vuelven a cargar con los datos de esa temporada. null = la actual.
 */
export const useSeasonStore = defineStore('season', () => {
  const seasons = ref<SeasonYearDto[]>([]);
  const selectedId = ref<string | null>(readSaved());
  const loaded = ref(false);

  const current = computed(() => seasons.value.find((s) => s.isCurrent) ?? seasons.value[0] ?? null);
  const selected = computed(() => seasons.value.find((s) => s.id === selectedId.value) ?? current.value);
  const isCurrent = computed(() => !selected.value || selected.value.id === current.value?.id);

  async function load() {
    try {
      seasons.value = await api.seasons.list();
      // Una temporada guardada que ya no existe, o que es la actual, se olvida: se sigue a la actual.
      if (selectedId.value && (!seasons.value.some((s) => s.id === selectedId.value) || selectedId.value === current.value?.id)) {
        selectedId.value = null;
        save(null);
      }
    } catch {
      /* sin respuesta: la API usa la actual */
    } finally {
      loaded.value = true;
    }
  }

  function select(id: string | null) {
    const next = id && id !== current.value?.id ? id : null;
    if (next === selectedId.value) return;
    selectedId.value = next;
    save(next);
    clearHttpCache();
  }

  return { seasons, selectedId, selected, current, isCurrent, loaded, load, select };
});
