<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import BrandMark from '@/components/layout/BrandMark.vue';
import LicenseBanner from '@/components/licensing/LicenseBanner.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import LoadingBar from '@/components/layout/LoadingBar.vue';
import SeasonSwitcher from '@/components/layout/SeasonSwitcher.vue';
import BackButton from '@/components/ui/BackButton.vue';
import Badge from '@/components/ui/Badge.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import SearchPalette from '@/components/search/SearchPalette.vue';
import SearchTrigger from '@/components/search/SearchTrigger.vue';
import { useAdminSessionStore } from '@/stores/adminSession';
import { useAuthStore } from '@/stores/auth';
import { useSeasonStore } from '@/stores/season';
import { useSettingsStore } from '@/stores/settings';
import { accountTypeLabels } from '@/utils/format';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import { useConsentStore } from '@/stores/consent';
import AlertBell from '@/components/alerts/AlertBell.vue';

const auth = useAuthStore();
const settings = useSettingsStore();
const season = useSeasonStore();
const consent = useConsentStore();
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

  items.push({ to: '/equipos', label: 'Equipos' }, { to: '/liga', label: 'Liga' }, { to: '/arbitros', label: 'Árbitros' });
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

// Escudo del equipo de quien entra (jugador o técnico de una sola plantilla).
const teamCrest = computed(() => {
  if (auth.playerSquad) return auth.playerSquad.teamCrestUrl ?? null;
  const squads = auth.coachSquads;
  return !auth.isClub && squads.length === 1 ? squads[0]?.teamCrestUrl ?? null : undefined;
});

const accountTone = computed(() => (auth.isCoach ? 'blue' : auth.isClub ? 'amber' : 'green'));
const themeLabel = computed(() => (settings.isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'));

function logout() {
  auth.logout();
  menuOpen.value = false;
  void router.push({ name: 'login' });
}

// La sesión de administrador va aparte de la de las cuentas (nunca a la vez): se enseña como tal y se cierra aquí.
const admin = useAdminSessionStore();
// El buscador es para las cuentas (club, técnico o jugador), no para el administrador.
const canSearch = computed(() => auth.isAuthenticated && !admin.isActive);
function logoutAdmin() {
  admin.end();
  menuOpen.value = false;
  void router.push({ name: 'jobs' });
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <header class="sticky top-0 z-20 border-b border-line bg-surface/95">
      <div class="mx-auto flex h-16 w-full max-w-[1760px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <RouterLink to="/" class="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <BrandMark :size="34" />
          <span class="whitespace-nowrap font-display text-xl font-bold uppercase tracking-wide text-slate-900 sm:text-2xl">Tercer <span class="text-brand-500">Tiempo</span></span>
        </RouterLink>

        <nav class="hidden items-center gap-1 lg:flex" aria-label="Principal">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-semibold transition"
            :class="isActive(link) ? 'bg-action text-white' : 'text-slate-600 hover:bg-surface-2 hover:text-slate-900'"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="flex min-w-0 items-center gap-2">
          <!-- En móvil la temporada va dentro del menú, para que la cabecera no se parta. -->
          <SearchTrigger v-if="canSearch" class="hidden w-44 xl:flex 2xl:w-60" />
          <SearchTrigger v-if="canSearch" compact class="xl:hidden" />
          <SeasonSwitcher class="hidden lg:block" />
          <AlertBell v-if="auth.isClub && !admin.isActive" />
          <button type="button" class="btn-ghost px-2" :title="themeLabel" :aria-label="themeLabel" @click="settings.toggleTheme()">
            <svg v-if="settings.isDark" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
            <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
            </svg>
          </button>

          <div class="hidden min-w-0 items-center gap-2 lg:flex">
            <template v-if="admin.isActive">
              <RouterLink to="/jobs" class="flex min-w-0 items-center gap-2 rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-surface-2" title="Administración">
                <Icon icon="lock" class="h-3.5 w-3.5 shrink-0 text-accent-400" />
                <span class="min-w-0 max-w-40 truncate font-medium">{{ admin.session?.userName }}</span>
                <Badge tone="red" class="shrink-0">Administrador</Badge>
              </RouterLink>
              <button type="button" class="btn-ghost shrink-0" @click="logoutAdmin">Salir</button>
            </template>
            <template v-else-if="auth.isAuthenticated && auth.account">
              <RouterLink to="/ajustes" class="flex min-w-0 items-center gap-2 overflow-hidden rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-surface-2" :title="`Ajustes · ${accountTypeLabels[auth.account.type]}`">
                <TeamCrest v-if="auth.isClub" :src="auth.clubCrestUrl" :name="auth.displayName" size="sm" />
                <PlayerAvatar v-else-if="auth.isPlayer" :src="auth.player?.photoUrl" :name="auth.displayName" size="xs" />
                <span class="min-w-[3rem] max-w-40 truncate font-medium">{{ auth.displayName }}</span>
                <span class="hidden shrink-0 2xl:inline-flex"><Badge :tone="accountTone">{{ accountTypeLabels[auth.account.type] }}</Badge></span>
                <span v-if="teamLabel" class="hidden shrink-0 items-center gap-1 text-slate-400 2xl:flex">
                  · <TeamCrest v-if="teamCrest !== undefined" :src="teamCrest" :name="teamLabel" size="xs" /> {{ teamLabel }}
                </span>
              </RouterLink>
              <button type="button" class="btn-ghost shrink-0" @click="logout">Salir</button>
            </template>
            <template v-else>
              <RouterLink to="/login" class="btn-ghost">Entrar</RouterLink>
              <RouterLink to="/registro" class="btn-primary">Darme de alta</RouterLink>
            </template>
          </div>

          <button type="button" class="btn-ghost px-2 lg:hidden" aria-label="Menú" :aria-expanded="menuOpen" @click="menuOpen = !menuOpen">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      <div v-if="menuOpen" class="border-t border-line bg-surface px-4 py-2 lg:hidden">
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
        <div v-if="season.seasons.length" class="mt-2 border-t border-line px-3 pt-2">
          <p class="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <Icon icon="calendar-check" class="h-3 w-3" /> Temporada
          </p>
          <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Temporada">
            <button
              v-for="item in season.seasons"
              :key="item.id"
              type="button"
              role="radio"
              :aria-checked="item.id === season.selected?.id"
              class="rounded-full border px-3 py-1 text-sm font-semibold tabular-nums"
              :class="item.id === season.selected?.id
                ? (item.isCurrent ? 'border-brand-400 bg-brand-500 text-white' : 'border-amber-400/70 bg-amber-500/15 text-amber-700')
                : 'border-line text-slate-600'"
              @click="season.select(item.id); menuOpen = false"
            >
              {{ item.label }}<span v-if="item.isCurrent" class="ml-1 text-xs font-normal opacity-80">actual</span>
            </button>
          </div>
        </div>
        <div class="mt-2 border-t border-line pt-2">
          <template v-if="admin.isActive">
            <RouterLink to="/jobs" class="flex items-center gap-2 px-3 py-1 text-xs text-slate-500" @click="menuOpen = false">
              <Icon icon="lock" class="h-3 w-3 text-accent-400" />{{ admin.session?.userName }} · Administrador
            </RouterLink>
            <button type="button" class="btn-ghost w-full" @click="logoutAdmin">Salir</button>
          </template>
          <template v-else-if="auth.isAuthenticated && auth.account">
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
    <div v-if="!season.isCurrent && season.selected" class="border-b border-amber-400/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-700">
      Estás viendo la temporada <strong class="tabular-nums">{{ season.selected.label }}</strong>: solo consulta.
      <button type="button" class="ml-1 font-semibold underline hover:no-underline" @click="season.select(null)">
        Volver a la actual{{ season.current ? ` (${season.current.label})` : '' }}
      </button>
    </div>
    <LicenseBanner />
    <SearchPalette v-if="canSearch" />
    <ConfirmDialog />

    <main class="mx-auto w-full max-w-[1760px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10" :class="consent.needsBanner ? 'pb-48 sm:pb-36 lg:pb-28' : ''">
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
        <RouterLink to="/cookies" class="hover:text-slate-700 hover:underline">Cookies</RouterLink>
        <button type="button" class="hover:text-slate-700 hover:underline" @click="consent.settingsOpen = true">Configurar cookies</button>
        <span>Datos de <a href="https://www.futbolasturiano.es" target="_blank" rel="noopener" class="hover:underline">futbolasturiano.es</a> y <a href="https://www.asturfutbol.es" target="_blank" rel="noopener" class="hover:underline">asturfutbol.es</a></span>
      </nav>
    </footer>
  </div>
</template>
