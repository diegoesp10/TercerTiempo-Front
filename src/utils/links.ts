/** Enlace externo que viene de datos descargados: solo http(s); cualquier otro esquema (javascript:, data:…) se descarta. */
export function httpUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}
