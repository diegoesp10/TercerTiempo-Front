<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BrandMark from '@/components/layout/BrandMark.vue';
import LicenseBanner from '@/components/licensing/LicenseBanner.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import LoadingBar from '@/components/layout/LoadingBar.vue';
import BackButton from '@/components/ui/BackButton.vue';
import Badge from '@/components/ui/Badge.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';
import { accountTypeLabels } from '@/utils/format';

const auth = useAuthStore();
const settings = useSettingsStore();
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
const themeLabel = computed(() => (settings.isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'));

function logout() {
  auth.logout();
  menuOpen.value = false;
  void router.push({ name: 'login' });
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-20 border-b border-line bg-surface/95">
      <div class="mx-auto flex h-16 w-full max-w-[1760px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <RouterLink to="/" class="flex items-center gap-3">
          <BrandMark :size="34" />
          <span class="font-display text-2xl font-bold uppercase tracking-wide text-slate-900">Tercer <span class="text-brand-500">Tiempo</span></span>
        </RouterLink>

        <nav class="hidden items-center gap-1 md:flex" aria-label="Principal">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="rounded-md px-3 py-1.5 text-sm font-semibold transition"
            :class="isActive(link) ? 'bg-action text-white' : 'text-slate-600 hover:bg-surface-2 hover:text-slate-900'"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="flex items-center gap-2">
          <button type="button" class="btn-ghost px-2" :title="themeLabel" :aria-label="themeLabel" @click="settings.toggleTheme()">
            <svg v-if="settings.isDark" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          </button>

          <div class="hidden items-center gap-2 md:flex">
            <template v-if="auth.isAuthenticated && auth.account">
              <RouterLink to="/ajustes" class="flex items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-surface-2" title="Ajustes">
                <TeamCrest v-if="auth.isClub" :src="auth.clubCrestUrl" :name="auth.displayName" size="sm" />
                <span class="font-medium">{{ auth.displayName }}</span>
                <Badge :tone="accountTone">{{ accountTypeLabels[auth.account.type] }}</Badge>
                <span v-if="teamLabel" class="text-slate-400">· {{ teamLabel }}</span>
              </RouterLink>
              <button type="button" class="btn-ghost" @click="logout">Salir</button>
            </template>
            <template v-else>
              <RouterLink to="/login" class="btn-ghost">Entrar</RouterLink>
              <RouterLink to="/registro" class="btn-primary">Darme de alta</RouterLink>
            </template>
          </div>

          <button type="button" class="btn-ghost px-2 md:hidden" aria-label="Menú" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="menuOpen" class="border-t border-line bg-surface px-4 py-2 md:hidden">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="block rounded-md px-3 py-2 text-sm font-semibold"
          :class="isActive(link) ? 'bg-brand-500/15 text-brand-500' : 'text-slate-700 hover:bg-surface-2'"
          @click="menuOpen = false"
        >
          {{ link.label }}
        </RouterLink>
        <RouterLink to="/ajustes" class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-2" @click="menuOpen = false">Ajustes</RouterLink>
        <div class="mt-2 border-t border-line pt-2">
          <template v-if="auth.isAuthenticated && auth.account">
            <p class="flex items-center gap-2 px-3 py-1 text-xs text-slate-500">
              <TeamCrest v-if="auth.isClub" :src="auth.clubCrestUrl" :name="auth.displayName" size="xs" />
              {{ auth.displayName }} · {{ accountTypeLabels[auth.account.type] }}
            </p>
            <button type="button" class="btn-ghost w-full" @click="logout">Salir</button>
          </template>
          <template v-else>
            <RouterLink to="/login" class="btn-ghost w-full" @click="menuOpen = false">Entrar</RouterLink>
            <RouterLink to="/registro" class="btn-primary mt-2 w-full" @click="menuOpen = false">Darme de alta</RouterLink>
          </template>
        </div>
      </div>
    </header>

    <LoadingBar />
    <LicenseBanner />
    <ConfirmDialog />

    <main class="mx-auto w-full max-w-[1760px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
      <div v-if="!route.meta.root && !route.meta.error" class="mb-4">
        <BackButton />
      </div>
      <slot />
    </main>

    <footer class="border-t border-line bg-surface px-4 py-5 text-center text-xs leading-relaxed text-slate-600">
      <p>
        <span class="font-display text-sm font-semibold uppercase tracking-wide text-slate-600">Tercer Tiempo</span> · el rendimiento de cada jugador, partido a partido
      </p>
      <nav class="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1" aria-label="Información legal">
        <RouterLink to="/privacidad" class="hover:text-slate-700 hover:underline">Política de privacidad</RouterLink>
        <RouterLink to="/condiciones" class="hover:text-slate-700 hover:underline">Condiciones de uso</RouterLink>
        <span>Datos de <a href="https://www.futbolasturiano.es" target="_blank" rel="noopener" class="hover:underline">futbolasturiano.es</a> y <a href="https://www.asturfutbol.es" target="_blank" rel="noopener" class="hover:underline">asturfutbol.es</a></span>
      </nav>
    </footer>
  </div>
</template>
