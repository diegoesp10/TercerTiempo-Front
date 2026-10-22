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

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue'), meta: { root: true } },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true, root: true } },
    { path: '/registro', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { guestOnly: true, root: true } },
    { path: '/invitacion/:code?', name: 'join', component: () => import('@/views/JoinView.vue'), props: true, meta: { requiresAuth: true } },
    { path: '/codigo-acceso', name: 'redeem', component: () => import('@/views/coach/RedeemView.vue'), meta: { requiresAuth: true } },
    { path: '/pago/:sessionId', name: 'license-checkout', component: () => import('@/views/club/LicenseCheckoutView.vue'), props: true, meta: { requiresAuth: true } },
    { path: '/ajustes', name: 'settings', component: () => import('@/views/SettingsView.vue'), meta: { root: true } },
    { path: '/equipos', name: 'teams', component: () => import('@/views/TeamsView.vue'), meta: { root: true } },
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
    { path: '/liga', name: 'league', component: () => import('@/views/LeagueView.vue'), meta: { root: true } },
    { path: '/ver/:token', name: 'shared-video', component: () => import('@/views/SharedVideoView.vue'), props: true, meta: { root: true } },
    { path: '/privacidad', name: 'privacy', component: () => import('@/views/legal/PrivacyView.vue') },
    { path: '/condiciones', name: 'terms', component: () => import('@/views/legal/TermsView.vue') },
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

router.afterEach(() => { useLoadingStore().navigating = false; });
router.onError((error) => { useLoadingStore().navigating = false; console.error('No se ha podido cargar la página.', error); });

export default router;
