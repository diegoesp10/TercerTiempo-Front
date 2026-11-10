import { computed } from 'vue';
import { useAdminSessionStore } from '@/stores/adminSession';
import { useAuthStore } from '@/stores/auth';

/**
 * Quién está mirando: una cuenta (club, técnico o jugador) o el administrador, que con su sesión ve todo lo que vería
 * cualquiera con cuenta (y lo interno de cada plantilla) solo para consultar: nunca edita lo de un club o un jugador.
 */
export function useViewer() {
  const auth = useAuthStore();
  const admin = useAdminSessionStore();
  const isAdmin = computed(() => admin.isActive && !auth.isAuthenticated);
  const signedIn = computed(() => auth.isAuthenticated || isAdmin.value);
  return { isAdmin, signedIn };
}
