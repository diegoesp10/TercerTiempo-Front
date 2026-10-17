<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import type { MatchDto } from '@/types/api';
import { formatKickoff, matchStatusLabels, outcomeFor, outcomeLabels } from '@/utils/format';

const props = defineProps<{ match: MatchDto; teamId: string }>();

const isHome = computed(() => props.match.homeTeam.id === props.teamId);
const opponent = computed(() => (isHome.value ? props.match.awayTeam : props.match.homeTeam));
const outcome = computed(() => outcomeFor(props.match, props.teamId));
const outcomeTone = computed(() => (outcome.value === 'win' ? 'green' : outcome.value === 'draw' ? 'amber' : 'red'));
const score = computed(() =>
  props.match.homeGoals === null || props.match.awayGoals === null ? null : `${props.match.homeGoals} - ${props.match.awayGoals}`,
);
</script>

<template>
  <RouterLink
    :to="{ name: 'match', params: { matchId: match.id } }"
    class="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-emerald-300 hover:shadow"
  >
    <div class="w-14 shrink-0 text-center">
      <p class="text-xs uppercase text-slate-400">Jornada</p>
      <p class="text-lg font-semibold text-slate-800">{{ match.matchday }}</p>
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate font-medium text-slate-900">
        <span class="text-slate-400">{{ isHome ? 'vs' : '@' }}</span>
        {{ opponent.name }}
      </p>
      <p class="text-xs text-slate-500">{{ formatKickoff(match.kickoffAt) }}<span v-if="match.venue"> · {{ match.venue }}</span></p>
    </div>

    <div class="flex shrink-0 items-center gap-2">
      <Badge v-if="match.myPerformanceId" tone="blue">Registrado</Badge>
      <template v-if="match.status === 'Played' && score">
        <span class="text-lg font-semibold tabular-nums text-slate-900">{{ score }}</span>
        <Badge v-if="outcome" :tone="outcomeTone">{{ outcomeLabels[outcome] }}</Badge>
      </template>
      <Badge v-else>{{ matchStatusLabels[match.status] }}</Badge>
    </div>
  </RouterLink>
</template>
