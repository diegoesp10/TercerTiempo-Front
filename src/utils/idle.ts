/** Resuelve cuando el navegador está ocioso (o tras un breve plazo), para descargar lo accesorio después de pintar la página. */
export function whenIdle(timeout = 1500): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve();
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 200);
  });
}
