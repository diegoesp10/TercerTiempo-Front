<script setup lang="ts">
import { onMounted, ref, shallowRef } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import StarRating from '@/components/referees/StarRating.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import type { PendingRefereeRatingDto, RefereeCategoryDto, RefereeSummaryDto } from '@/types/api';
import { formatDate, formatScore } from '@/utils/format';

/**
 * Árbitros en el panel del club o del técnico, en dos bloques bien separados:
 *  - Lo que te toca: los partidos que ya has jugado (último mes) en los que tu equipo aún no ha contestado por todo su
 *    equipo arbitral. Se puntúa en la página del partido o se deja como «No votado» desde aquí; las dos cosas son
 *    definitivas y quedan a nombre de quien lo hace.
 *  - Para consultar: los árbitros principales mejor valorados de la categoría de tus equipos.
 */
const auth = useAuthStore();
const pending = shallowRef<PendingRefereeRatingDto[]>([]);
const category = shallowRef<RefereeCategoryDto | null>(null);
const best = shallowRef<RefereeSummaryDto[]>([]);
const loaded = ref(false);
const unlicensed = ref(false);
const busy = ref<string | null>(null);
const actionError = ref<string | null>(null);
const voter = () => auth.account?.club?.name ?? auth.account?.coach?.displayName ?? 'tu cuenta';

onMounted(async () => {
  const [p, c] = await Promise.allSettled([api.referees.pending(), api.referees.categories()]);
  if (p.status === 'fulfilled') pending.value = p.value;
  else unlicensed.value = p.reason instanceof ApiError && p.reason.status === 403;
  if (c.status === 'fulfilled') {
    const mine = c.value.filter((item) => item.competitionIds.some((id) => auth.myCompetitionIds.includes(id)));
    category.value = mine.find((item) => item.ratings > 0) ?? mine[0] ?? c.value[0] ?? null;
    if (category.value) {
      try {
        best.value = (await api.referees.category(category.value.key, { duty: 'Main', sort: 'Average' })).referees.filter((r) => r.ratings > 0).slice(0, 3);
      } catch {
        best.value = [];
      }
    }
  }
  loaded.value = true;
});

const keyOf = (item: PendingRefereeRatingDto) => `${item.match.id}-${item.teamId}`;
const left = (item: PendingRefereeRatingDto) => item.officials - item.rated;
const rival = (item: PendingRefereeRatingDto) => (item.match.homeTeam.id === item.teamId ? item.match.awayTeam : item.match.homeTeam);
const result = (item: PendingRefereeRatingDto) =>
  item.match.homeGoals !== null && item.match.awayGoals !== null ? `${item.match.homeGoals}-${item.match.awayGoals}` : null;

async function noVote(item: PendingRefereeRatingDto) {
  const ok = await confirmDialog({
    title: `¿No votar al equipo arbitral de la jornada ${item.match.matchday}?`,
    message: `${left(item) === 1 ? 'El que falta quedará' : `Los ${left(item)} que faltan quedarán`} como «No votado» de ${item.teamName}, a nombre de ${voter()}: sin nota ni comentario y sin contar en sus medias. Es definitivo.`,
    confirmLabel: 'Sí, no votar',
    cancelLabel: 'Volver',
  });
  if (!ok) return;
  busy.value = keyOf(item);
  actionError.value = null;
  try {
    await api.referees.noVote(item.match.id, item.teamId);
    pending.value = pending.value.filter((p) => keyOf(p) !== keyOf(item));
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <section v-if="loaded" class="card">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h2 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="flag" class="h-4 w-4 text-amber-400" />Árbitros</h2>
      <RouterLink :to="{ name: 'referees', query: category ? { categoria: category.key } : {} }" class="text-xs font-medium text-accent-400 hover:underline">Ver todos</RouterLink>
    </div>

    <p v-if="unlicensed" class="mt-3 text-sm text-slate-500">
      Con la licencia vigente puedes puntuar al equipo arbitral de tus partidos.
    </p>

    <!-- Lo que te toca: partidos ya jugados sin contestar -->
    <div v-else class="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="text-sm font-semibold text-slate-900">
          <Icon icon="triangle-exclamation" class="mr-1.5 h-3.5 w-3.5 text-amber-500" />Partidos jugados por puntuar
          <span v-if="pending.length" class="ml-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-500">{{ pending.length }}</span>
        </h3>
      </div>
      <p class="mt-1 text-xs text-slate-500">
        Partidos del último mes que ya jugaste y en los que tu equipo aún no ha contestado por su equipo arbitral. Puntúa a cada uno
        (con comentario si quieres) o déjalo como «No votado». Las dos cosas son definitivas y quedan a tu nombre.
      </p>
      <p v-if="actionError" class="field-error mt-2">{{ actionError }}</p>

      <ul v-if="pending.length" class="mt-2 space-y-2">
        <li v-for="item in pending" :key="keyOf(item)" class="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2">
          <TeamCrest :src="rival(item).crestUrl" :name="rival(item).name" size="sm" />
          <span class="min-w-0 flex-1">
            <span class="block break-words text-sm font-medium text-slate-900">{{ item.match.homeTeam.name }} – {{ item.match.awayTeam.name }}</span>
            <span class="block text-xs text-slate-500">
              Jugado · J{{ item.match.matchday }} · {{ formatDate(item.match.kickoffAt) }}<template v-if="result(item)"> · {{ result(item) }}</template>
              · {{ item.rated }}/{{ item.officials }} contestados<template v-if="item.noVotes"> ({{ item.noVotes }} «No votado»)</template>
            </span>
          </span>
          <span class="flex shrink-0 gap-2">
            <RouterLink :to="{ name: 'match', params: { matchId: item.match.id }, query: { tab: 'arbitros' } }" class="btn-primary px-3 py-1 text-xs">
              <Icon icon="star" class="mr-1 h-3 w-3" />Puntuar
            </RouterLink>
            <button type="button" class="btn-ghost px-3 py-1 text-xs" v-busy="busy === keyOf(item)" :disabled="busy !== null" @click="noVote(item)">No votar</button>
          </span>
        </li>
      </ul>
      <p v-else class="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
        <Icon icon="circle-check" class="h-3.5 w-3.5 text-emerald-500" />Nada pendiente: has contestado por todos tus partidos del último mes.
      </p>
    </div>

    <!-- Para consultar: los mejores de la categoría -->
    <div v-if="best.length && category" class="mt-4 border-t border-line pt-4">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">
        <Icon icon="trophy" class="mr-1.5 h-3 w-3 text-amber-400" />Mejores árbitros de {{ category.name }}
      </h3>
      <ol class="mt-2 space-y-2">
        <li v-for="(referee, index) in best" :key="referee.id" class="flex items-center justify-between gap-3 text-sm">
          <span class="flex min-w-0 items-center gap-2">
            <span class="w-4 shrink-0 text-center font-figures text-xs text-slate-500">{{ index + 1 }}</span>
            <RouterLink :to="{ name: 'referee', params: { refereeId: referee.id }, query: { categoria: referee.categoryKey } }" class="min-w-0 break-words font-medium text-slate-900 hover:text-accent-400">{{ referee.name }}</RouterLink>
          </span>
          <span class="flex shrink-0 items-center gap-2 text-xs text-slate-500">
            <StarRating :score="referee.average" size="sm" />
            <strong class="font-figures text-slate-900">{{ formatScore(referee.average) }}</strong>
            ({{ referee.ratings }})
          </span>
        </li>
      </ol>
    </div>
  </section>
</template>
