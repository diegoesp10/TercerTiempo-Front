<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BrandMark from '@/components/layout/BrandMark.vue';
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

const accountTone = computed(() => (auth.isCoach ? 'blue' : auth.isClub ? 'amber' : 'green'));

function logout() {
  auth.logout();
  menuOpen.value = false;
  void router.push({ name: 'login' });
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-20 border-b border-white/8 bg-navy-950/70 backdrop-blur-xl">
      <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <RouterLink to="/" class="flex items-center gap-3">
          <BrandMark :size="36" />
          <span class="font-display text-lg font-bold tracking-tight text-white">Tercer<span class="text-accent-400">Tiempo</span></span>
        </RouterLink>

        <nav class="hidden items-center gap-1 rounded-full border border-white/8 bg-white/4 p-1 md:flex" aria-label="Principal">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-full px-4 py-1.5 text-sm font-medium transition"
            :class="isActive(link) ? 'bg-brand-500 text-white shadow-glow' : 'text-slate-600 hover:bg-white/6 hover:text-white'"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="hidden items-center gap-3 md:flex">
          <template v-if="auth.isAuthenticated && auth.account">
            <span class="flex items-center gap-2 rounded-full border border-white/8 bg-white/4 py-1 pl-3 pr-1.5 text-sm text-slate-700">
              {{ auth.displayName }}
              <Badge :tone="accountTone">{{ accountTypeLabels[auth.account.type] }}</Badge>
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

      <div v-if="menuOpen" class="border-t border-white/8 bg-navy-900 px-4 py-2 md:hidden">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="block rounded-lg px-3 py-2 text-sm font-medium"
          :class="isActive(link) ? 'bg-brand-500/20 text-white' : 'text-slate-700 hover:bg-white/6'"
          @click="menuOpen = false"
        >
          {{ link.label }}
        </RouterLink>
        <div class="mt-2 border-t border-white/8 pt-2">
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

    <main class="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
      <slot />
    </main>

    <footer class="border-t border-white/8 py-5 text-center text-xs text-slate-500">
      <span class="font-display font-semibold text-slate-600">Tercer Tiempo</span> · actas y rendimiento para el fútbol amateur asturiano
    </footer>
  </div>
</template>
