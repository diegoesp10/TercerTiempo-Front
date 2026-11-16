import type { RouteLocationNormalized } from 'vue-router';

// Parámetros de ruta que son secretos de un solo uso (códigos de invitación y de pase): no salen del navegador.
const SECRET_PARAMS = new Set(['code']);

/**
 * La ruta para la analítica y la presencia: sin query (?beta=, ?invite=…) y con los códigos tapados, para que no
 * acaben guardados en la base ni a la vista en «Gente en sesión».
 */
export function safePath(route: RouteLocationNormalized): string {
  let path = route.path;
  for (const [name, value] of Object.entries(route.params)) {
    if (!SECRET_PARAMS.has(name) || typeof value !== 'string' || !value) continue;
    path = path.replace(encodeURIComponent(value), '…').replace(value, '…');
  }
  return path;
}
