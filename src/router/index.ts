import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useLoadingStore } from '@/stores/loading';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
    /** Página principal (sin botón «Atrás»). */
    root?: boolean;
    /** Página de error (sin botón «Atrás»; tiene los suyos). */
    error?: boolean;
  }
}

// Lo que dura la salida de la página anterior (.page-leave-active en style.css): el scroll se mueve cuando ya no se ve.
const PAGE_LEAVE_MS = 150;

const router = createRouter({
  history: createWebHistory(),
  // Página nueva: arriba del todo. «Atrás»: donde estaba. Mismo path (filtros en la query) o cambio de pestaña dentro
  // de la plantilla: no se mueve.
  scrollBehavior(to, from, savedPosition) {
    if (to.path === from.path) return false;
    if (to.hash) return { el: to.hash, top: 80 };
    const sameLayout = to.matched.length > 1 && to.matched[0] === from.matched[0] && to.params.squadId === from.params.squadId;
    if (sameLayout && !savedPosition) return false;
    const target = savedPosition ?? { top: 0 };
    return new Promise((resolve) => setTimeout(() => resolve({ ...target, behavior: 'instant' }), PAGE_LEAVE_MS));
  },
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { root: true } },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true, root: true } },
    { path: '/registro', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { guestOnly: true, root: true } },
    { path: '/invitacion/:code?', name: 'join', component: () => import('@/views/JoinView.vue'), props: true, meta: { requiresAuth: true } },
    { path: '/codigo-acceso', name: 'redeem', component: () => import('@/views/coach/RedeemView.vue'), meta: { requiresAuth: true } },
    { path: '/licencias', alias: '/precios', name: 'licenses', component: () => import('@/views/club/LicensePlansView.vue'), meta: { root: true } },
    { path: '/pago/:sessionId', name: 'license-checkout', component: () => import('@/views/club/LicenseCheckoutView.vue'), props: true, meta: { requiresAuth: true } },
    { path: '/ajustes', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { root: true } },
    // Página oculta del administrador (sin enlace en el menú; pide su propio usuario y contraseña).
    { path: '/jobs', alias: '/cargatrabajo', name: 'jobs', component: () => import('@/views/admin/JobsView.vue'), meta: { root: true } },
    { path: '/equipos', name: 'teams', component: () => import('@/views/TeamsView.vue'), meta: { root: true } },
    { path: '/equipos/:teamId/jugadores/:entryId', name: 'player-card', component: () => import('@/views/PlayerCardView.vue'), props: true, meta: { requiresAuth: true } },
    { path: '/equipos/:teamId', name: 'team', component: () => import('@/views/TeamDetailView.vue'), props: true },
    {
      path: '/plantillas/:squadId',
      component: () => import('@/views/squad/SquadLayoutView.vue'),
      props: true,
      children: [
        { path: '', name: 'squad', component: () => import('@/views/squad/SquadPlayersView.vue') },
        { path: 'partidos', name: 'squad-matches', component: () => import('@/views/squad/SquadMatchesView.vue') },
        { path: 'estadisticas', name: 'squad-stats', component: () => import('@/views/squad/SquadStatsView.vue') },
        { path: 'comparador', name: 'squad-compare', component: () => import('@/views/squad/SquadCompareView.vue') },
        {
          path: 'jugadores/:squadPlayerId',
          name: 'squad-player',
          component: () => import('@/views/squad/SquadPlayerProfileView.vue'),
          props: true,
        },
      ],
    },
    {
      path: '/plantillas/:squadId/partidos/:matchId',
      name: 'sheet',
      component: () => import('@/views/squad/MatchSheetView.vue'),
      props: true,
    },
    { path: '/partidos/:matchId', name: 'match', component: () => import('@/views/MatchDetailView.vue'), props: true },
    { path: '/buscar', name: 'search', component: () => import('@/views/SearchView.vue'), meta: { requiresAuth: true, root: true } },
    { path: '/liga', name: 'league', component: () => import('@/views/LeagueView.vue'), meta: { root: true } },
    { path: '/ver/:token', name: 'shared-video', component: () => import('@/views/SharedVideoView.vue'), props: true, meta: { root: true } },
    { path: '/privacidad', name: 'privacy', component: () => import('@/views/legal/PrivacyView.vue') },
    { path: '/condiciones', name: 'terms', component: () => import('@/views/legal/TermsView.vue') },
    { path: '/cookies', name: 'cookies', component: () => import('@/views/legal/CookiesView.vue') },
    { path: '/error/servidor', name: 'server-error', component: () => import('@/views/ServerErrorView.vue'), meta: { error: true } },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue'), meta: { error: true } },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  useLoadingStore().navigating = true;

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' };
  }

  return true;
});

// Tras desplegar una versión nueva, una pestaña abierta con la anterior pide trozos de página que ya no existen: se
// recarga una vez en la página a la que iba, que ya trae la versión nueva.
const STALE_CHUNK = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i;
const RELOAD_KEY = 'tt.reloaded-for';

function reloadInto(path: string) {
  try {
    if (sessionStorage.getItem(RELOAD_KEY) === path) return false;
    sessionStorage.setItem(RELOAD_KEY, path);
  } catch {
    /* sin almacenamiento: se recarga igualmente */
  }
  window.location.assign(path);
  return true;
}

router.afterEach(() => {
  useLoadingStore().navigating = false;
  try { sessionStorage.removeItem(RELOAD_KEY); } catch { /* sin almacenamiento */ }
});
router.onError((error, to) => {
  useLoadingStore().navigating = false;
  if (STALE_CHUNK.test(String((error as Error)?.message ?? error)) && reloadInto(to?.fullPath ?? window.location.pathname)) return;
  console.error('No se ha podido cargar la página.', error);
});
// Durante una navegación el error sigue hasta router.onError, que sabe a qué página iba; fuera de ellas (un import
// dinámico dentro de una página ya abierta) se recarga la actual.
window.addEventListener('vite:preloadError', (event) => {
  if (useLoadingStore().navigating) return;
  if (reloadInto(window.location.pathname + window.location.search)) event.preventDefault();
});

export default router;
