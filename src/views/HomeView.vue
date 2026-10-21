<script setup lang="ts">
import { defineAsyncComponent, onMounted, ref } from 'vue';
import gsap from 'gsap';
import { useAuthStore } from '@/stores/auth';
import { whenIdle } from '@/utils/idle';
import ClubHomeView from '@/views/club/ClubHomeView.vue';
import CoachHomeView from '@/views/coach/CoachHomeView.vue';
import PlayerDashboardView from '@/views/player/PlayerDashboardView.vue';

const auth = useAuthStore();

// El balón 3D (Three.js) solo se descarga en la portada pública, y cuando el navegador ya ha pintado lo importante.
const BallScene = defineAsyncComponent(() => whenIdle().then(() => import('@/components/three/BallScene.vue')));

const hero = ref<HTMLElement | null>(null);

onMounted(() => {
  if (!hero.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  gsap.from(hero.value.querySelectorAll('[data-reveal]'), { y: 24, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1, delay: 0.1 });
  gsap.from(hero.value.querySelector('[data-ball]'), { scale: 0.7, opacity: 0, duration: 1.1, ease: 'expo.out', delay: 0.3 });
});

const roles = [
  {
    tone: 'from-amber-400/30 to-transparent text-amber-700',
    eyebrow: 'Club',
    title: 'Da de alta a tus técnicos',
    steps: [
      'Date de alta como club y vincula tus equipos (los de futbolasturiano.es).',
      'Nombra a cada técnico para un equipo y una temporada: obtienes un código de acceso.',
      'Prorroga, acorta o revoca el nombramiento cuando quieras.',
    ],
  },
  {
    tone: 'from-brand-400/30 to-transparent text-brand-300',
    eyebrow: 'Cuerpo técnico',
    title: 'Lleva la plantilla de tu equipo',
    steps: [
      'Entra con el código de acceso de tu club: tu plantilla te espera.',
      'Tras cada partido rellena el acta y compárala con la de la federación.',
      'Sube el vídeo del partido; comparte el código de invitación con los jugadores.',
    ],
  },
  {
    tone: 'from-emerald-400/30 to-transparent text-emerald-700',
    eyebrow: 'Jugador',
    title: 'Sigue tu temporada',
    steps: [
      'Date de alta con el nombre con el que apareces en la plantilla.',
      'Vincúlate a tu ficha con el código de tu cuerpo técnico.',
      'Tus estadísticas, tu impacto en los resultados y tu posición en la liga.',
    ],
  },
];

const highlights = [
  { value: '10', label: 'ligas asturianas sincronizadas' },
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
    <section ref="hero" class="grid items-center gap-10 py-6 lg:grid-cols-12 lg:py-14">
      <div class="lg:col-span-7">
        <p data-reveal class="eyebrow">Fútbol amateur asturiano</p>
        <h1 data-reveal class="mt-4 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
          <span class="text-white">El acta de cada partido,</span><br />
          <span class="text-gradient">convertida en estadísticas.</span>
        </h1>
        <p data-reveal class="mt-6 max-w-xl text-lg text-slate-600">
          El club nombra a su cuerpo técnico cada temporada; el cuerpo técnico registra el rendimiento de cada jugador y
          lo contrasta con el acta oficial de la federación. Cada jugador ve sus números. Cada plantilla decide qué comparte.
        </p>
        <div data-reveal class="mt-8 flex flex-wrap gap-3">
          <RouterLink to="/registro" class="btn-primary px-6 py-3 text-base">Darme de alta</RouterLink>
          <RouterLink to="/liga" class="btn-secondary px-6 py-3 text-base">Ver la jornada</RouterLink>
        </div>
        <dl data-reveal class="mt-10 grid max-w-xl grid-cols-3 gap-3">
          <div v-for="item in highlights" :key="item.label" class="rounded-2xl border border-white/8 bg-white/4 px-4 py-3 backdrop-blur">
            <dt class="font-display text-2xl font-bold text-white">{{ item.value }}</dt>
            <dd class="mt-0.5 text-xs text-slate-500">{{ item.label }}</dd>
          </div>
        </dl>
      </div>

      <div data-ball class="relative mx-auto aspect-square w-full max-w-md lg:col-span-5">
        <div class="absolute inset-8 rounded-full bg-brand-500/30 blur-3xl" />
        <div class="absolute inset-0 rounded-full border border-white/6" />
        <div class="absolute inset-6 rounded-full border border-dashed border-accent-400/20 animate-[spin_40s_linear_infinite]" />
        <BallScene :zoom="1" />
      </div>
    </section>

    <!-- Roles -->
    <section class="mt-6 grid gap-5 md:grid-cols-3">
      <article v-for="role in roles" :key="role.eyebrow" class="card overflow-hidden">
        <span class="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b" :class="role.tone.split(' ').slice(0, 2).join(' ')" />
        <p class="relative text-xs font-bold uppercase tracking-[0.2em]" :class="role.tone.split(' ')[2]">{{ role.eyebrow }}</p>
        <h2 class="relative mt-2 text-lg font-bold text-white">{{ role.title }}</h2>
        <ol class="relative mt-4 space-y-2.5 text-sm text-slate-600">
          <li v-for="(step, index) in role.steps" :key="index" class="flex gap-3">
            <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/6 font-display text-xs font-bold text-white">{{ index + 1 }}</span>
            <span>{{ step }}</span>
          </li>
        </ol>
      </article>
    </section>

    <!-- Banda de datos -->
    <section class="mt-10 overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-r from-brand-700/40 via-navy-900 to-emerald-900/10 p-8 shadow-card lg:p-10">
      <div class="grid items-center gap-8 lg:grid-cols-3">
        <div class="lg:col-span-2">
          <p class="eyebrow">Datos reales, cada jornada</p>
          <h2 class="mt-3 text-2xl font-bold text-white">Calendario, resultados y actas oficiales de 1ª, 2ª y 3ª RFEF y 1ª, 2ª y 3ª AsturFútbol</h2>
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
