import type { ProblemDetails } from '@/types/api';
import { useAdminSessionStore } from '@/stores/adminSession';
import { useAuthStore } from '@/stores/auth';
import { useLoadingStore } from '@/stores/loading';
import { useSeasonStore } from '@/stores/season';
import { describeRequest } from '@/api/loadingLabels';

const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:5080').replace(/\/$/, '');
// El servicio de vídeo (subida, reproducción, descarga) es otro proceso: en desarrollo escucha en su puerto y en Docker
// Nginx le reenvía /media, igual que /api a la API.
const mediaUrl = (import.meta.env.VITE_MEDIA_URL ?? 'http://localhost:5081').replace(/\/$/, '');
const originOf = (path: string) => (path.startsWith('/media') ? mediaUrl : baseUrl);

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title ?? `Error ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }

  /** Errores de validación por campo (claves en camelCase, como las devuelve la API). */
  get fieldErrors(): Record<string, string[]> {
    return this.problem.errors ?? {};
  }

  /** Código del catálogo de errores (p. ej. license.required), si la API lo mandó. */
  get code(): string | null {
    return this.problem.code ?? null;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Objeto (se envía como JSON) o FormData (multipart, para subir archivos). */
  body?: unknown;
  /** Sondeos en segundo plano: no enciende la barra de carga. */
  silent?: boolean;
  /** Solo GET: reutiliza la respuesta durante estos milisegundos (datos de referencia que casi no cambian). */
  cacheMs?: number;
  /** Con cacheMs: lista de referencia que no cambia con lo que guarda una cuenta (sí con lo del administrador). */
  reference?: boolean;
  /**
   * Solo GET, páginas a las que se vuelve (ficha del equipo, partidos de la plantilla...): durante estos milisegundos se
   * devuelve al momento la respuesta anterior y se vuelve a pedir por detrás. useAsync con `revalidate` repinta si cambió.
   */
  staleMs?: number;
  /** Token propio en lugar del de la sesión (página de administración): un 401 no cierra la sesión del usuario. */
  token?: string;
  /** Lectura pública: va sin token, así que responde igual sin sesión, con una cuenta o como administrador. */
  anonymous?: boolean;
  /** Escrituras que no cambian datos que se lean (el latido de la sesión): no vacían la caché de lecturas. */
  keepCache?: boolean;
}

export const apiBaseUrl = baseUrl;
export const mediaBaseUrl = mediaUrl;

// GET en vuelo y respuestas cacheadas, por sesión y ruta: dos componentes que piden lo mismo a la vez comparten una
// sola petición, y las listas de referencia (competiciones, tipos de lesión...) no se repiten al cambiar de página.
// Las GET que ya iban en vuelo al guardar algo pueden traer datos de antes: no se reutilizan para las lecturas de
// después (cada escritura abre una generación nueva) ni se guardan en la caché.
// Cada respuesta guardada se puede devolver hasta `keep`; pasado `fresh` (con staleMs) se devuelve igual, pero se vuelve
// a pedir por detrás.
interface CacheEntry { fresh: number; keep: number; data: unknown; reference: boolean }
const inFlight = new Map<string, { generation: number; promise: Promise<unknown> }>();
const cache = new Map<string, CacheEntry>();
const revalidating = new Map<string, Promise<void>>();
let generation = 0;
let staleServed = 0;

// Con staleMs, lo que se vuelve a leer en estos milisegundos (dos componentes, o la segunda pasada de useAsync) no se
// vuelve a pedir.
const STALE_FRESH_MS = 3_000;

/** Olvida todas las respuestas cacheadas (al cambiar de sesión o de temporada). */
export function clearHttpCache() {
  cache.clear();
  inFlight.clear();
  revalidating.clear();
  prefetched.clear();
  generation++;
}

// Tras guardar algo: fuera todo menos las listas de referencia, salvo si guarda el administrador (sus catálogos).
function forgetAfterWrite(options: RequestOptions) {
  if (options.token) return clearHttpCache();
  for (const [key, entry] of cache) if (!entry.reference) cache.delete(key);
  inFlight.clear();
  revalidating.clear();
  prefetched.clear();
  generation++;
}

/** Cuántas lecturas han salido de la caché a la espera de revalidarse: useAsync lo mira antes y después de leer. */
export const staleReads = () => staleServed;

/** Espera a que lleguen las respuestas nuevas de lo que salió de la caché. */
export const revalidated = () => Promise.all(revalidating.values()).then(() => undefined);

// Sin cuenta abierta, la sesión del administrador sirve para leer toda la web (visor de solo lectura): la API solo le
// deja hacer GET en las rutas de las cuentas.
function adminViewerToken(): string | null {
  return useAuthStore().token ? null : useAdminSessionStore().session?.token ?? null;
}

const keyOf = (path: string, options: RequestOptions) =>
  `${options.anonymous ? '' : options.token ?? useAuthStore().token ?? adminViewerToken() ?? ''}|${useSeasonStore().selectedId ?? ''}|${path}`;

// Lecturas que una página sabe que va a hacer en cuanto llegue su primera respuesta (lo de la pestaña abierta): salen
// ya, a la vez que esa, y la primera lectura igual de los próximos segundos se queda con su respuesta (o la espera). Solo
// la primera: los sondeos de después piden lo suyo.
const PREFETCH_MS = 4_000;
const prefetched = new Map<string, { generation: number; until: number; promise: Promise<unknown> }>();

/** Pide ya una lectura (GET con la sesión) que la página va a hacer enseguida; si falla, ya lo dirá esa lectura. */
export function prefetch(path: string) {
  const key = keyOf(path, {});
  if (prefetched.has(key) || (cache.get(key)?.keep ?? 0) > Date.now() || inFlight.get(key)?.generation === generation) return;
  const promise = request(path, { silent: true });
  promise.catch(() => undefined);
  prefetched.set(key, { generation, until: Date.now() + PREFETCH_MS, promise });
  setTimeout(() => { if (prefetched.get(key)?.promise === promise) prefetched.delete(key); }, PREFETCH_MS);
}

export function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  if (method !== 'GET') return request<T>(path, options).finally(() => { if (!options.keepCache) forgetAfterWrite(options); });

  const key = keyOf(path, options);
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.keep > now) {
    if (cached.fresh <= now) {
      staleServed++;
      revalidate(key, path, options);
    }
    return Promise.resolve(cached.data as T);
  }

  const early = prefetched.get(key);
  if (early) {
    prefetched.delete(key);
    if (early.generation === generation && early.until > now) {
      return early.promise.then((data) => {
        if (early.generation === generation) remember(key, data, options);
        return data as T;
      });
    }
  }

  const pending = inFlight.get(key);
  if (pending && pending.generation === generation) return pending.promise as Promise<T>;

  const started = generation;
  const promise = request<T>(path, options)
    .then((data) => {
      if (started === generation) remember(key, data, options);
      return data;
    })
    .finally(() => {
      if (inFlight.get(key)?.promise === promise) inFlight.delete(key);
    });
  inFlight.set(key, { generation, promise });
  return promise;
}

const MAX_CACHE_ENTRIES = 150;

function remember(key: string, data: unknown, options: RequestOptions) {
  if (!options.staleMs && !options.cacheMs) return;
  const now = Date.now();
  // Se borra antes para que vuelva al final: el Map recorre en orden de inserción y lo primero es lo más antiguo.
  cache.delete(key);
  if (options.staleMs) cache.set(key, { fresh: now + STALE_FRESH_MS, keep: now + options.staleMs, data, reference: false });
  else cache.set(key, { fresh: now + options.cacheMs!, keep: now + options.cacheMs!, data, reference: options.reference ?? false });
  if (cache.size <= MAX_CACHE_ENTRIES) return;
  for (const [stored, entry] of cache) if (entry.keep <= now) cache.delete(stored);
  for (const stored of cache.keys()) {
    if (cache.size <= MAX_CACHE_ENTRIES) break;
    cache.delete(stored);
  }
}

function revalidate(key: string, path: string, options: RequestOptions) {
  if (revalidating.has(key)) return;
  const started = generation;
  const done = request(path, { ...options, silent: true })
    .then((data) => {
      if (started !== generation) return;
      // Si no ha cambiado se guarda el mismo objeto: quien lo pinta no tiene nada que repintar.
      const previous = cache.get(key)?.data;
      remember(key, previous !== undefined && JSON.stringify(previous) === JSON.stringify(data) ? previous : data, options);
    })
    .catch((e: unknown) => {
      // Ya no existe o ya no se puede ver: que lo diga la próxima lectura. Sin conexión, se queda la anterior.
      if (e instanceof ApiError && e.status >= 400 && e.status < 500) cache.delete(key);
    })
    .finally(() => {
      if (revalidating.get(key) === done) revalidating.delete(key);
    });
  revalidating.set(key, done);
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const auth = useAuthStore();
  const headers: Record<string, string> = { Accept: 'application/json' };

  const isForm = options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const viewerToken = options.anonymous || options.token ? null : adminViewerToken();
  const token = options.anonymous ? null : options.token ?? auth.token ?? viewerToken;
  if (token) headers.Authorization = `Bearer ${token}`;
  // Todos los datos se leen de la temporada elegida (sin cabecera, la actual).
  const season = useSeasonStore().selectedId;
  if (season) headers['X-Season'] = season;

  const loading = useLoadingStore();
  const task = options.silent ? null : loading.start(describeRequest(options.method ?? 'GET', path));
  try {
    let response: Response;
    let text: string;
    try {
      response = await fetch(`${originOf(path)}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
      });
      text = await response.text();
    } catch {
      throw new ApiError(0, { title: 'Sin conexión', detail: path.startsWith('/media') ? 'No hemos podido conectar con el servicio de vídeo. Comprueba tu conexión a internet y vuelve a intentarlo en un momento.' : 'No hemos podido conectar con Tercer Tiempo. Comprueba tu conexión a internet y vuelve a intentarlo en un momento.' });
    }
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch {
      throw new ApiError(response.ok ? 502 : response.status, { title: 'Respuesta inesperada', detail: 'El servidor no ha devuelto una respuesta válida. Vuelve a intentarlo.' });
    }

    if (!response.ok) {
      if (response.status === 401 && auth.token && !options.token) auth.logout();
      // Token del administrador caducado o ya no válido (el 401 del propio token, no el de una contraseña mal escrita):
      // se cierra su sesión.
      const code = (data as ProblemDetails | null)?.code;
      if (response.status === 401 && viewerToken && (!code || code === 'auth.session_expired')) useAdminSessionStore().end();
      const problem = (data as ProblemDetails | null) ?? { status: response.status, title: response.statusText };
      throw new ApiError(response.status, problem);
    }
    return data as T;
  } finally {
    if (task !== null) loading.finish(task);
  }
}

/** Imagen o archivo que solo se sirve con la sesión iniciada (un <img> no puede mandar el token): devuelve el contenido. */
export async function httpBlob(path: string): Promise<Blob> {
  const token = useAuthStore().token ?? adminViewerToken();
  let response: Response;
  try {
    response = await fetch(`${originOf(path)}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, { title: 'Sin conexión', detail: 'No hemos podido conectar con Tercer Tiempo. Comprueba tu conexión a internet y vuelve a intentarlo en un momento.' });
  }
  if (!response.ok) throw new ApiError(response.status, { status: response.status, title: response.statusText });
  return response.blob();
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Se ha producido un error inesperado.';
}
