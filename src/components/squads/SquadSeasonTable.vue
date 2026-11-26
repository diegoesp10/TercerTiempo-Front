<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import CardIcon from '@/components/ui/CardIcon.vue';
import GroupByPositionToggle from '@/components/ui/GroupByPositionToggle.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import DisciplineBadge from '@/components/squads/DisciplineBadge.vue';
import { useAsync } from '@/composables/useAsync';
import { groupByPosition, useGroupByPosition } from '@/composables/usePositionGrouping';
import { useSort } from '@/composables/useSort';
import type { DisciplineDto, PlayerYellowCycleDto, Position, SquadSeasonRowDto } from '@/types/api';
import { cycleExplanation } from '@/utils/discipline';
import { formatNumber, injuredLabel, injuryTitle, positionShortLabels } from '@/utils/format';

/**
 * Temporada de cada jugador de la plantilla de un vistazo: partidos, minutos, goles, asistencias, tarjetas, faltas y
 * nota. Se busca por nombre, se filtra o agrupa por posición y se ordena por cualquier columna. Cada nombre abre su
 * ficha con el detalle partido a partido. Junto al nombre, si está lesionado (el detalle, solo para quien puede verlo) y
 * si llega apercibido o sancionado al próximo partido; bajo las amarillas, las que cuentan para el ciclo cuando no son
 * todas.
 */
const props = defineProps<{
  squadId: string;
  highlightId?: string | null;
  discipline?: ReadonlyMap<string, DisciplineDto>;
  cycles?: ReadonlyMap<string, PlayerYellowCycleDto>;
}>();

const { data, loading, error, run } = useAsync(() => api.squads.seasonTable(props.squadId), { redirectOnError: false });
watch(() => props.squadId, () => void run());

type SortKey = 'name' | 'matches' | 'starts' | 'minutes' | 'goals' | 'assists' | 'yellow' | 'red' | 'fouls' | 'rating';
const search = ref('');
const position = ref<Position | 'none' | null>(null);
const grouped = useGroupByPosition('squad-season');

const getters: Record<SortKey, (r: SquadSeasonRowDto) => number | string | null> = {
  name: (r) => r.player.fullName,
  matches: (r) => r.matches,
  starts: (r) => r.starts,
  minutes: (r) => r.minutes,
  goals: (r) => r.goals,
  assists: (r) => r.assists,
  yellow: (r) => r.yellowCards,
  red: (r) => r.redCards,
  fouls: (r) => r.fouls,
  rating: (r) => r.averageRating,
};

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const rows = computed(() => {
  const term = normalize(search.value.trim());
  return (data.value?.rows ?? []).filter((r) => {
    if (term && !normalize(r.player.fullName).includes(term)) return false;
    if (position.value === 'none') return r.player.position === null;
    return !position.value || r.player.position === position.value;
  });
});
const { sorted, sortBy, state } = useSort<SquadSeasonRowDto, SortKey>(rows, getters, 'minutes', { ascendingFirst: ['name'] });

// Los que causaron baja salen con lo que jugaron mientras estuvieron, en su último grupo «De baja».
const groups = computed(() => groupByPosition(sorted.value, (r) => r.player.position, grouped.value, undefined, (r) => r.player.status !== 'Active'));

const positionFilter = [
  { value: 'Goalkeeper', label: 'Porteros' },
  { value: 'Defender', label: 'Defensas' },
  { value: 'Midfielder', label: 'Centrocampistas' },
  { value: 'Forward', label: 'Delanteros' },
  { value: 'none', label: 'Sin posición' },
];

// Máximos de la plantilla para resaltar al líder de cada columna.
const leaders = computed(() => {
  const all = data.value?.rows ?? [];
  const max = (f: (r: SquadSeasonRowDto) => number) => Math.max(0, ...all.map(f));
  return { minutes: max((r) => r.minutes), goals: max((r) => r.goals), assists: max((r) => r.assists), matches: max((r) => r.matches) };
});
const lead = (value: number, top: number) => value > 0 && value === top;

// La columna cuenta todas las amarillas de las actas; el apercibimiento, solo las del ciclo. Si no coinciden (una doble
// amarilla, un ciclo ya cumplido), debajo van las del ciclo, con el porqué al pasar por encima.
const cycleNotes = computed(() => {
  const notes = new Map<string, { label: string; title: string }>();
  for (const r of data.value?.rows ?? []) {
    const cycle = props.cycles?.get(r.player.id);
    if (cycle && cycle.inCycle !== r.yellowCards) notes.set(r.player.id, { label: `${cycle.inCycle} de ciclo`, title: cycleExplanation(cycle) });
  }
  return notes;
});

const columns: { key: SortKey; label: string; title: string; cls?: string }[] = [
  { key: 'matches', label: 'PJ', title: 'Partidos jugados' },
  { key: 'starts', label: 'Tit', title: 'Titularidades', cls: 'col-md' },
  { key: 'minutes', label: 'Min', title: 'Minutos jugados' },
  { key: 'goals', label: 'G', title: 'Goles' },
  { key: 'assists', label: 'A', title: 'Asistencias de gol (actas internas)', cls: 'col-sm' },
  { key: 'yellow', label: 'TA', title: 'Tarjetas amarillas' },
  { key: 'red', label: 'TR', title: 'Tarjetas rojas', cls: 'col-sm' },
  { key: 'fouls', label: 'Faltas', title: 'Faltas cometidas (actas internas)', cls: 'col-md' },
  { key: 'rating', label: 'Nota', title: 'Nota media de las actas internas', cls: 'col-sm' },
];
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="font-semibold text-slate-900">Temporada de la plantilla</h2>
        <p v-if="data" class="text-xs text-slate-500">
          {{ data.teamMatchesPlayed }} partidos jugados · {{ data.internalSheets }} con acta interna · {{ data.officialSheets }} con acta oficial descargada.
          Si falta el acta interna de un partido se usa la oficial (sin asistencias ni faltas).
        </p>
      </div>
    </div>

    <div class="mt-4 flex flex-wrap items-center gap-2">
      <div class="relative min-w-48 flex-1">
        <Icon icon="magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input v-model="search" type="search" class="input pl-9" placeholder="Buscar jugador" aria-label="Buscar jugador" />
      </div>
      <SearchSelect class="w-full sm:w-48" size="sm" placeholder="Todas las posiciones" clearable :model-value="position" :options="positionFilter" @update:model-value="position = ($event as Position | 'none' | null)" />
      <GroupByPositionToggle v-model="grouped" />
    </div>

    <Spinner v-if="loading && !data" class="my-6" />
    <Alert v-else-if="error" kind="error" class="mt-4">{{ error }}</Alert>
    <p v-else-if="data && rows.length === 0" class="mt-4 text-sm text-slate-500">Ningún jugador coincide con la búsqueda.</p>

    <div v-else-if="data" class="mt-4 overflow-x-auto">
      <table class="table-sticky min-w-full text-sm">
        <thead class="text-xs text-slate-500">
          <tr>
            <SortHeader class="py-2 pr-3 text-left" label="Jugador" v-bind="state('name')" @sort="sortBy('name')" />
            <SortHeader
              v-for="c in columns"
              :key="c.key"
              class="px-2 py-2 text-center"
              :class="c.cls"
              :label="c.label"
              :title="c.title"
              v-bind="state(c.key)"
              @sort="sortBy(c.key)"
            />
          </tr>
        </thead>
        <tbody v-for="group in groups" :key="group.key" class="divide-y divide-line">
          <tr v-if="group.label">
            <td :colspan="columns.length + 1" class="bg-surface-2 px-2 py-1.5 font-display text-2xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              {{ group.label }} · {{ group.rows.length }}
            </td>
          </tr>
          <tr v-for="r in group.rows" :key="r.player.id" class="transition hover:bg-surface-2" :class="[r.player.id === highlightId ? 'bg-brand-500/10' : '', r.matches === 0 ? 'text-slate-400' : '']">
            <td class="py-2 pr-3">
              <RouterLink :to="{ name: 'squad-player', params: { squadId, squadPlayerId: r.player.id } }" class="group flex min-w-0 items-center gap-3">
                <PlayerAvatar :src="r.player.photoUrl" :name="r.player.fullName" size="sm" />
                <span class="min-w-0">
                  <span class="block break-words font-medium group-hover:text-brand-500 group-hover:underline" :class="r.matches === 0 ? '' : 'text-slate-900'">{{ r.player.fullName }}</span>
                  <span class="block text-xs text-slate-400">
                    {{ r.player.position ? positionShortLabels[r.player.position] : 'Sin posición' }}
                    <template v-if="r.fromOfficial > 0"> · {{ r.fromOfficial }} por acta oficial</template>
                  </span>
                </span>
                <Badge v-if="r.injured" tone="red" class="shrink-0" :title="r.injury ? injuryTitle(r.injury) : 'Lesionado: no está disponible'">
                  <Icon icon="user-injured" class="mr-1 h-3 w-3" /><span class="hidden sm:inline">{{ r.injury ? injuredLabel(r.injury) : 'Lesionado' }}</span>
                </Badge>
                <DisciplineBadge :discipline="discipline?.get(r.player.id)" compact class="shrink-0" />
              </RouterLink>
            </td>
            <td class="px-2 py-2 text-center tabular-nums" :class="{ 'font-bold text-brand-500': lead(r.matches, leaders.matches) }">{{ r.matches }}</td>
            <td class="col-md px-2 py-2 text-center tabular-nums">{{ r.starts }}</td>
            <td class="px-2 py-2 text-center tabular-nums" :class="{ 'font-bold text-brand-500': lead(r.minutes, leaders.minutes) }">{{ r.minutes }}</td>
            <td class="px-2 py-2 text-center tabular-nums font-semibold" :class="{ 'text-brand-500': lead(r.goals, leaders.goals) }">{{ r.goals }}</td>
            <td class="col-sm px-2 py-2 text-center tabular-nums" :class="{ 'font-bold text-brand-500': lead(r.assists, leaders.assists) }">{{ r.assists }}</td>
            <td class="px-2 py-2 text-center tabular-nums" :title="cycleNotes.get(r.player.id)?.title">
              <span v-if="r.yellowCards" class="inline-flex items-center gap-1"><CardIcon kind="yellow" />{{ r.yellowCards }}</span>
              <span v-else class="text-slate-400">0</span>
              <span v-if="cycleNotes.has(r.player.id)" class="block whitespace-nowrap text-2xs leading-tight text-slate-500">{{ cycleNotes.get(r.player.id)?.label }}</span>
            </td>
            <td class="col-sm px-2 py-2 text-center tabular-nums">
              <span v-if="r.redCards" class="inline-flex items-center gap-1"><CardIcon kind="red" />{{ r.redCards }}</span>
              <span v-else class="text-slate-400">0</span>
            </td>
            <td class="col-md px-2 py-2 text-center tabular-nums">{{ r.fouls }}</td>
            <td class="col-sm px-2 py-2 text-center"><RatingBadge :rating="r.averageRating" size="sm" /></td>
          </tr>
        </tbody>
      </table>
      <p class="mt-3 text-xs text-slate-500">
        Pulsa en una columna para ordenar. En azul, el máximo de la plantilla.
        <template v-if="data.rows.some((r) => r.averageRating !== null)">Nota media: {{ formatNumber(data.rows.filter((r) => r.averageRating !== null).reduce((s, r) => s + (r.averageRating ?? 0), 0) / data.rows.filter((r) => r.averageRating !== null).length, 1) }}.</template>
        <span v-if="cycleNotes.size > 0" class="mt-1 block">
          «N de ciclo» bajo las amarillas: las que cuentan para la próxima sanción (con 4, apercibido; la 5.ª cuesta un partido). No
          cuentan las dos de una doble amarilla y, tras cada 5.ª, se empieza de cero.
        </span>
      </p>
    </div>
  </section>
</template>
