import type { Router } from 'vue-router';
import { useAdminSessionStore } from './adminSession';
import { useAuthStore } from './auth';

/**
 * Una sola sesión por navegador: o la de una cuenta (club, técnico o jugador) o la del administrador, nunca las dos.
 * Quien entra apunta en localStorage qué sesión manda; las demás pestañas lo oyen (evento storage) y cierran la otra.
 */
const ACTIVE_KEY = 'tt.active-session';

type SessionKind = 'user' | 'admin';

export function markActiveSession(kind: SessionKind) {
  try {
    // La marca de tiempo hace que cada entrada sea un cambio y las otras pestañas reciban el evento.
    localStorage.setItem(ACTIVE_KEY, `${kind}:${Date.now()}`);
  } catch {
    /* sin almacenamiento no hay otras pestañas que avisar */
  }
}

function activeSession(): SessionKind | null {
  try {
    const value = localStorage.getItem(ACTIVE_KEY);
    return value?.startsWith('admin') ? 'admin' : value?.startsWith('user') ? 'user' : null;
  } catch {
    return null;
  }
}

export function installSessionSync(router: Router) {
  const auth = useAuthStore();
  const admin = useAdminSessionStore();

  // Si una pestaña arrastra las dos (de antes de este cambio), manda la última que entró; sin marca, la cuenta.
  if (admin.isActive && auth.isAuthenticated) {
    if (activeSession() === 'admin') auth.logout();
    else admin.end();
  }

  window.addEventListener('storage', (event) => {
    if (event.key === ACTIVE_KEY && event.newValue?.startsWith('user')) admin.end();
    if (event.key === null || event.key === 'tt.token' || event.key === 'tt.account') {
      const wasAuthenticated = auth.isAuthenticated;
      auth.reloadFromStorage();
      if (wasAuthenticated && !auth.isAuthenticated && router.currentRoute.value.meta.requiresAuth) void router.push({ name: 'login' });
    }
  });
}
