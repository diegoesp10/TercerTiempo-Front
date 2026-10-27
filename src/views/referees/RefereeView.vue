<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StarRating from '@/components/referees/StarRating.vue';
import RefereeRatingItem from '@/components/referees/RefereeRatingItem.vue';
import TeamRatingItem from '@/components/referees/TeamRatingItem.vue';
import { useAsync } from '@/composables/useAsync';
import type { RefereeMatchDto } from '@/types/api';
import { formatDate, formatScore, officialDutyLabels, officialRoleLabels } from '@/utils/format';

/**
 * Ficha pública de un árbitro: la nota media que le ponen los equipos y cómo se reparte, sus cifras en cada categoría
 * como principal y como asistente, y cada partido con la nota de los dos equipos, quién la puso y por qué. Se puede ver
 * de una sola categoría (?categoria=).
 */
const props = defineProps<{ refereeId: string }>();
const route = useRoute();
const router = useRouter();
const { data, loading, error, run } = useAsync(() => api.referees.get(props.refereeId));
watch(() => props.refereeId, () => void run());

const maxBar = computed(() => Math.max(1, ...(data.value?.stats.distribution ?? [])));

const categories = computed(() => {
  const seen = new Map<string, string>();
  for (const row of data.value?.byCategory ?? []) if (!seen.has(row.categoryKey)) seen.set(row.categoryKey, row.category);
  return [...seen].map(([key, name]) => ({ key, name }));
});
const only = computed(() => {
  const wanted = typeof route.query.categoria === 'string' ? route.query.categoria : null;
  return categories.value.length > 1 && categories.value.some((c) => c.key === wanted) ? wanted : null;
});
const pick = (key: string | null) => void router.replace({ query: { ...route.query, categoria: key ?? undefined } });
const inCategory = <T extends { categoryKey: string | null }>(items: T[]) => (only.value ? items.filter((i) => i.categoryKey === only.value) : items);
const best = computed(() => inCategory(data.value?.best ?? []));
const games = computed(() => inCategory(data.value?.matches ?? []));
const ratingOf = (game: RefereeMatchDto, teamId: string) => game.teamRatings.find((r) => r.teamId === teamId);
const back = computed(() => {
  const key = typeof route.query.categoria === 'string' ? route.query.categoria : data.value?.byCategory[0]?.categoryKey;
  return { name: 'referees', query: key ? { categoria: key } : {} };
});
</script>

<template>
  <div>
    <RouterLink :to="back" class="text-sm text-slate-500 hover:text-slate-800">← Árbitros</RouterLink>

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
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Por categoría y función</p>
            <ul class="mt-3 divide-y divide-line rounded-xl border border-line">
              <li v-for="row in data.byCategory" :key="`${row.categoryKey}-${row.duty}`" class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <span class="min-w-0">
                  <span class="font-medium text-slate-800">{{ row.category }}</span>
                  <span class="ml-1.5 text-xs text-slate-500">{{ officialDutyLabels[row.duty].toLowerCase() }}</span>
                </span>
                <span class="flex items-center gap-2 text-xs text-slate-500">
                  {{ row.matches === 1 ? '1 partido' : `${row.matches} partidos` }} · {{ row.ratings === 1 ? '1 nota' : `${row.ratings} notas` }}
                  <StarRating :score="row.average" size="sm" />
                  <strong class="font-figures text-slate-900">{{ formatScore(row.average) }}</strong>
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <div v-if="categories.length > 1" class="mt-6 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Ver de una categoría">
        <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Ver</span>
        <button
          v-for="option in [{ key: null, name: 'Todas las categorías' }, ...categories]"
          :key="option.key ?? 'all'"
          type="button"
          role="radio"
          :aria-checked="only === option.key"
          class="rounded-full px-3 py-1 text-xs font-semibold transition"
          :class="only === option.key ? 'bg-action text-white' : 'bg-surface-2 text-slate-600 ring-1 ring-line hover:text-slate-900'"
          @click="pick(option.key)"
        >{{ option.name }}</button>
      </div>

      <section v-if="best.length" class="mt-6">
        <h2 class="text-lg font-bold text-slate-900">Mejores notas</h2>
        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <RefereeRatingItem v-for="rating in best" :key="`${rating.matchId}-${rating.teamId}`" :rating="rating" />
        </div>
      </section>

      <section class="mt-6">
        <h2 class="text-lg font-bold text-slate-900">Partidos y notas</h2>
        <p class="mt-1 text-xs text-slate-500">Cada equipo le puntúa una vez por partido, con quién lo hizo y por qué. Las notas son definitivas.</p>
        <p v-if="games.length === 0" class="card mt-3 text-sm text-slate-500">Ningún partido{{ only ? ' en esta categoría' : '' }}.</p>
        <ul v-else class="mt-3 space-y-3">
          <li v-for="game in games" :key="game.match.id" class="card p-4">
            <div class="flex flex-wrap items-center justify-between gap-3 text-sm">
              <RouterLink :to="{ name: 'match', params: { matchId: game.match.id } }" class="min-w-0 hover:text-accent-400">
                <span class="font-medium text-slate-900">{{ game.match.homeTeam.name }} {{ game.match.homeGoals ?? '' }} – {{ game.match.awayGoals ?? '' }} {{ game.match.awayTeam.name }}</span>
                <span class="block text-xs text-slate-500">
                  <template v-if="game.category">{{ game.category }} · </template>Jornada {{ game.match.matchday }} · {{ formatDate(game.match.kickoffAt) }} · {{ officialRoleLabels[game.role].toLowerCase() }}
                </span>
              </RouterLink>
              <span class="flex items-center gap-2 text-xs text-slate-500">
                <StarRating :score="game.average" size="sm" />
                <strong v-if="game.average !== null" class="font-figures text-slate-900">{{ formatScore(game.average) }}</strong>
                {{ game.ratings === 0 ? 'sin notas' : game.ratings === 1 ? '1 nota' : `${game.ratings} notas` }}
              </span>
            </div>
            <div v-if="game.teamRatings.length" class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
              <template v-for="team in [game.match.homeTeam, game.match.awayTeam]" :key="team.id">
                <TeamRatingItem v-if="ratingOf(game, team.id)" :rating="ratingOf(game, team.id)!" />
                <p v-else class="rounded-xl border border-dashed border-line p-3 text-xs text-slate-500">
                  <strong class="text-slate-600">{{ team.name }}</strong> no le ha puesto nota.
                </p>
              </template>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
