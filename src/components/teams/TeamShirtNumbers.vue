<script setup lang="ts">
import { computed } from 'vue';
import type { RosterEntryDto } from '@/types/api';

/**
 * Dorsales del equipo según las actas oficiales: quién ha llevado cada número y en qué parte de sus partidos. Nadie
 * tiene un dorsal fijo, así que un mismo número puede salir con varios jugadores (lo llevaron en jornadas distintas).
 */
const props = defineProps<{ teamId: string; roster: RosterEntryDto[]; linked: boolean }>();

const rows = computed(() => {
  const byNumber = new Map<number, { entry: RosterEntryDto; matches: number; percentage: number }[]>();
  for (const entry of props.roster) {
    for (const used of entry.shirtNumbers) {
      const players = byNumber.get(used.number) ?? [];
      players.push({ entry, matches: used.matches, percentage: used.percentage });
      byNumber.set(used.number, players);
    }
  }
  return [...byNumber.entries()]
    .sort(([a], [b]) => a - b)
    .map(([number, players]) => ({ number, players: players.sort((a, b) => b.matches - a.matches || b.percentage - a.percentage) }));
});

const matchesLabel = (matches: number) => `${matches} ${matches === 1 ? 'partido' : 'partidos'}`;
</script>

<template>
  <section v-if="rows.length" class="card">
    <div class="flex items-center justify-between gap-3">
      <h2 class="font-semibold text-slate-900">Dorsales</h2>
      <span class="text-xs text-slate-500">según las actas oficiales</span>
    </div>
    <p class="mt-1 text-xs text-slate-500">
      Nadie tiene un dorsal fijo: aquí está quién ha llevado cada número y en qué parte de sus partidos lo llevó.
    </p>

    <ul class="mt-3 divide-y divide-slate-100">
      <li v-for="row in rows" :key="row.number" class="flex gap-3 py-2">
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 font-figures text-base font-extrabold tabular-nums text-slate-900">{{ row.number }}</span>
        <ul class="min-w-0 flex-1 space-y-1 self-center text-sm">
          <li
            v-for="(player, i) in row.players"
            :key="player.entry.id"
            class="flex items-baseline justify-between gap-3"
            :title="`${player.entry.fullName} llevó el ${row.number} en ${matchesLabel(player.matches)}: el ${player.percentage} % de los suyos`"
          >
            <RouterLink
              v-if="linked"
              :to="{ name: 'player-card', params: { teamId, entryId: player.entry.id } }"
              class="min-w-0 break-words hover:text-brand-500 hover:underline"
              :class="i === 0 ? 'font-medium text-slate-800' : 'text-slate-600'"
            >{{ player.entry.fullName }}</RouterLink>
            <span v-else class="min-w-0 break-words" :class="i === 0 ? 'font-medium text-slate-800' : 'text-slate-600'">{{ player.entry.fullName }}</span>
            <span class="shrink-0 whitespace-nowrap text-xs tabular-nums text-slate-500">
              {{ matchesLabel(player.matches) }} · <span class="font-semibold text-slate-700">{{ player.percentage }} %</span>
            </span>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
