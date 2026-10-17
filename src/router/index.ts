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
    { path: '/', name: 'dashboard', component: () => import('@/views/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/login', name: 'login', component: () => import('@/views/LoginView.vue'), meta: { guestOnly: true } },
    { path: '/registro', name: 'register', component: () => import('@/views/RegisterView.vue'), meta: { guestOnly: true } },
    { path: '/equipos', name: 'teams', component: () => import('@/views/TeamsView.vue') },
    { path: '/equipos/:teamId', name: 'team', component: () => import('@/views/TeamDetailView.vue'), props: true },
    { path: '/partidos', name: 'matches', component: () => import('@/views/MatchesView.vue'), meta: { requiresAuth: true } },
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
    return { name: 'dashboard' };
  }

  return true;
});

export default router;
