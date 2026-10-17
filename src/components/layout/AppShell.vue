<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const menuOpen = ref(false);

const links = [
  { to: '/', label: 'Panel', auth: true },
  { to: '/partidos', label: 'Partidos', auth: true },
  { to: '/equipos', label: 'Equipos', auth: false },
  { to: '/liga', label: 'Liga', auth: false },
];

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
          <template v-for="link in links" :key="link.to">
            <RouterLink
              v-if="!link.auth || auth.isAuthenticated"
              :to="link.to"
              class="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              active-class="bg-emerald-50 text-emerald-700"
            >
              {{ link.label }}
            </RouterLink>
          </template>
        </nav>

        <div class="hidden items-center gap-2 md:flex">
          <template v-if="auth.isAuthenticated && auth.player">
            <span class="text-sm text-slate-600">
              {{ auth.player.displayName }}
              <span v-if="auth.membership" class="text-slate-400">· {{ auth.membership.teamShortName }}</span>
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
        <template v-for="link in links" :key="link.to">
          <RouterLink
            v-if="!link.auth || auth.isAuthenticated"
            :to="link.to"
            class="block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
            @click="menuOpen = false"
          >
            {{ link.label }}
          </RouterLink>
        </template>
        <div class="mt-2 border-t border-slate-100 pt-2">
          <button v-if="auth.isAuthenticated" type="button" class="btn-ghost w-full" @click="logout">Salir</button>
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
      Tercer Tiempo · seguimiento de rendimiento para fútbol amateur
    </footer>
  </div>
</template>
