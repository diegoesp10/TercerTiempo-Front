<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink, type RouteLocationRaw } from 'vue-router';
import TeamName from '@/components/teams/TeamName.vue';
import type { MatchDto } from '@/types/api';
import { formatDayHeading, formatDaysUntil, formatTime } from '@/utils/format';

/**
 * El próximo partido de un equipo, destacado encima de sus listas: la jornada en grande, el rival, cuándo falta y dónde.
 * Si ya se está jugando, lo dice. Lo que añade cada vista (convocatoria, previa, la jornada entera) va en los huecos.
 */
const props = defineProps<{
  match: MatchDto;
  /** Equipo desde cuyo punto de vista se enseña (rival y localía). */
  teamId: string;
  /** Adónde lleva el rival: por defecto, a la página del partido; con null no es enlace (las acciones van en el hueco). */
  to?: RouteLocationRaw | null;
}>();

const isHome = computed(() => props.match.homeTeam.id === props.teamId);
const opponent = computed(() => (isHome.value ? props.match.awayTeam : props.match.homeTeam));
const live = computed(() => props.match.status === 'InProgress');
const target = computed<RouteLocationRaw | null>(() => (props.to === undefined ? { name: 'match', params: { matchId: props.match.id } } : props.to));
</script>

<template>
  <section class="flex flex-wrap items-center gap-4 rounded-xl border border-accent-400/30 bg-brand-500/10 p-4">
    <!-- En el móvil la jornada va en la línea de arriba: sola en su fila quedaba descolgada. -->
    <div class="hidden w-16 shrink-0 text-center sm:block">
      <p class="text-xs uppercase text-accent-400">Jornada</p>
      <p class="font-display text-3xl font-bold text-slate-900">{{ match.matchday }}</p>
    </div>
    <div class="min-w-0 flex-1 basis-56">
      <p class="flex flex-wrap items-baseline justify-between gap-x-3 text-xs font-semibold uppercase tracking-wide text-own">
        <span v-if="live">En juego</span>
        <span v-else>Próximo partido · {{ formatDaysUntil(match.kickoffAt) }}</span>
        <span class="text-accent-400 sm:hidden">Jornada {{ match.matchday }}</span>
      </p>
      <!-- Un rival de nombre largo baja de línea antes que cortarse. -->
      <component
        :is="target ? RouterLink : 'p'"
        :to="target ?? undefined"
        class="flex min-w-0 flex-wrap items-center gap-x-2 text-lg font-semibold text-slate-900"
        :class="target ? 'hover:text-accent-400' : ''"
      >
        <TeamName :name="opponent.name" :crest-url="opponent.crestUrl" :short-name="opponent.shortName" size="sm">
          <span class="text-slate-400">vs</span> {{ opponent.name }}
        </TeamName>
        <span class="text-sm font-normal" :class="isHome ? 'text-own' : 'text-slate-500'">{{ isHome ? 'en casa' : 'fuera' }}</span>
      </component>
      <p class="text-sm text-slate-600">{{ formatDayHeading(match.kickoffAt) }} · {{ formatTime(match.kickoffAt) }}<span v-if="match.venue"> · {{ match.venue }}</span></p>
      <div v-if="$slots.badges" class="mt-2 flex flex-wrap items-center gap-2"><slot name="badges" /></div>
    </div>
    <div v-if="$slots.actions" class="flex w-full flex-wrap gap-2 sm:w-auto"><slot name="actions" /></div>
  </section>
</template>
