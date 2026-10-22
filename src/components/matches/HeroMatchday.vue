<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import type { CompetitionDto, CompetitionMatchdayDto, MatchDto } from '@/types/api';
import { formatTime, groupByLevel, levelLabels } from '@/utils/format';

/**
 * Jornada en curso para la portada, con selector de categoría: datos reales en lugar de una ilustración. Cada
 * partido lleva a su página, donde se ven el acta oficial y las actas internas que las plantillas hayan hecho
 * públicas. Las ligas regionales son, de momento, solo las asturianas.
 */
const competitions = shallowRef<CompetitionDto[]>([]);
const selectedId = ref<string | null>(null);
const matchday = shallowRef<CompetitionMatchdayDto | null>(null);
const loading = ref(true);

const options = computed(() =>
  groupByLevel(competitions.value).flatMap((group) => group.competitions.map((c) => ({ value: c.id, label: c.name, group: levelLabels[group.level] }))),
);
const competition = computed(() => competitions.value.find((c) => c.id === selectedId.value) ?? null);

onMounted(async () => {
  try {
    competitions.value = await api.competitions.list();
    const saved = localStorage.getItem('tt.home-competition');
    selectedId.value = competitions.value.find((c) => c.id === saved)?.id ?? [...competitions.value].sort((a, b) => a.sortOrder - b.sortOrder)[0]?.id ?? null;
  } catch {
    loading.value = false;
  }
});

watch(selectedId, async (id) => {
  matchday.value = null;
  if (!id) return;
  loading.value = true;
  try {
    localStorage.setItem('tt.home-competition', id);
  } catch { /* sin almacenamiento local: se vuelve a la primera categoría la próxima vez */ }
  try {
    const result = await api.competitions.matchday(id, null);
    if (selectedId.value === id) matchday.value = result;
  } catch {
    matchday.value = null;
  } finally {
    if (selectedId.value === id) loading.value = false;
  }
});

const matches = computed<MatchDto[]>(() => (matchday.value?.matches ?? []).slice(0, 6));

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
    <header class="border-b border-line px-5 py-4">
      <div class="flex items-end justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="eyebrow">{{ competition ? levelLabels[competition.level] : 'Jornada' }}</p>
          <SearchSelect
            v-if="options.length"
            class="mt-1"
            :model-value="selectedId"
            :options="options"
            placeholder="Elige la categoría"
            aria-label="Categoría"
            @update:model-value="selectedId = ($event as string | null)"
          />
        </div>
        <p v-if="matchday?.matchday" class="shrink-0 font-figures text-3xl font-extrabold leading-none text-slate-900">
          <span class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Jornada</span>
          {{ matchday.matchday }}
        </p>
      </div>
      <p class="mt-2 text-xs text-slate-500">
        <template v-if="matchday?.season">Temporada <strong class="text-slate-700">{{ matchday.season.label }}</strong></template>
        <template v-if="matchday?.season && competition?.level === 'Regional'"> · </template>
        <template v-if="competition?.level === 'Regional'">categorías regionales: de momento solo Asturias</template>
      </p>
    </header>

    <ul v-if="matches.length" class="divide-y divide-line">
      <li v-for="m in matches" :key="m.id">
        <RouterLink :to="{ name: 'match', params: { matchId: m.id } }" class="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-3 text-sm transition hover:bg-surface-2" title="Acta oficial y datos públicos del partido">
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

    <footer class="flex flex-wrap items-center justify-between gap-2 border-t border-line px-5 py-3 text-xs text-slate-500">
      <span>Acta oficial y comparadores gratis; las actas internas, si la plantilla las hace públicas.</span>
      <RouterLink :to="selectedId ? { name: 'league', query: { competition: selectedId } } : { name: 'league' }" class="text-sm font-semibold text-brand-500 hover:underline">Jornada completa y clasificación →</RouterLink>
    </footer>
  </section>
</template>
