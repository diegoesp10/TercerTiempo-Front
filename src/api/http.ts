import type { ProblemDetails } from '@/types/api';
import { useAuthStore } from '@/stores/auth';
import { useLoadingStore } from '@/stores/loading';
import { useSeasonStore } from '@/stores/season';
import { describeRequest } from '@/api/loadingLabels';

const baseUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:5080').replace(/\/$/, '');

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
  /** Token propio en lugar del de la sesión (página de administración): un 401 no cierra la sesión del usuario. */
  token?: string;
}

export const apiBaseUrl = baseUrl;

// GET en vuelo y respuestas cacheadas, por sesión y ruta: dos componentes que piden lo mismo a la vez comparten una
// sola petición, y las listas de referencia (competiciones, tipos de lesión...) no se repiten al cambiar de página.
const inFlight = new Map<string, Promise<unknown>>();
const cache = new Map<string, { expires: number; data: unknown }>();

/** Olvida las respuestas cacheadas (tras guardar algo, o al cambiar de sesión). */
export function clearHttpCache() {
  cache.clear();
}

export function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  if (method !== 'GET') return request<T>(path, options).finally(clearHttpCache);

  const key = `${options.token ?? useAuthStore().token ?? ''}|${useSeasonStore().selectedId ?? ''}|${path}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.data as T);

  const pending = inFlight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = request<T>(path, options)
    .then((data) => {
      if (options.cacheMs) cache.set(key, { expires: Date.now() + options.cacheMs, data });
      return data;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

async function request<T>(path: string, options: RequestOptions): Promise<T> {
  const auth = useAuthStore();
  const headers: Record<string, string> = { Accept: 'application/json' };

  const isForm = options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  const token = options.token ?? auth.token;
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
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method ?? 'GET',
        headers,
        body: options.body === undefined ? undefined : isForm ? (options.body as FormData) : JSON.stringify(options.body),
      });
      text = await response.text();
    } catch {
      throw new ApiError(0, { title: 'Sin conexión', detail: 'No se ha podido contactar con la API. ¿Está arrancada?' });
    }
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch {
      throw new ApiError(response.ok ? 502 : response.status, { title: 'Respuesta inesperada', detail: 'El servidor no ha devuelto una respuesta válida. Vuelve a intentarlo.' });
    }

    if (!response.ok) {
      if (response.status === 401 && auth.token && !options.token) auth.logout();
      const problem = (data as ProblemDetails | null) ?? { status: response.status, title: response.statusText };
      throw new ApiError(response.status, problem);
    }
    return data as T;
  } finally {
    if (task !== null) loading.finish(task);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Se ha producido un error inesperado.';
}
