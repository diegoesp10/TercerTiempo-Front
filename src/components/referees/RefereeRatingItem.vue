<script setup lang="ts">
import StarRating from '@/components/referees/StarRating.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import type { RefereeRatingDto } from '@/types/api';
import { formatDate, officialRoleLabels, raterLabel } from '@/utils/format';

/** Una nota (definitiva) de un equipo a un árbitro en un partido, con su comentario y quién la puso. */
defineProps<{ rating: RefereeRatingDto }>();
</script>

<template>
  <article class="rounded-xl border border-line bg-surface-2 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <TeamCrest :src="rating.teamCrestUrl" :name="rating.teamName" size="sm" />
        <span class="truncate text-sm font-semibold text-slate-900">{{ rating.teamName }}</span>
      </div>
      <span class="flex items-center gap-2">
        <StarRating :score="rating.score" size="sm" />
        <span class="font-figures text-sm font-bold text-slate-900">{{ rating.score }}</span>
      </span>
    </div>
    <p v-if="rating.comment" class="mt-2 text-sm leading-relaxed text-slate-700">“{{ rating.comment }}”</p>
    <p v-else-if="rating.commentHidden" class="mt-2 text-xs italic text-slate-500">Comentario retirado por la administración por no respetar las normas.</p>
    <p class="mt-2 text-xs text-slate-500">
      <RouterLink :to="{ name: 'match', params: { matchId: rating.matchId } }" class="hover:text-accent-400">{{ rating.homeTeamName }} – {{ rating.awayTeamName }}</RouterLink>
      <template v-if="rating.category"> · {{ rating.category }}</template>
      · {{ formatDate(rating.kickoffAt) }} · como {{ officialRoleLabels[rating.role].toLowerCase() }}
    </p>
    <p class="mt-1 text-xs text-slate-500">Por {{ raterLabel(rating.ratedBy) }}</p>
  </article>
</template>
