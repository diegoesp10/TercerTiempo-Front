<script setup lang="ts">
import { computed, watch } from 'vue';
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StarRating from '@/components/referees/StarRating.vue';
import RefereeRatingItem from '@/components/referees/RefereeRatingItem.vue';
import { useAsync } from '@/composables/useAsync';
import { formatDate, formatScore, officialRoleLabels } from '@/utils/format';

/** Ficha de un árbitro: sus partidos, la nota media que le ponen los equipos, cómo se reparten y sus comentarios. */
const props = defineProps<{ refereeId: string }>();
const { data, loading, error, run } = useAsync(() => api.referees.get(props.refereeId));
watch(() => props.refereeId, () => void run());

const maxBar = computed(() => Math.max(1, ...(data.value?.stats.distribution ?? [])));
</script>

<template>
  <div>
    <RouterLink :to="{ name: 'referees' }" class="text-sm text-slate-500 hover:text-slate-800">← Todos los árbitros</RouterLink>

    <Spinner v-if="loading && !data" class="my-12" />
    <Alert v-else-if="error" kind="error" class="mt-4">{{ error }}</Alert>

    <template v-else-if="data">
      <section class="card mt-3">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="eyebrow">Árbitro</p>
            <h1 class="text-2xl font-bold text-slate-900">{{ data.name }}</h1>
            <p class="mt-1 text-sm text-slate-500">
              {{ data.stats.matches === 1 ? '1 partido' : `${data.stats.matches} partidos` }} en Tercer Tiempo ·
              {{ data.stats.ratings === 1 ? '1 nota' : `${data.stats.ratings} notas` }} de los equipos
              <template v-if="data.profileUrl"> · <a :href="data.profileUrl" target="_blank" rel="noopener" class="text-accent-400 hover:underline">ficha en futbolasturiano.es</a></template>
            </p>
          </div>
          <div class="text-right">
            <p class="font-figures text-4xl font-extrabold text-slate-900">{{ formatScore(data.stats.average) }}<span class="text-base font-medium text-slate-500">/10</span></p>
            <StarRating :score="data.stats.average" size="lg" />
          </div>
        </div>

        <div class="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Reparto de notas</p>
            <ol class="mt-3 flex h-32 items-end gap-1.5" aria-label="Cuántas notas de cada valor">
              <li v-for="(count, score) in data.stats.distribution" :key="score" class="flex flex-1 flex-col items-center gap-1">
                <span class="text-[10px] font-semibold text-slate-500">{{ count || '' }}</span>
                <span
                  class="w-full rounded-t"
                  :class="score >= 7 ? 'bg-emerald-500' : score >= 5 ? 'bg-amber-400' : 'bg-red-500'"
                  :style="{ height: `${Math.max(count ? 6 : 2, (count / maxBar) * 88)}px`, opacity: count ? 1 : 0.25 }"
                  :title="`${count} ${count === 1 ? 'nota' : 'notas'} de ${score}`"
                />
                <span class="font-figures text-[11px] text-slate-500">{{ score }}</span>
              </li>
            </ol>
          </div>
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Por función</p>
            <ul class="mt-3 divide-y divide-line rounded-xl border border-line">
              <li v-for="role in data.byRole" :key="role.role" class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span class="font-medium text-slate-800">{{ officialRoleLabels[role.role] }}</span>
                <span class="flex items-center gap-2 text-xs text-slate-500">
                  {{ role.matches === 1 ? '1 partido' : `${role.matches} partidos` }} · {{ role.ratings === 1 ? '1 nota' : `${role.ratings} notas` }}
                  <StarRating :score="role.average" size="sm" />
                  <strong class="font-figures text-slate-900">{{ formatScore(role.average) }}</strong>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-if="data.best.length" class="mt-6">
        <h2 class="text-lg font-bold text-slate-900">Mejores notas</h2>
        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <RefereeRatingItem v-for="rating in data.best" :key="`${rating.matchId}-${rating.teamId}`" :rating="rating" />
        </div>
      </section>

      <section class="mt-6">
        <h2 class="text-lg font-bold text-slate-900">Todas las notas</h2>
        <p v-if="data.ratings.length === 0" class="card mt-3 text-sm text-slate-500">Ningún equipo le ha puntuado todavía.</p>
        <div v-else class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <RefereeRatingItem v-for="rating in data.ratings" :key="`${rating.matchId}-${rating.teamId}`" :rating="rating" />
        </div>
      </section>

      <section class="mt-6">
        <h2 class="text-lg font-bold text-slate-900">Partidos</h2>
        <ul class="card mt-3 divide-y divide-line p-0">
          <li v-for="game in data.matches" :key="game.match.id" class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
            <RouterLink :to="{ name: 'match', params: { matchId: game.match.id } }" class="min-w-0 hover:text-accent-400">
              <span class="font-medium text-slate-900">{{ game.match.homeTeam.name }} {{ game.match.homeGoals ?? '' }} – {{ game.match.awayGoals ?? '' }} {{ game.match.awayTeam.name }}</span>
              <span class="block text-xs text-slate-500">Jornada {{ game.match.matchday }} · {{ formatDate(game.match.kickoffAt) }} · {{ officialRoleLabels[game.role].toLowerCase() }}</span>
            </RouterLink>
            <span class="flex items-center gap-2 text-xs text-slate-500">
              <StarRating :score="game.average" size="sm" />
              {{ game.ratings === 0 ? 'sin notas' : game.ratings === 1 ? '1 nota' : `${game.ratings} notas` }}
            </span>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
