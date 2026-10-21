<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Badge from '@/components/ui/Badge.vue';
import { useAuthStore } from '@/stores/auth';
import { accountTypeLabels } from '@/utils/format';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const menuOpen = ref(false);

interface NavLink {
  to: string;
  label: string;
  /** Solo se marca activo con la ruta exacta (para rutas que son prefijo de otras). */
  exact?: boolean;
}

const links = computed<NavLink[]>(() => {
  const items: NavLink[] = [];

  if (auth.isCoach) items.push({ to: '/', label: 'Mis plantillas', exact: true });
  if (auth.isClub) items.push({ to: '/', label: 'Mi club', exact: true });

  if (auth.isPlayer) {
    items.push({ to: '/', label: 'Mi panel', exact: true });
    const squad = auth.playerSquad;
    if (squad) {
      items.push({ to: `/plantillas/${squad.squadId}`, label: 'Mi plantilla', exact: true });
      items.push({ to: `/plantillas/${squad.squadId}/partidos`, label: 'Partidos' });
    }
  }

  items.push({ to: '/equipos', label: 'Equipos' }, { to: '/liga', label: 'Liga' });
  return items;
});

const isActive = (link: NavLink) =>
  link.exact ? route.path === link.to : route.path === link.to || route.path.startsWith(`${link.to}/`);

const teamLabel = computed(() => {
  if (auth.playerSquad) return auth.playerSquad.teamShortName;
  if (auth.isClub) return auth.club ? `${auth.club.teams.length} equipos` : null;
  const squads = auth.coachSquads;
  if (squads.length === 1) return squads[0]?.teamShortName ?? null;
  return squads.length > 1 ? `${squads.length} plantillas` : null;
});

function logout() {
  auth.logout();
  menuOpen.value = false;
  void router.push({ name: 'login' });
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <RouterLink to="/" class="flex items-center gap-2 font-semibold tracking-tight text-slate-900">
          <span class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">3T</span>
          <span>Tercer Tiempo</span>
        </RouterLink>

        <nav class="hidden items-center gap-1 md:flex">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-lg px-3 py-1.5 text-sm font-medium"
            :class="isActive(link) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="hidden items-center gap-3 md:flex">
          <template v-if="auth.isAuthenticated && auth.account">
            <span class="flex items-center gap-2 text-sm text-slate-600">
              {{ auth.displayName }}
              <Badge :tone="auth.isCoach ? 'blue' : auth.isClub ? 'amber' : 'green'">{{ accountTypeLabels[auth.account.type] }}</Badge>
              <span v-if="teamLabel" class="text-slate-400">· {{ teamLabel }}</span>
            </span>
            <button type="button" class="btn-ghost" @click="logout">Salir</button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="btn-ghost">Entrar</RouterLink>
            <RouterLink to="/registro" class="btn-primary">Darme de alta</RouterLink>
          </template>
        </div>

        <button type="button" class="btn-ghost md:hidden" aria-label="Menú" @click="menuOpen = !menuOpen">☰</button>
      </div>

      <div v-if="menuOpen" class="border-t border-slate-200 bg-white px-4 py-2 md:hidden">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="block rounded-lg px-3 py-2 text-sm font-medium"
          :class="isActive(link) ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-100'"
          @click="menuOpen = false"
        >
          {{ link.label }}
        </RouterLink>
        <div class="mt-2 border-t border-slate-100 pt-2">
          <template v-if="auth.isAuthenticated && auth.account">
            <p class="px-3 py-1 text-xs text-slate-500">{{ auth.displayName }} · {{ accountTypeLabels[auth.account.type] }}</p>
            <button type="button" class="btn-ghost w-full" @click="logout">Salir</button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="btn-ghost w-full" @click="menuOpen = false">Entrar</RouterLink>
            <RouterLink to="/registro" class="btn-primary mt-2 w-full" @click="menuOpen = false">Darme de alta</RouterLink>
          </template>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <slot />
    </main>

    <footer class="border-t border-slate-200 py-4 text-center text-xs text-slate-400">
      Tercer Tiempo · actas y rendimiento para el fútbol amateur
    </footer>
  </div>
</template>
