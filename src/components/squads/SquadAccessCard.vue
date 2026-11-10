<script setup lang="ts">
import TeamCrest from '@/components/teams/TeamCrest.vue';

/**
 * Acceso destacado a la plantilla de un equipo: es donde trabajan el cuerpo técnico y el club, así que va lo primero
 * al entrar, con un botón grande y accesos directos a partidos y actas, estadísticas y comparador.
 */
defineProps<{
  squadId: string;
  teamName: string;
  teamShortName?: string;
  crestUrl: string | null;
  /** Liga y temporada. */
  subtitle?: string | null;
}>();
</script>

<template>
  <article class="my-club-row flex flex-col gap-5 rounded-2xl border border-accent-400/40 p-5 shadow-card sm:p-6">
    <div class="flex items-center gap-4">
      <TeamCrest :src="crestUrl" :name="teamName" :short-name="teamShortName" size="lg" />
      <div class="min-w-0 flex-1">
        <p class="eyebrow">Gestión de plantilla</p>
        <h2 class="truncate font-display text-2xl font-extrabold text-slate-900">{{ teamName }}</h2>
        <p v-if="subtitle" class="text-sm text-slate-500">{{ subtitle }}</p>
        <div v-if="$slots.badges" class="mt-2 flex flex-wrap items-center gap-2"><slot name="badges" /></div>
      </div>
    </div>

    <RouterLink
      :to="{ name: 'squad', params: { squadId } }"
      class="btn-primary justify-center py-3 text-base"
    >
      <Icon icon="user-group" class="mr-2 h-4 w-4" />Gestionar plantilla
    </RouterLink>

    <nav class="grid grid-cols-1 gap-2 sm:grid-cols-3" aria-label="Accesos de la plantilla">
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
  </article>
</template>
