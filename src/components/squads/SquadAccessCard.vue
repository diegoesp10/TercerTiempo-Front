<script setup lang="ts">
import { useRouter } from 'vue-router';
import { api } from '@/api';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import AgendaList from '@/components/trainings/AgendaList.vue';
import { useAsync } from '@/composables/useAsync';
import type { TrainingSummaryDto } from '@/types/api';
import { toDateKey } from '@/utils/format';

/**
 * Acceso destacado a la plantilla de un equipo: es donde trabajan el cuerpo técnico y el club, así que va lo primero
 * al entrar, con dos botones grandes (la plantilla y su agenda), lo próximo de la agenda (entrenamientos y partidos,
 * cada uno abre lo suyo) y accesos directos a partidos y actas, estadísticas y comparador.
 */
const props = defineProps<{
  squadId: string;
  /** Equipo de la plantilla, para saber quién es el rival en la agenda. */
  teamId: string;
  teamName: string;
  teamShortName?: string;
  crestUrl: string | null;
  /** Liga y temporada. */
  subtitle?: string | null;
}>();

const router = useRouter();

// Lo que queda en las tres semanas que vienen: entrenamientos y partidos, los cuatro primeros.
function shiftDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
const agenda = useAsync(() => api.trainings.agenda(props.squadId, shiftDays(0), shiftDays(21)), { redirectOnError: false });

function openTraining(session: TrainingSummaryDto) {
  void router.push({ name: 'squad-trainings', params: { squadId: props.squadId }, query: { sesion: session.id } });
}
</script>

<template>
  <article class="my-club-row flex flex-col gap-5 rounded-2xl border border-accent-400/40 p-5 shadow-card sm:p-6">
    <div class="flex items-center gap-4">
      <TeamCrest :src="crestUrl" :name="teamName" :short-name="teamShortName" size="lg" />
      <div class="min-w-0 flex-1">
        <p class="eyebrow">Gestión de plantilla</p>
        <h2 class="min-w-0 break-words font-display text-2xl font-extrabold text-slate-900">{{ teamName }}</h2>
        <p v-if="subtitle" class="text-sm text-slate-500">{{ subtitle }}</p>
        <div v-if="$slots.badges" class="mt-2 flex flex-wrap items-center gap-2"><slot name="badges" /></div>
      </div>
    </div>

    <!-- Lo que más se usa, en grande y a la par. La fila mira el ancho de la tarjeta (@container), no el de la pantalla:
         con dos plantillas en paralelo o en el móvil, un botón encima del otro si no caben los dos. -->
    <div class="@container">
      <nav class="grid grid-cols-1 gap-3 @md:grid-cols-2" aria-label="Plantilla y agenda">
        <RouterLink :to="{ name: 'squad', params: { squadId } }" class="btn-primary justify-center py-3 text-base">
          <Icon icon="user-group" class="mr-2 h-4 w-4" />Gestionar plantilla
        </RouterLink>
        <RouterLink :to="{ name: 'squad-trainings', params: { squadId } }" class="btn-primary justify-center py-3 text-base">
          <Icon icon="calendar-check" class="mr-2 h-4 w-4" />Agenda
        </RouterLink>
      </nav>
    </div>

    <section class="rounded-xl border border-line bg-surface-2/40 p-3" aria-label="Agenda">
      <h3 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Agenda · lo próximo</h3>
      <p v-if="agenda.loading.value && !agenda.data.value" class="py-2 text-sm text-slate-500">Cargando…</p>
      <p v-else-if="agenda.error.value" class="py-2 text-sm text-slate-500">No se ha podido cargar la agenda.</p>
      <p v-else-if="!(agenda.data.value ?? []).some((i) => !i.done)" class="py-2 text-sm text-slate-500">Ni entrenamientos ni partidos en las próximas tres semanas.</p>
      <AgendaList v-else compact :items="(agenda.data.value ?? []).filter((i) => !i.done).slice(0, 4)" :squad-id="squadId" :team-id="teamId" can-manage @training="openTraining" />
    </section>

    <!-- Los tres en fila solo si cada uno cabe en una línea («Partidos y actas» pide unos 165 px): mira el ancho de la
         tarjeta (@container), no el de la pantalla; si no, uno debajo de otro. -->
    <div class="@container">
      <nav class="grid grid-cols-1 gap-2 @xl:grid-cols-3" aria-label="Accesos de la plantilla">
        <RouterLink :to="{ name: 'squad-matches', params: { squadId } }" class="btn-secondary justify-center">
          <Icon icon="clipboard-list" class="mr-1.5 h-3.5 w-3.5" />Partidos y actas
        </RouterLink>
        <RouterLink :to="{ name: 'squad-stats', params: { squadId } }" class="btn-secondary justify-center">
          <Icon icon="chart-line" class="mr-1.5 h-3.5 w-3.5" />Estadísticas
        </RouterLink>
        <RouterLink :to="{ name: 'squad-compare', params: { squadId } }" class="btn-secondary justify-center">
          <Icon icon="arrow-right-arrow-left" class="mr-1.5 h-3.5 w-3.5" />Comparador
        </RouterLink>
      </nav>
    </div>
  </article>
</template>
