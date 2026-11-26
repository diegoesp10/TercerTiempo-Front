import { onScopeDispose, ref, watch, type Ref } from 'vue';
import { apiBaseUrl, httpBlob } from '@/api/http';
import { useAdminSessionStore } from '@/stores/adminSession';
import { useAuthStore } from '@/stores/auth';

// Las fotos de los jugadores solo se sirven con la sesión iniciada (son de menores): un <img> no manda el token, así que
// se piden con él y se pintan desde memoria. Se guardan por cuenta y dirección (la dirección lleva la versión de la
// foto), para que un avatar repetido en la misma pantalla o al volver a ella no se pida otra vez.
const MAX_ENTRIES = 300;
const cache = new Map<string, Promise<string | null>>();

// Un solo observador para todos los avatares (una plantilla son 30): cada foto se pide cuando su avatar está a punto de
// verse, no todas a la vez al entrar.
const waiting = new Map<Element, () => void>();
let observer: IntersectionObserver | null = null;

function whenVisible(element: Element, run: () => void): () => void {
  if (typeof IntersectionObserver === 'undefined') {
    run();
    return () => undefined;
  }
  observer ??= new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const callback = waiting.get(entry.target);
      observer?.unobserve(entry.target);
      waiting.delete(entry.target);
      callback?.();
    }
  }, { rootMargin: '300px' });
  waiting.set(element, run);
  observer.observe(element);
  return () => {
    observer?.unobserve(element);
    waiting.delete(element);
  };
}

function load(key: string, path: string): Promise<string | null> {
  const known = cache.get(key);
  if (known) {
    cache.delete(key);
    cache.set(key, known);
    return known;
  }
  const promise = httpBlob(path)
    .then((blob) => URL.createObjectURL(blob))
    .catch(() => null);
  cache.set(key, promise);
  while (cache.size > MAX_ENTRIES) {
    const [oldest, url] = cache.entries().next().value as [string, Promise<string | null>];
    cache.delete(oldest);
    void url.then((u) => { if (u) URL.revokeObjectURL(u); });
  }
  return promise;
}

/**
 * Imagen servida por la API con la sesión; las de otras webs (o data:) se usan tal cual. null mientras carga o si no se
 * puede ver. Con `target` (el elemento donde va), no se pide hasta que está a punto de verse, salvo que ya se tenga.
 */
export function useAuthImage(source: Ref<string | null | undefined>, target?: Ref<Element | null | undefined>) {
  const auth = useAuthStore();
  const admin = useAdminSessionStore();
  const src = ref<string | null>(null);
  const visible = ref(!target);
  let disposed = false;
  let stopWatching: (() => void) | null = null;
  onScopeDispose(() => {
    disposed = true;
    stopWatching?.();
  });

  if (target) {
    watch(target, (element) => {
      stopWatching?.();
      stopWatching = null;
      if (element && !visible.value) stopWatching = whenVisible(element, () => (visible.value = true));
    }, { immediate: true, flush: 'post' });
  }

  watch(
    [source, () => auth.token, () => admin.session?.token, visible],
    async ([path]) => {
      src.value = null;
      if (!path) return;
      if (!path.startsWith('/')) {
        src.value = path;
        return;
      }
      // Sin sesión se pide como siempre: las fotos de los técnicos son públicas y las de los jugadores darán 404 (iniciales).
      const token = auth.token ?? admin.session?.token ?? null;
      if (!token) {
        src.value = `${apiBaseUrl}${path}`;
        return;
      }
      const key = `${token}|${path}`;
      // Fuera de la vista solo se enseña si ya se tenía (al volver a una página); si no, se espera a que se vea.
      if (!visible.value && !cache.has(key)) return;
      const url = await load(key, path);
      if (!disposed && source.value === path) src.value = url;
    },
    { immediate: true },
  );

  return src;
}
