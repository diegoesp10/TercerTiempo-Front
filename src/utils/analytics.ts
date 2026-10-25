import type { RouteLocationNormalized, Router } from 'vue-router';
import { apiBaseUrl } from '@/api/http';
import { ANALYTICS_SESSION_KEY, ANALYTICS_VISITOR_KEY, useConsentStore } from '@/stores/consent';
import { useAuthStore } from '@/stores/auth';
import type { AnalyticsEntity, AnalyticsEventType, TrackEventDto } from '@/types/api';

/**
 * Analítica propia: páginas vistas, búsquedas y clics, guardados en nuestra base de datos (nada sale a terceros).
 * Solo funciona si el visitante ha aceptado la analítica; sin eso no se crea ningún identificador ni se envía nada.
 */
const queue: TrackEventDto[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function storedId(storage: Storage, key: string): string {
  let id = storage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    storage.setItem(key, id);
  }
  return id;
}

// La administración (/jobs) no se mide: no es uso de la web.
function enabled() {
  return useConsentStore().analyticsAllowed && !window.location.pathname.startsWith('/jobs') && !window.location.pathname.startsWith('/cargatrabajo');
}

export function track(type: AnalyticsEventType, label: string | null = null, entity?: { type: AnalyticsEntity; id: string } | null, route?: RouteLocationNormalized) {
  if (!enabled()) return;
  queue.push({
    type,
    path: route?.path ?? window.location.pathname,
    routeName: (route?.name as string | undefined) ?? null,
    label,
    entityType: entity?.type ?? null,
    entityId: entity?.id ?? null,
    occurredAt: new Date().toISOString(),
  });
  if (queue.length >= 20) void flush();
  else if (!timer) timer = setTimeout(() => void flush(), 8_000);
}

export async function flush() {
  if (timer) clearTimeout(timer);
  timer = null;
  const consent = useConsentStore();
  if (!queue.length || !consent.analyticsAllowed || !consent.consentId) {
    queue.length = 0;
    return;
  }
  const events = queue.splice(0, 50);
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = useAuthStore().token;
    if (token) headers.Authorization = `Bearer ${token}`;
    // keepalive: el envío sigue aunque se cierre la pestaña.
    await fetch(`${apiBaseUrl}/api/analytics/events`, {
      method: 'POST',
      headers,
      keepalive: true,
      body: JSON.stringify({
        consentId: consent.consentId,
        visitorId: storedId(localStorage, ANALYTICS_VISITOR_KEY),
        sessionId: storedId(sessionStorage, ANALYTICS_SESSION_KEY),
        events,
      }),
    });
  } catch {
    /* la analítica nunca molesta: si falla, se pierde */
  }
}

/** De qué es la página: equipo, plantilla, partido o liga, según sus parámetros. */
function entityOf(route: RouteLocationNormalized): { type: AnalyticsEntity; id: string } | null {
  const param = (name: string) => (typeof route.params[name] === 'string' ? (route.params[name] as string) : null);
  if (param('matchId')) return { type: 'Match', id: param('matchId')! };
  if (param('squadId')) return { type: 'Squad', id: param('squadId')! };
  if (param('teamId')) return { type: 'Team', id: param('teamId')! };
  const competition = route.query.competition;
  return typeof competition === 'string' && /^[0-9a-f-]{36}$/i.test(competition) ? { type: 'Competition', id: competition } : null;
}

const searchTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** Lo que se busca, cuando se deja de escribir (desde 3 letras). */
export function trackSearch(where: string, text: string) {
  const term = text.trim().toLowerCase();
  const pending = searchTimers.get(where);
  if (pending) clearTimeout(pending);
  if (term.length < 3) return;
  searchTimers.set(where, setTimeout(() => track('Search', term), 1_200));
}

function clickLabel(element: Element): string | null {
  const explicit = element.getAttribute('data-track') ?? element.getAttribute('aria-label') ?? element.getAttribute('title');
  const text = explicit ?? (element as HTMLElement).innerText;
  const label = text?.replace(/\s+/g, ' ').trim();
  return label ? label.slice(0, 80) : null;
}

export function installAnalytics(router: Router) {
  router.afterEach((to, from, failure) => {
    if (failure || (to.path === from.path && from.matched.length)) return;
    track('PageView', null, entityOf(to), to);
  });

  // Lo más pulsado: enlaces y botones (o lo marcado con data-track); nunca lo que se escribe en los campos.
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest('a, button, [data-track]');
    if (!target || target.closest('[data-no-track]')) return;
    track('Click', clickLabel(target), entityOf(router.currentRoute.value), router.currentRoute.value);
  }, { capture: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
}
