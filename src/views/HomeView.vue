<script setup lang="ts">
import HeroMatchday from '@/components/matches/HeroMatchday.vue';
import { useAuthStore } from '@/stores/auth';
import ClubHomeView from '@/views/club/ClubHomeView.vue';
import CoachHomeView from '@/views/coach/CoachHomeView.vue';
import PlayerDashboardView from '@/views/player/PlayerDashboardView.vue';

const auth = useAuthStore();

const roles = [
  {
    eyebrow: 'Club',
    title: 'Da de alta a tus técnicos',
    steps: [
      'Date de alta como club y vincula tus equipos (los de futbolasturiano.es).',
      'Nombra a cada técnico para un equipo y una temporada: obtienes un código de acceso.',
      'Prorroga, acorta o revoca el nombramiento cuando quieras.',
    ],
  },
  {
    eyebrow: 'Cuerpo técnico',
    title: 'Lleva la plantilla de tu equipo',
    steps: [
      'Entra con el código de acceso de tu club: tu plantilla te espera.',
      'Tras cada partido rellena el acta y compárala con la de la federación.',
      'Sube el vídeo del partido; genera un código personal para cada jugador.',
    ],
  },
  {
    eyebrow: 'Jugador',
    title: 'Sigue tu temporada',
    steps: [
      'Pide a tu club o entrenador el código personal de tu ficha.',
      'Date de alta con ese código: la cuenta se crea con tu nombre y ya es tu ficha.',
      'Tus estadísticas, tu impacto en los resultados y tu posición en la liga.',
    ],
  },
];

const highlights = [
  { value: '10', label: 'ligas: semiprofesionales nacionales y toda la regional asturiana' },
  { value: '3,0 – 10', label: 'nota calculada solo con datos' },
  { value: '1:1', label: 'acta interna frente a la oficial' },
];
</script>

<template>
  <CoachHomeView v-if="auth.isCoach" />
  <PlayerDashboardView v-else-if="auth.isPlayer" />
  <ClubHomeView v-else-if="auth.isClub" />

  <div v-else class="pb-10">
    <!-- Hero -->
    <section class="grid items-center gap-10 py-6 lg:grid-cols-12 lg:py-12">
      <div class="lg:col-span-7">
        <p class="eyebrow">Rendimiento partido a partido</p>
        <h1 class="mt-3 text-5xl font-extrabold leading-[0.95] text-slate-900 sm:text-6xl lg:text-7xl">
          El acta de cada partido,<br />convertida en estadísticas.
        </h1>
        <p class="mt-6 max-w-xl text-lg text-slate-600">
          Registra el acta de cada partido, contrástala con la oficial y sigue el rendimiento de cada jugador jornada a
          jornada. Cada plantilla decide qué comparte.
        </p>
        <div class="mt-8 flex flex-wrap gap-3">
          <RouterLink to="/registro" class="btn-primary px-6 py-3 text-base">Darme de alta</RouterLink>
          <RouterLink to="/liga" class="btn-secondary px-6 py-3 text-base">Ver la jornada</RouterLink>
        </div>
        <dl class="mt-10 grid max-w-xl grid-cols-3 gap-3">
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

    <!-- Roles -->
    <section class="mt-6 grid gap-5 md:grid-cols-3">
      <article v-for="role in roles" :key="role.eyebrow" class="card">
        <p class="eyebrow">{{ role.eyebrow }}</p>
        <h2 class="mt-2 text-2xl font-bold text-slate-900">{{ role.title }}</h2>
        <ol class="mt-4 space-y-2.5 text-sm text-slate-600">
          <li v-for="(step, index) in role.steps" :key="index" class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-display text-xs font-bold text-brand-500">{{ index + 1 }}</span>
            <span>{{ step }}</span>
          </li>
        </ol>
      </article>
    </section>

    <!-- Banda de datos -->
    <section class="card mt-8 lg:p-8">
      <div class="grid items-center gap-6 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <p class="eyebrow">Datos reales, cada jornada</p>
          <h2 class="mt-2 text-2xl font-bold text-slate-900">Calendario, resultados y actas oficiales de 1ª, 2ª y 3ª RFEF y 1ª, 2ª y 3ª AsturFútbol</h2>
          <p class="mt-3 text-sm text-slate-600">
            Sin cuenta puedes consultar los equipos, sus calendarios, la clasificación y el acta oficial de cada partido.
            Con cuenta, el acta interna de tu plantilla y sus estadísticas.
          </p>
        </div>
        <div class="flex flex-wrap gap-3 lg:justify-end">
          <RouterLink to="/equipos" class="btn-secondary">Equipos</RouterLink>
          <RouterLink to="/liga" class="btn-primary">Clasificación y jornada</RouterLink>
        </div>
      </div>
    </section>
  </div>
</template>
