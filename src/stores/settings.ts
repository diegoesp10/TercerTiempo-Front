import { computed, ref, watch } from 'vue';
import { defineStore } from 'pinia';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'tt.theme';

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'light' || saved === 'dark' || saved === 'system' ? saved : 'dark';
  } catch {
    return 'dark';
  }
}

const systemQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

/**
 * Ajustes de la interfaz guardados en el dispositivo: tema claro, oscuro o el del sistema. El atributo data-theme de
 * <html> es lo que leen los estilos; index.html lo fija antes de pintar para que no haya parpadeo.
 */
export const useSettingsStore = defineStore('settings', () => {
  const theme = ref<ThemePreference>(readPreference());
  const systemDark = ref(systemQuery?.matches ?? true);

  systemQuery?.addEventListener('change', (event) => { systemDark.value = event.matches; });

  const resolvedTheme = computed<ResolvedTheme>(() => (theme.value === 'system' ? (systemDark.value ? 'dark' : 'light') : theme.value));
  const isDark = computed(() => resolvedTheme.value === 'dark');

  function apply() {
    document.documentElement.dataset.theme = resolvedTheme.value;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', isDark.value ? '#0a1120' : '#eef1f6');
  }

  function setTheme(value: ThemePreference) {
    theme.value = value;
    try {
      localStorage.setItem(THEME_KEY, value);
    } catch {
      /* sin almacenamiento: el tema dura lo que la sesión */
    }
  }

  function toggleTheme() {
    setTheme(isDark.value ? 'light' : 'dark');
  }

  watch(resolvedTheme, apply, { immediate: true });

  return { theme, resolvedTheme, isDark, setTheme, toggleTheme };
});
