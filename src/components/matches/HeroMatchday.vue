<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { api } from '@/api';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import type { CompetitionDto, CompetitionMatchdayDto, MatchDto } from '@/types/api';
import { formatTime, levelLabels } from '@/utils/format';

/**
 * Jornada en curso de la primera competición, para la portada: datos reales en lugar de una ilustración.
 * Enseña cinco partidos con escudos y marcador (o la hora si aún no se ha jugado) y lleva a la jornada completa.
 */
const competition = shallowRef<CompetitionDto | null>(null);
const matchday = shallowRef<CompetitionMatchdayDto | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const competitions = await api.competitions.list();
    const first = [...competitions].sort((a, b) => a.sortOrder - b.sortOrder)[0] ?? null;
    competition.value = first;
    if (first) matchday.value = await api.competitions.matchday(first.id, null);
  } catch {
    matchday.value = null;
  } finally {
    loading.value = false;
  }
});

const matches = computed<MatchDto[]>(() => (matchday.value?.matches ?? []).slice(0, 5));

const score = (m: MatchDto) => (m.homeGoals === null || m.awayGoals === null ? null : `${m.homeGoals} – ${m.awayGoals}`);
const outcomeClass = (m: MatchDto, side: 'home' | 'away') => {
  if (m.homeGoals === null || m.awayGoals === null) return 'text-slate-700';
  const mine = side === 'home' ? m.homeGoals : m.awayGoals;
  const theirs = side === 'home' ? m.awayGoals : m.homeGoals;
  return mine > theirs ? 'text-slate-900 font-semibold' : 'text-slate-500';
};
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <header class="flex items-end justify-between gap-3 border-b border-line px-5 py-4">
      <div class="min-w-0">
        <p class="eyebrow">{{ competition ? levelLabels[competition.level] : 'Jornada' }}</p>
        <h2 class="mt-1 truncate text-lg font-bold text-slate-900">
          {{ competition?.name ?? 'Jornada en curso' }}
        </h2>
      </div>
      <p v-if="matchday?.matchday" class="shrink-0 font-figures text-3xl font-extrabold leading-none text-slate-900">
        <span class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Jornada</span>
        {{ matchday.matchday }}
      </p>
    </header>

    <ul v-if="matches.length" class="divide-y divide-line">
      <li v-for="m in matches" :key="m.id">
        <RouterLink :to="{ name: 'match', params: { matchId: m.id } }" class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3 text-sm transition hover:bg-surface-2">
          <span class="flex min-w-0 items-center justify-end gap-2 text-right" :class="outcomeClass(m, 'home')">
            <span class="truncate">{{ m.homeTeam.shortName }}</span>
            <TeamCrest :src="m.homeTeam.crestUrl" :name="m.homeTeam.name" :short-name="m.homeTeam.shortName" size="xs" />
          </span>
          <span class="min-w-14 text-center">
            <span v-if="score(m)" class="font-figures text-lg font-extrabold tabular-nums text-slate-900">{{ score(m) }}</span>
            <span v-else class="font-figures text-xs font-semibold tabular-nums text-slate-500">{{ formatTime(m.kickoffAt) }}</span>
          </span>
          <span class="flex min-w-0 items-center gap-2" :class="outcomeClass(m, 'away')">
            <TeamCrest :src="m.awayTeam.crestUrl" :name="m.awayTeam.name" :short-name="m.awayTeam.shortName" size="xs" />
            <span class="truncate">{{ m.awayTeam.shortName }}</span>
          </span>
        </RouterLink>
      </li>
    </ul>
    <p v-else-if="loading" class="px-5 py-8 text-center text-sm text-slate-500">Cargando la jornada…</p>
    <p v-else class="px-5 py-8 text-center text-sm text-slate-500">{{ matchday?.notice ?? 'Todavía no hay partidos de esta temporada.' }}</p>

    <footer class="border-t border-line px-5 py-3">
      <RouterLink to="/liga" class="text-sm font-semibold text-brand-500 hover:underline">Ver la jornada completa y la clasificación →</RouterLink>
    </footer>
  </section>
</template>
