<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import HomePredictorShowcase from '@/components/home/HomePredictorShowcase.vue';
import HomeRefereesShowcase from '@/components/home/HomeRefereesShowcase.vue';
import HeroMatchday from '@/components/matches/HeroMatchday.vue';
import { useAuthStore } from '@/stores/auth';

// Cada cuenta solo descarga su panel: el del jugador trae ECharts y la portada sin sesión no lo necesita.
const ClubHomeView = defineAsyncComponent(() => import('@/views/club/ClubHomeView.vue'));
const CoachHomeView = defineAsyncComponent(() => import('@/views/coach/CoachHomeView.vue'));
const PlayerDashboardView = defineAsyncComponent(() => import('@/views/player/PlayerDashboardView.vue'));

const auth = useAuthStore();

const highlights = [
  { value: '10', label: 'ligas, de 1ª RFEF a 3ª AsturFútbol' },
  { value: '10.000', label: 'simulaciones por jornada en el previsor' },
  { value: '0–10', label: 'nota pública de cada equipo a sus árbitros' },
  { value: '3,0–10', label: 'nota del jugador, solo con datos' },
];

const roles = [
  {
    icon: 'shield-halved',
    eyebrow: 'Club',
    title: 'Da de alta a tus técnicos',
    steps: [
      'Date de alta como club y vincula tus equipos (los de futbolasturiano.es).',
      'Nombra a cada técnico para un equipo y una temporada: obtienes un código de acceso.',
      'Prorroga, acorta o revoca el nombramiento cuando quieras.',
      'Puntúa al equipo arbitral de tus partidos: nota definitiva y pública, con su porqué.',
    ],
  },
  {
    icon: 'clipboard-list',
    eyebrow: 'Cuerpo técnico',
    title: 'Lleva la plantilla de tu equipo',
    steps: [
      'Entra con el código de acceso de tu club: tu plantilla te espera.',
      'Tras cada partido rellena el acta interna y compárala con la pública.',
      'Sube el vídeo del partido; genera un código personal para cada jugador.',
      'Pon nota al árbitro y a sus asistentes en nombre de tu equipo.',
    ],
  },
  {
    icon: 'user',
    eyebrow: 'Jugador',
    title: 'Sigue tu temporada',
    steps: [
      'Pide a tu club o entrenador el código personal de tu ficha.',
      'Date de alta con ese código: la cuenta se crea con tu nombre y ya es tu ficha.',
      'Tus estadísticas, tu impacto en los resultados y tu posición en la liga.',
      'Mira en el previsor las opciones de tu equipo de subir o de salvarse.',
    ],
  },
];

const explore = [
  { icon: 'list-ol', title: 'Clasificación y jornada', text: 'Resultados, calendario y la tabla con las plazas reales de ascenso y descenso.', to: { name: 'league' } },
  { icon: 'chart-line', title: 'Previsor de resultados', text: 'Probabilidad de título, ascenso y descenso de cada equipo, jornada a jornada.', to: { name: 'league', query: { vista: 'previsor' } } },
  { icon: 'flag', title: 'Árbitros', text: 'Notas de los dos equipos, medias y partidos pitados, por categoría y función.', to: { name: 'referees' } },
  { icon: 'users', title: 'Equipos', text: 'Plantillas, calendarios y el acta oficial de cada partido.', to: { name: 'teams' } },
];
</script>

<template>
  <CoachHomeView v-if="auth.isCoach" />
  <PlayerDashboardView v-else-if="auth.isPlayer" />
  <ClubHomeView v-else-if="auth.isClub" />

  <div v-else class="space-y-14 pb-10 lg:space-y-20">
    <!-- Hero -->
    <section class="grid grid-cols-1 items-center gap-10 pt-6 lg:grid-cols-12 lg:pt-12">
      <div class="lg:col-span-7">
        <p class="eyebrow">Rendimiento partido a partido</p>
        <h1 class="mt-3 break-words text-4xl font-extrabold leading-[0.95] text-slate-900 sm:text-6xl lg:text-7xl">
          El acta de cada partido,<br />convertida en estadísticas.
        </h1>
        <p class="mt-6 max-w-xl text-lg text-slate-600">
          Registra el acta de cada partido, contrástala con la oficial y sigue a cada jugador jornada a jornada. Y sin
          cuenta: la clasificación con sus plazas reales, el previsor de resultados y las notas de los árbitros.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <RouterLink to="/registro" class="btn-primary px-6 py-3 text-base">Darme de alta</RouterLink>
          <RouterLink :to="{ name: 'league', query: { vista: 'previsor' } }" class="btn-secondary px-6 py-3 text-base">
            <Icon icon="chart-line" class="h-4 w-4" />Previsor
          </RouterLink>
          <RouterLink :to="{ name: 'referees' }" class="btn-secondary px-6 py-3 text-base">
            <Icon icon="flag" class="h-4 w-4" />Árbitros
          </RouterLink>
          <RouterLink to="/precios" class="btn-ghost px-6 py-3 text-base">Precios</RouterLink>
        </div>
        <dl class="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
          <div v-for="item in highlights" :key="item.label" class="rounded-lg border border-line bg-surface px-4 py-3">
            <dt class="font-figures text-2xl font-extrabold text-slate-900 sm:text-3xl">{{ item.value }}</dt>
            <dd class="mt-0.5 text-xs text-slate-500">{{ item.label }}</dd>
          </div>
        </dl>
      </div>

      <div class="w-full lg:col-span-5">
        <HeroMatchday />
      </div>
    </section>

    <HomePredictorShowcase />

    <HomeRefereesShowcase />

    <!-- Roles -->
    <section>
      <div class="max-w-2xl">
        <p class="eyebrow">Con cuenta</p>
        <h2 class="mt-2 text-balance text-2xl font-extrabold leading-tight text-slate-900 sm:text-3xl">Club, cuerpo técnico y jugadores: cada uno, con lo suyo.</h2>
      </div>
      <div class="mt-6 grid grid-cols-1 gap-5 md:grid-cols-3">
        <article v-for="role in roles" :key="role.eyebrow" class="card flex flex-col">
          <div class="flex items-center gap-3">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
              <Icon :icon="role.icon" class="h-4 w-4" />
            </span>
            <p class="eyebrow">{{ role.eyebrow }}</p>
          </div>
          <h3 class="mt-4 text-2xl font-bold text-slate-900">{{ role.title }}</h3>
          <ol class="mt-4 space-y-2.5 text-sm text-slate-600">
            <li v-for="(step, index) in role.steps" :key="index" class="flex gap-3">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-display text-xs font-bold text-brand-500">{{ index + 1 }}</span>
              <span>{{ step }}</span>
            </li>
          </ol>
        </article>
      </div>
    </section>

    <!-- Lo público -->
    <section class="card lg:p-8">
      <div class="flex flex-wrap items-end justify-between gap-6">
        <div class="max-w-3xl">
          <p class="eyebrow">Datos reales, cada jornada</p>
          <h2 class="mt-2 text-balance text-2xl font-bold text-slate-900">Calendario, resultados y actas oficiales de 1ª, 2ª y 3ª RFEF y 1ª, 2ª y 3ª AsturFútbol</h2>
          <p class="mt-3 text-sm text-slate-600">
            Sin cuenta puedes consultar todo lo público. Con cuenta, el acta interna de tu plantilla, sus estadísticas y la
            nota a los árbitros de tus partidos.
          </p>
        </div>
        <RouterLink to="/registro" class="btn-primary">Darme de alta</RouterLink>
      </div>
      <div class="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RouterLink
          v-for="item in explore"
          :key="item.title"
          :to="item.to"
          class="group flex flex-col rounded-xl border border-line bg-surface-2 p-4 transition hover:border-brand-400/60"
        >
          <span class="flex items-center justify-between">
            <span class="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-500/10 text-brand-500">
              <Icon :icon="item.icon" class="h-4 w-4" />
            </span>
            <Icon icon="chevron-right" class="h-3 w-3 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-brand-500" />
          </span>
          <span class="mt-3 font-bold text-slate-900">{{ item.title }}</span>
          <span class="mt-1 text-sm text-slate-600">{{ item.text }}</span>
        </RouterLink>
      </div>
    </section>
  </div>
</template>
