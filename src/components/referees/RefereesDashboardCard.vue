<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { api } from '@/api';
import { ApiError } from '@/api/http';
import StarRating from '@/components/referees/StarRating.vue';
import type { PendingRefereeRatingDto, RefereeSummaryDto } from '@/types/api';
import { formatDate, formatScore } from '@/utils/format';

/** Árbitros en el panel del club o del técnico: los partidos recientes con el equipo arbitral sin puntuar y los mejor valorados. */
const pending = shallowRef<PendingRefereeRatingDto[]>([]);
const referees = shallowRef<RefereeSummaryDto[]>([]);
const loaded = ref(false);
const unlicensed = ref(false);

onMounted(async () => {
  const [p, r] = await Promise.allSettled([api.referees.pending(), api.referees.list()]);
  if (p.status === 'fulfilled') pending.value = p.value;
  if (r.status === 'fulfilled') referees.value = r.value;
  else unlicensed.value = r.reason instanceof ApiError && r.reason.status === 403;
  loaded.value = true;
});

const best = computed(() => referees.value.filter((referee) => referee.ratings > 0).slice(0, 3));
</script>

<template>
  <section v-if="loaded" class="card">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="flag" class="h-4 w-4 text-amber-400" />Árbitros</h2>
      <RouterLink v-if="!unlicensed" :to="{ name: 'referees' }" class="text-xs font-medium text-accent-400 hover:underline">Ver todos</RouterLink>
    </div>

    <p v-if="unlicensed" class="mt-3 text-sm text-slate-500">
      Con la licencia vigente puedes puntuar al equipo arbitral de tus partidos y ver las notas que les ponen los demás clubes.
    </p>

    <template v-else>
      <div v-if="pending.length" class="mt-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Pendientes de puntuar</p>
        <ul class="mt-2 divide-y divide-line">
          <li v-for="item in pending" :key="`${item.match.id}-${item.teamId}`">
            <RouterLink
              :to="{ name: 'match', params: { matchId: item.match.id }, query: { tab: 'arbitros' } }"
              class="flex items-center justify-between gap-3 py-2 text-sm hover:text-accent-400"
            >
              <span class="min-w-0">
                <span class="block truncate font-medium text-slate-900">{{ item.match.homeTeam.name }} – {{ item.match.awayTeam.name }}</span>
                <span class="text-xs text-slate-500">Jornada {{ item.match.matchday }} · {{ formatDate(item.match.kickoffAt) }}</span>
              </span>
              <span class="shrink-0 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-500">
                {{ item.rated }}/{{ item.officials }} puntuados
              </span>
            </RouterLink>
          </li>
        </ul>
      </div>
      <p v-else class="mt-3 text-sm text-slate-500">No tienes equipos arbitrales pendientes de puntuar en el último mes.</p>

      <div v-if="best.length" class="mt-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Mejor valorados</p>
        <ul class="mt-2 space-y-2">
          <li v-for="referee in best" :key="referee.id" class="flex items-center justify-between gap-3 text-sm">
            <RouterLink :to="{ name: 'referee', params: { refereeId: referee.id } }" class="min-w-0 truncate font-medium text-slate-900 hover:text-accent-400">{{ referee.name }}</RouterLink>
            <span class="flex shrink-0 items-center gap-2 text-xs text-slate-500">
              <StarRating :score="referee.average" size="sm" />
              <strong class="font-figures text-slate-900">{{ formatScore(referee.average) }}</strong>
              ({{ referee.ratings }})
            </span>
          </li>
        </ul>
      </div>
    </template>
  </section>
</template>
