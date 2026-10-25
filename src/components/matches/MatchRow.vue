<script setup lang="ts">
import { computed } from 'vue';
import type { RouteLocationRaw } from 'vue-router';
import Badge from '@/components/ui/Badge.vue';
import type { MatchDto } from '@/types/api';
import { formatKickoff, matchStatusLabels, outcomeFor, outcomeLabels, outcomeTone, scoreLabel } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';

const props = defineProps<{
  match: MatchDto;
  /** Equipo desde cuyo punto de vista se muestra el partido (rival, localía, resultado). */
  teamId: string;
  /** Destino del enlace; por defecto, la página pública del partido. */
  to?: RouteLocationRaw;
}>();

const isHome = computed(() => props.match.homeTeam.id === props.teamId);
const opponent = computed(() => (isHome.value ? props.match.awayTeam : props.match.homeTeam));
const outcome = computed(() => outcomeFor(props.match, props.teamId));
const score = computed(() => scoreLabel(props.match));
const target = computed<RouteLocationRaw>(() => props.to ?? { name: 'match', params: { matchId: props.match.id } });
</script>

<template>
  <RouterLink
    :to="target"
    class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-surface px-3 py-3 shadow-sm transition hover:border-brand-400/60 hover:shadow sm:flex-nowrap sm:gap-4 sm:px-4"
  >
    <div class="w-14 shrink-0 text-center">
      <p class="text-xs uppercase text-slate-400">Jornada</p>
      <p class="text-lg font-semibold text-slate-800">{{ match.matchday }}</p>
    </div>

    <div class="min-w-0 flex-1 basis-44">
      <p class="truncate font-medium text-slate-900">
        <TeamName :name="opponent.name" :team-id="opponent.id" :crest-url="opponent.crestUrl" :short-name="opponent.shortName" size="sm">
          <span class="text-slate-400">vs</span> {{ opponent.name }}
        </TeamName>
      </p>
      <p class="text-xs text-slate-500">
        {{ formatKickoff(match.kickoffAt) }} · <span :class="isHome ? 'text-emerald-700' : 'text-slate-500'">{{ isHome ? 'en casa' : 'fuera' }}</span><span v-if="match.venue"> · {{ match.venue }}</span>
      </p>
    </div>

    <div class="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
      <slot name="badge" />
      <template v-if="match.status === 'Played' && score">
        <span class="text-lg font-semibold tabular-nums text-slate-900">{{ score }}</span>
        <Badge v-if="outcome" :tone="outcomeTone(outcome)">{{ outcomeLabels[outcome] }}</Badge>
      </template>
      <Badge v-else>{{ matchStatusLabels[match.status] }}</Badge>
    </div>
  </RouterLink>
</template>
