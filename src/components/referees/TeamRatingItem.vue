<script setup lang="ts">
import StarRating from '@/components/referees/StarRating.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import type { TeamRatingDto } from '@/types/api';
import { formatDate, raterLabel } from '@/utils/format';

/** La nota (definitiva) de un equipo a un árbitro en un partido: cuánto, por qué y quién la puso. */
defineProps<{ rating: TeamRatingDto }>();
</script>

<template>
  <article class="rounded-xl border border-line bg-surface-2 p-3">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="flex min-w-0 items-center gap-2">
        <TeamCrest :src="rating.teamCrestUrl" :name="rating.teamName" size="sm" />
        <span class="truncate text-sm font-semibold text-slate-900">{{ rating.teamName }}</span>
      </span>
      <span class="flex items-center gap-2">
        <StarRating :score="rating.score" size="sm" />
        <span class="font-figures text-sm font-bold text-slate-900">{{ rating.score }}</span>
      </span>
    </div>
    <p v-if="rating.comment" class="mt-2 text-sm leading-relaxed text-slate-700">“{{ rating.comment }}”</p>
    <p v-else-if="rating.commentHidden" class="mt-2 text-xs italic text-slate-500">Comentario retirado por la administración por no respetar las normas.</p>
    <p v-else class="mt-2 text-xs italic text-slate-500">Sin comentario.</p>
    <p class="mt-2 text-xs text-slate-500">Por {{ raterLabel(rating.ratedBy) }} · {{ formatDate(rating.ratedAt) }}</p>
  </article>
</template>
