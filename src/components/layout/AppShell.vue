<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { onClickOutside, useEventListener } from '@vueuse/core';
import { useRoute, useRouter } from 'vue-router';
import BrandMark from '@/components/layout/BrandMark.vue';
import LicenseBanner from '@/components/licensing/LicenseBanner.vue';
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue';
import LoadingBar from '@/components/layout/LoadingBar.vue';
import SeasonSwitcher from '@/components/layout/SeasonSwitcher.vue';
import BackButton from '@/components/ui/BackButton.vue';
import Badge from '@/components/ui/Badge.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import SearchPalette from '@/components/search/SearchPalette.vue';
import SearchTrigger from '@/components/search/SearchTrigger.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAdminSessionStore } from '@/stores/adminSession';
import { useAuthStore } from '@/stores/auth';
import { useSeasonStore } from '@/stores/season';
import { useSettingsStore } from '@/stores/settings';
import { accountTypeLabels } from '@/utils/format';
import { useConsentStore } from '@/stores/consent';
import AlertBell from '@/components/alerts/AlertBell.vue';
import ThemeIcon from '@/components/layout/ThemeIcon.vue';
import { useFit } from '@/composables/useFit';

const auth = useAuthStore();
const settings = useSettingsStore();
const season = useSeasonStore();
const consent = useConsentStore();
const router = useRouter();
const route = useRoute();
const admin = useAdminSessionStore();
const menuOpen = ref(false);

interface NavLink {
  to: string;
  label: string;
  /** Solo se marca activo con la ruta exacta (para rutas que son prefijo de otras). */
  exact?: boolean;
}

const links = computed<NavLink[]>(() => {
  const items: NavLink[] = [];

  if (admin.isActive && !auth.isAuthenticated) items.push({ to: '/jobs', label: 'Administración' });
  if (auth.isCoach) items.push({ to: '/', label: 'Mis plantillas', exact: true });
  if (auth.isClub) items.push({ to: '/', label: 'Mi club', exact: true });

  if (auth.isPlayer) {
    items.push({ to: '/', label: 'Mi panel', exact: true });
    const squad = auth.playerSquad;
    if (squad) {
      items.push({ to: `/plantillas/${squad.squadId}`, label: 'Mi plantilla', exact: true });
      items.push({ to: `/plantillas/${squad.squadId}/partidos`, label: 'Partidos' });
      items.push({ to: '/mis-convocatorias', label: 'Mis convocatorias' });
    }
  }

  // Pases por partido: el club gestiona solicitudes, precios y ventas; el resto de cuentas, los que ha canjeado.
  if (auth.isClub) items.push({ to: '/club/pases', label: 'Pases' });
  else if (auth.isAuthenticated) items.push({ to: '/mis-pases', label: 'Mis pases' });

  items.push({ to: '/equipos', label: 'Equipos' }, { to: '/liga', label: 'Liga' }, { to: '/arbitros', label: 'Árbitros' });
  return items;
});

// Qué se ve en la cabecera: se mide lo que cabe de verdad (no por anchos fijos), así que vale con cualquier pantalla,
// zoom, cuenta o número de enlaces. De lo más completo a lo más recogido: buscador ancho, buscador estrecho, la lupa,
// sin el nombre de la marca y, si el menú aún no cabe entero, la hamburguesa (con la marca si hay sitio). Nada encoge
// ni se corta con puntos suspensivos: todo lo de la fila es de ancho fijo y, si no cabe, se pasa al paso siguiente.
const headerRow = ref<HTMLElement | null>(null);
const header = ref<HTMLElement | null>(null);
const burgerButton = ref<HTMLButtonElement | null>(null);
const { step } = useFit(headerRow, [[], ['narrow'], ['compact'], ['compact', 'nobrand'], ['compact', 'burger'], ['compact', 'burger', 'nobrand']]);
const burger = computed(() => step.value >= 4);

// El menú de hamburguesa se cierra al navegar, al volver a caber todo, al pulsar fuera de la cabecera o con Escape.
watch(() => route.fullPath, () => {
  menuOpen.value = false;
});
watch(burger, (value) => {
  if (!value) menuOpen.value = false;
});
onClickOutside(header, () => {
  menuOpen.value = false;
});
useEventListener(document, 'keydown', (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !menuOpen.value) return;
  menuOpen.value = false;
  burgerButton.value?.focus();
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

// El perfil va como icono: quién es, el tipo de cuenta y su equipo, en el título.
const profileTitle = computed(() => {
  if (!auth.account) return '';
  const who = [auth.displayName, accountTypeLabels[auth.account.type], teamLabel.value].filter(Boolean).join(' · ');
  return auth.profileRoute ? `Mi perfil · ${who}` : `Ajustes · ${who}`;
});
// Con foto (jugador o técnico), su cara en lugar del icono; sin foto, el icono.
const profilePhoto = computed(() => auth.player?.photoUrl ?? auth.coach?.photoUrl ?? null);
const profileActive = computed(() => {
  if (auth.isPlayer) return route.name === 'my-profile';
  if (auth.isCoach) return route.name === 'coach' && route.params.coachId === auth.coach?.id;
  return route.name === 'settings';
});

const themeLabel = computed(() => (settings.isDark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'));

// «Salir» avisa antes de cerrar la sesión: un clic sin querer no echa a nadie.
async function logout() {
  menuOpen.value = false;
  const ok = await confirmDialog({
    title: 'Cerrar sesión',
    message: 'Estás cerrando la sesión en este dispositivo. Para volver a entrar necesitarás tu email y tu contraseña.',
    confirmLabel: 'Cerrar sesión',
  });
  if (!ok) return;
  auth.logout();
  void router.push({ name: 'login' });
}

// La sesión de administrador va aparte de la de las cuentas (nunca a la vez): se enseña como tal y se cierra aquí.
// Con ella se navega por toda la web en solo lectura, buscador incluido (encuentra también las plantillas internas).
const canSearch = computed(() => auth.isAuthenticated || admin.isActive);
async function logoutAdmin() {
  menuOpen.value = false;
  const ok = await confirmDialog({
    title: 'Cerrar la sesión de administrador',
    message: 'Estás cerrando la sesión de administrador. Para volver a entrar tendrás que identificarte de nuevo.',
    confirmLabel: 'Cerrar sesión',
  });
  if (!ok) return;
  admin.end();
  void router.push({ name: 'jobs' });
}
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <!-- z-45: la cabecera y sus desplegables (avisos, temporada, cuenta) quedan por encima de todo lo de la página y del aviso de
         cookies (z-40); solo los modales (z-50) la tapan. -->
    <header ref="header" class="sticky top-0 z-45 border-b border-line bg-surface/95">
      <!-- La fila se mide (useFit) y sus marcas data-* dicen qué se ve; nada de ella encoge (todo shrink-0). -->
      <div ref="headerRow" class="group/hdr mx-auto flex h-16 w-full max-w-[1760px] items-center justify-between gap-6 px-4 sm:px-6 lg:px-10">
        <RouterLink to="/" class="flex shrink-0 items-center gap-2 sm:gap-3" aria-label="Tercer Tiempo: inicio">
          <BrandMark :size="34" />
          <span class="whitespace-nowrap font-display text-xl font-bold uppercase tracking-wide text-slate-900 group-data-[nobrand]/hdr:hidden sm:text-2xl">Tercer <span class="text-brand-500">Tiempo</span></span>
        </RouterLink>

        <nav class="flex shrink-0 items-center gap-1 group-data-[burger]/hdr:hidden" aria-label="Principal">
          <RouterLink
            v-for="link in links"
            :key="link.to"
            :to="link.to"
            class="shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-semibold transition 2xl:px-3"
            :class="isActive(link) ? 'bg-action text-white' : 'text-slate-600 hover:bg-surface-2 hover:text-slate-900'"
            :aria-current="isActive(link) ? 'page' : undefined"
          >
            {{ link.label }}
          </RouterLink>
        </nav>

        <div class="flex shrink-0 items-center gap-2">
          <div v-if="canSearch" class="w-60 shrink-0 group-data-[narrow]/hdr:w-44 group-data-[compact]/hdr:hidden">
            <SearchTrigger />
          </div>
          <div v-if="canSearch" class="hidden shrink-0 group-data-[compact]/hdr:block">
            <SearchTrigger compact />
          </div>
          <!-- Con la hamburguesa, la temporada, el tema y la cuenta van dentro del menú: fuera quedan la lupa y los avisos. -->
          <div class="shrink-0 group-data-[burger]/hdr:hidden">
            <SeasonSwitcher />
          </div>
          <AlertBell v-if="auth.isAuthenticated && !admin.isActive" class="shrink-0" data-fit-ignore />
          <button type="button" class="btn-ghost shrink-0 px-2 group-data-[burger]/hdr:hidden" :title="themeLabel" :aria-label="themeLabel" @click="settings.toggleTheme()">
            <ThemeIcon :dark="settings.isDark" class="h-5 w-5" />
          </button>

          <div class="flex shrink-0 items-center gap-2 group-data-[burger]/hdr:hidden">
            <template v-if="admin.isActive">
              <RouterLink to="/jobs" class="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 py-1 text-sm text-slate-700 hover:bg-surface-2" title="Administración">
                <Icon icon="lock" class="h-3.5 w-3.5 shrink-0 text-accent-400" />
                <span class="font-medium">{{ admin.session?.userName }}</span>
                <Badge tone="red" class="shrink-0">Administrador</Badge>
              </RouterLink>
              <button type="button" class="btn-ghost shrink-0" @click="logoutAdmin">Salir</button>
            </template>
            <template v-else-if="auth.isAuthenticated && auth.account">
              <!-- Solo el icono, que nunca se encoge: con el menú completo ningún texto cabe sin cortarse. Quién eres y tu
                   equipo van en el título. -->
              <RouterLink
                :to="auth.profileRoute ?? '/ajustes'"
                class="btn-ghost shrink-0 px-2"
                :class="profileActive ? 'text-brand-500' : ''"
                :title="profileTitle"
                :aria-label="profileTitle"
              >
                <PlayerAvatar
                  v-if="profilePhoto"
                  :src="profilePhoto"
                  :name="auth.displayName"
                  size="xs"
                  decorative
                  :class="profileActive ? 'outline outline-2 outline-offset-2 outline-brand-500' : ''"
                />
                <Icon v-else icon="circle-user" class="h-5 w-5" />
              </RouterLink>
              <button type="button" class="btn-ghost shrink-0" @click="logout">Salir</button>
            </template>
            <template v-else>
              <RouterLink to="/login" class="btn-ghost shrink-0 whitespace-nowrap">Entrar</RouterLink>
              <RouterLink to="/registro" class="btn-primary shrink-0 whitespace-nowrap">Darme de alta</RouterLink>
            </template>
          </div>

          <button
            ref="burgerButton"
            type="button"
            class="btn-ghost hidden shrink-0 px-2 group-data-[burger]/hdr:inline-flex"
            :aria-label="menuOpen ? 'Cerrar el menú' : 'Abrir el menú'"
            :aria-expanded="menuOpen"
            aria-controls="app-menu"
            @click="menuOpen = !menuOpen"
          >
            <Icon :icon="menuOpen ? 'xmark' : 'bars'" class="h-5 w-5" />
          </button>
        </div>
      </div>

      <!-- Con poca altura (un móvil en horizontal) el menú se desplaza por dentro en lugar de salirse de la pantalla. -->
      <div v-if="menuOpen && burger" id="app-menu" class="max-h-[calc(100dvh-4rem)] overflow-y-auto border-t border-line bg-surface px-4 py-2">
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
        <RouterLink v-if="auth.profileRoute" :to="auth.profileRoute" class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-2" @click="menuOpen = false">Mi perfil</RouterLink>
        <!-- El jugador tiene los ajustes dentro de «Mi perfil». -->
        <RouterLink v-if="!auth.isPlayer" to="/ajustes" class="block rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-surface-2" @click="menuOpen = false">Ajustes</RouterLink>
        <!-- El menú sigue abierto al cambiar de tema: se ve el cambio y se puede deshacer. -->
        <button type="button" class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-surface-2" @click="settings.toggleTheme()">
          <ThemeIcon :dark="settings.isDark" class="h-4 w-4 shrink-0 text-slate-500" />{{ themeLabel }}
        </button>
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
    <div v-if="admin.isActive" class="border-b border-red-400/30 bg-red-500/10 px-4 py-2 text-center text-sm text-slate-700">
      <Icon icon="eye" class="mr-1.5 h-3.5 w-3.5 text-red-500" />
      <strong class="text-slate-900">Modo administrador:</strong> ves lo de todos los clubes, técnicos y jugadores solo para consultar; cada cuenta edita lo suyo.
      <RouterLink to="/jobs" class="ml-1 font-semibold text-accent-400 hover:underline">Ir a la administración</RouterLink>
    </div>
    <div v-if="!season.isCurrent && season.selected" class="border-b border-amber-400/40 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-700">
      Estás viendo la temporada <strong class="tabular-nums">{{ season.selected.label }}</strong>: solo consulta.
      <button type="button" class="ml-1 font-semibold underline hover:no-underline" @click="season.select(null)">
        Volver a la actual{{ season.current ? ` (${season.current.label})` : '' }}
      </button>
    </div>
    <LicenseBanner />
    <SearchPalette v-if="canSearch" />
    <ConfirmDialog />

    <main class="mx-auto w-full max-w-[1760px] flex-1 px-4 py-6 max-[360px]:px-2 sm:px-6 sm:py-8 lg:px-10" :class="consent.needsBanner ? 'pb-48 sm:pb-36 lg:pb-28' : ''">
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
