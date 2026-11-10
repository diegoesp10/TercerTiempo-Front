import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { markActiveSession } from './sessionSync';
import { useAuthStore } from './auth';

const STORAGE_KEY = 'tt.admin-session';

export interface AdminSession { token: string; userName: string; expiresAt: string }

function readSession(): AdminSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const session = raw ? (JSON.parse(raw) as AdminSession) : null;
    return session && new Date(session.expiresAt).getTime() > Date.now() ? session : null;
  } catch {
    return null;
  }
}

function writeSession(session: AdminSession | null) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* sin almacenamiento: la sesión vive solo en memoria */
  }
}

/**
 * Sesión del administrador (/jobs). Dura lo que la pestaña y nunca convive con la de una cuenta de club, técnico o
 * jugador: entrar como administrador cierra la cuenta abierta y entrar con una cuenta cierra la de administrador, en
 * esta pestaña y en las demás (ver sessionSync).
 */
export const useAdminSessionStore = defineStore('adminSession', () => {
  const session = ref<AdminSession | null>(readSession());
  const isActive = computed(() => session.value !== null);

  function start(value: AdminSession) {
    useAuthStore().logout();
    session.value = value;
    writeSession(value);
    markActiveSession('admin');
  }

  function end() {
    session.value = null;
    writeSession(null);
  }

  return { session, isActive, start, end };
});
