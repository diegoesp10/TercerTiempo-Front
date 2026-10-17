import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean;
    guestOnly?: boolean;
  }
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/views/HomeView.vue') },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true } },
    { path: '/registro', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { guestOnly: true } },
    { path: '/invitacion/:code?', name: 'join', component: () => import('@/views/JoinView.vue'), props: true, meta: { requiresAuth: true } },
    { path: '/equipos', name: 'teams', component: () => import('@/views/TeamsView.vue') },
    { path: '/equipos/:teamId', name: 'team', component: () => import('@/views/TeamDetailView.vue'), props: true },
    {
      path: '/plantillas/:squadId',
      component: () => import('@/views/squad/SquadLayoutView.vue'),
      props: true,
      children: [
        { path: '', name: 'squad', component: () => import('@/views/squad/SquadPlayersView.vue') },
        { path: 'partidos', name: 'squad-matches', component: () => import('@/views/squad/SquadMatchesView.vue') },
        { path: 'estadisticas', name: 'squad-stats', component: () => import('@/views/squad/SquadStatsView.vue') },
      ],
    },
    {
      path: '/plantillas/:squadId/partidos/:matchId',
      name: 'sheet',
      component: () => import('@/views/squad/MatchSheetView.vue'),
      props: true,
    },
    { path: '/partidos/:matchId', name: 'match', component: () => import('@/views/MatchDetailView.vue'), props: true },
    { path: '/liga', name: 'league', component: () => import('@/views/LeagueView.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/views/NotFoundView.vue') },
  ],
});

router.beforeEach((to) => {
  const auth = useAuthStore();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } };
  }

  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'home' };
  }

  return true;
});

export default router;
