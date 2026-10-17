<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import CoachHomeView from '@/views/coach/CoachHomeView.vue';
import PlayerDashboardView from '@/views/player/PlayerDashboardView.vue';

const auth = useAuthStore();
</script>

<template>
  <CoachHomeView v-if="auth.isCoach" />
  <PlayerDashboardView v-else-if="auth.isPlayer" />

  <div v-else class="py-6">
    <section class="mx-auto max-w-3xl text-center">
      <p class="text-sm font-semibold uppercase tracking-wide text-emerald-700">Fútbol amateur asturiano</p>
      <h1 class="mt-2 text-4xl font-bold tracking-tight text-slate-900">El acta de cada partido, convertida en estadísticas</h1>
      <p class="mt-4 text-lg text-slate-600">
        El cuerpo técnico registra el rendimiento de cada jugador partido a partido. Cada jugador ve sus números, lo que
        aporta a su equipo y cómo se compara con la liga. Los datos de cada plantilla son privados salvo que su cuerpo
        técnico decida compartirlos.
      </p>
      <div class="mt-6 flex flex-wrap justify-center gap-3">
        <RouterLink to="/registro" class="btn-primary">Darme de alta</RouterLink>
        <RouterLink to="/login" class="btn-secondary">Ya tengo cuenta</RouterLink>
      </div>
    </section>

    <section class="mx-auto mt-12 grid max-w-4xl gap-4 md:grid-cols-2">
      <div class="card">
        <p class="text-xs font-semibold uppercase tracking-wide text-sky-700">Cuerpo técnico</p>
        <h2 class="mt-1 text-lg font-semibold text-slate-900">Lleva la plantilla de tu equipo</h2>
        <ol class="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Date de alta como cuerpo técnico y busca tu equipo en su liga y grupo.</li>
          <li>Crea su plantilla: se importa la publicada por futbolasturiano.es y puedes completarla a mano.</li>
          <li>Comparte el código de invitación con el resto del staff y con los jugadores.</li>
          <li>Tras cada partido, rellena el acta: minutos, goles, asistencias, tarjetas y valoración de cada jugador.</li>
        </ol>
      </div>
      <div class="card">
        <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Jugador</p>
        <h2 class="mt-1 text-lg font-semibold text-slate-900">Sigue tu temporada</h2>
        <ol class="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Date de alta como jugador con el nombre con el que apareces en la plantilla.</li>
          <li>Vincúlate a tu ficha con el código de invitación que te da tu cuerpo técnico.</li>
          <li>Consulta tus estadísticas, tu impacto en los resultados y tu posición frente a la liga.</li>
        </ol>
      </div>
    </section>

    <p class="mt-10 text-center text-sm text-slate-500">
      Sin cuenta también puedes consultar los <RouterLink to="/equipos" class="font-medium text-emerald-700 hover:underline">equipos</RouterLink>,
      sus calendarios y la <RouterLink to="/liga" class="font-medium text-emerald-700 hover:underline">clasificación</RouterLink> de cada liga.
    </p>
  </div>
</template>
