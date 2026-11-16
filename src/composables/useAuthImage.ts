import { onScopeDispose, ref, watch, type Ref } from 'vue';
import { apiBaseUrl, httpBlob } from '@/api/http';
import { useAdminSessionStore } from '@/stores/adminSession';
import { useAuthStore } from '@/stores/auth';

// Las fotos de los jugadores solo se sirven con la sesión iniciada (son de menores): un <img> no manda el token, así que
// se piden con él y se pintan desde memoria. Se guardan por cuenta y dirección (la dirección lleva la versión de la
// foto), para que un avatar repetido en la misma pantalla o al volver a ella no se pida otra vez.
const MAX_ENTRIES = 300;
const cache = new Map<string, Promise<string | null>>();

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

/** Imagen servida por la API con la sesión; las de otras webs (o data:) se usan tal cual. null mientras carga o si no se puede ver. */
export function useAuthImage(source: Ref<string | null | undefined>) {
  const auth = useAuthStore();
  const admin = useAdminSessionStore();
  const src = ref<string | null>(null);
  let disposed = false;
  onScopeDispose(() => { disposed = true; });

  watch(
    [source, () => auth.token, () => admin.session?.token],
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
      const url = await load(`${token}|${path}`, path);
      if (!disposed && source.value === path) src.value = url;
    },
    { immediate: true },
  );

  return src;
}
