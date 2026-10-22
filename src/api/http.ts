import type { ProblemDetails } from '@/types/api';
import { useAuthStore } from '@/stores/auth';
import { useLoadingStore } from '@/stores/loading';
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
}

export const apiBaseUrl = baseUrl;

export async function http<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = useAuthStore();
  const headers: Record<string, string> = { Accept: 'application/json' };

  const isForm = options.body instanceof FormData;
  if (options.body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;

  const loading = useLoadingStore();
  const task = loading.start(describeRequest(options.method ?? 'GET', path));
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
      if (response.status === 401 && auth.token) auth.logout();
      const problem = (data as ProblemDetails | null) ?? { status: response.status, title: response.statusText };
      throw new ApiError(response.status, problem);
    }
    return data as T;
  } finally {
    loading.finish(task);
  }
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return 'Se ha producido un error inesperado.';
}
