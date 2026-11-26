<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api';
import PlayerHeroCard from '@/components/players/PlayerHeroCard.vue';
import PositionSummaryPicker from '@/components/players/PositionSummaryPicker.vue';
import ShirtNumberUsage from '@/components/players/ShirtNumberUsage.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import TeamName from '@/components/teams/TeamName.vue';
import { useAsync } from '@/composables/useAsync';
import { useSort } from '@/composables/useSort';
import { useSummaryPosition } from '@/composables/useSummaryPosition';
import { useAuthStore } from '@/stores/auth';
import type { MatchDto } from '@/types/api';
import { formatDate, formatNumber, outcomeLabels, outcomeTone, positionLabels, type Outcome } from '@/utils/format';
import { keyColumnsFor, keyStatsFor, keyTotals, matchesOfTeam, type KeyStat, type KeyTotals } from '@/utils/keyStats';

/**
 * Ficha de un jugador para cualquier cuenta con sesión: datos básicos y la temporada según las actas oficiales. Su
 * club y su plantilla (o todos, si el jugador lo ha hecho público) ven además las actas de Tercer Tiempo: asistencias
 * de gol, faltas, nota y el dato de su puesto (paradas, despejes, pases...).
 */
const props = defineProps<{ teamId: string; entryId: string }>();
const { data, loading, error } = useAsync(() => api.teams.playerCard(props.teamId, props.entryId));
const auth = useAuthStore();

/** No hay dorsal fijo: el de cabecera es el que más ha llevado según las actas. */
const usualShirt = computed(() => data.value?.entry.shirtNumbers[0] ?? null);

const meta = computed(() => {
  const card = data.value;
  if (!card) return '';
  const shirt = usualShirt.value;
  const shirtLabel = shirt ? (card.entry.shirtNumbers.length > 1 ? `dorsal más usado: ${shirt.number} (${shirt.percentage} %)` : `dorsal ${shirt.number}`) : null;
  return [card.entry.position ? positionLabels[card.entry.position] : 'Sin posición', shirtLabel, card.team.competitionName]
    .filter(Boolean)
    .join(' · ');
});

const position = computed(() => data.value?.entry.position ?? null);
const columns = computed(() => {
  const { stats, withAssists } = keyColumnsFor(position.value);
  return { stats: stats.map((stat) => ({ stat, sortKey: `key-${stat.key}` as const })), withAssists };
});

interface Row {
  match: MatchDto;
  home: boolean;
  source: 'internal' | 'official';
  /** Dorsal de ese partido: el apuntado en el acta interna y, si no, el del acta oficial. */
  shirt: number | null;
  started: boolean;
  minutes: number;
  goals: number;
  assists: number | null;
  yellow: number;
  red: boolean;
  fouls: number | null;
  rating: number | null;
  /** Lo del acta interna para el dato del puesto; null con el acta oficial, que no lo trae. */
  stats: KeyTotals | null;
}

/** Partido a partido: el acta interna si se ve y existe; si no, la oficial. */
const rows = computed<Row[]>(() => {
  const card = data.value;
  if (!card) return [];
  const byMatch = new Map<string, Row>();
  const officialShirt = new Map(card.official.map((o) => [o.match.id, o.line.shirtNumber]));
  for (const o of card.official) {
    if (!o.line.played) continue;
    byMatch.set(o.match.id, {
      match: o.match, home: o.home, source: 'official', shirt: o.line.shirtNumber, started: o.line.started, minutes: o.line.minutesPlayed,
      goals: o.line.goals + o.line.penaltyGoals, assists: null, yellow: o.line.yellowCards, red: o.line.redCard, fouls: null, rating: null, stats: null,
    });
  }
  for (const i of card.internal) {
    const p = i.performance;
    if (p.minutesPlayed <= 0) continue;
    byMatch.set(i.match.id, {
      match: i.match, home: i.home, source: 'internal', shirt: p.matchShirtNumber ?? officialShirt.get(i.match.id) ?? null,
      started: p.started, minutes: p.minutesPlayed,
      goals: p.goals, assists: p.assists, yellow: p.yellowCards, red: p.redCard, fouls: p.fouls ?? 0, rating: p.rating, stats: keyTotals(p),
    });
  }
  return [...byMatch.values()].sort((a, b) => b.match.matchday - a.match.matchday);
});

const opponent = (row: Row) => (row.home ? row.match.awayTeam : row.match.homeTeam);
const outcome = (row: Row): Outcome => {
  const { homeGoals, awayGoals } = row.match;
  if (homeGoals === null || awayGoals === null) return null;
  const mine = row.home ? homeGoals : awayGoals;
  const theirs = row.home ? awayGoals : homeGoals;
  return mine > theirs ? 'win' : mine === theirs ? 'draw' : 'loss';
};
/** Para ordenar por resultado: primero las victorias (y entre ellas, las de más diferencia). */
const resultScore = (row: Row) => {
  const { homeGoals, awayGoals } = row.match;
  if (homeGoals === null || awayGoals === null) return null;
  const diff = row.home ? homeGoals - awayGoals : awayGoals - homeGoals;
  return (diff > 0 ? 3 : diff === 0 ? 1 : 0) * 100 + diff;
};

type SortKey = 'match' | 'result' | 'shirt' | 'minutes' | 'goals' | 'assists' | 'cards' | 'fouls' | 'rating' | 'source' | `key-${KeyStat['key']}`;
const getters = computed(() => {
  const base: Partial<Record<SortKey, (row: Row) => number | string | null>> = {
    match: (r) => r.match.matchday,
    result: resultScore,
    shirt: (r) => r.shirt,
    minutes: (r) => r.minutes,
    goals: (r) => r.goals,
    assists: (r) => r.assists,
    // La roja pesa más que cualquier número de amarillas.
    cards: (r) => (r.red ? 10 : 0) + r.yellow,
    fouls: (r) => r.fouls,
    rating: (r) => r.rating,
    source: (r) => (r.source === 'internal' ? 'Acta interna' : 'Acta oficial'),
  };
  for (const { stat, sortKey } of columns.value.stats) base[sortKey] = (r) => (r.stats ? stat.sort(r.stats) : null);
  return base as Record<SortKey, (row: Row) => number | string | null>;
});
const { sorted, sortBy, state } = useSort<Row, SortKey>(rows, getters, 'match', { ascendingFirst: ['shirt', 'source'] });

/**
 * Cifras de la banda: las oficiales siempre; con el perfil completo, también la nota y el dato del puesto (el suyo o el
 * que se elija en «Resumen como»). El partido a partido sigue con las columnas de su puesto.
 */
const summaryPosition = useSummaryPosition(() => data.value?.entry);
const band = computed(() => {
  const card = data.value;
  if (!card) return [];
  const official = card.entry.stats;
  const internal = card.internalStats;
  const played = Math.max(official?.appearances ?? 0, internal?.appearances ?? 0);
  const items: { label: string; value: string; title?: string }[] = [
    { label: 'Partidos', ...matchesOfTeam(played, card.teamMatchesPlayed) },
    { label: 'Titular', value: String(Math.max(official?.started ?? 0, internal?.started ?? 0)) },
    { label: 'Minutos', value: String(Math.max(official?.minutesPlayed ?? 0, internal?.minutesPlayed ?? 0)) },
    { label: 'Goles', value: String(Math.max(official?.goals ?? 0, internal?.goals ?? 0)) },
    { label: 'Tarjetas', value: `${Math.max(official?.yellowCards ?? 0, internal?.yellowCards ?? 0)}/${Math.max(official?.redCards ?? 0, internal?.redCards ?? 0)}`, title: 'Amarillas / rojas' },
  ];
  if (card.extended) {
    for (const stat of keyStatsFor(summaryPosition.value)) items.push({ label: stat.label, value: internal ? String(stat.value(keyTotals(internal))) : '—', title: stat.title });
    items.push({ label: 'Nota media', value: internal?.averageRating != null ? formatNumber(internal.averageRating, 1) : '—' });
  }
  return items;
});
</script>

<template>
  <Spinner v-if="loading && !data" class="my-12" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <div v-else-if="data" class="space-y-6">
    <PlayerHeroCard
      :team="`${data.team.name}${data.team.seasonLabel ? ` · ${data.team.seasonLabel}` : ''}`"
      :team-crest-url="data.team.crestUrl"
      :team-id="data.team.id"
      :name="data.entry.fullName"
      :meta="meta"
      :number="usualShirt?.number"
      :photo-url="data.entry.photoUrl"
      :stats="band"
    >
      <template #actions>
        <Badge v-if="data.isMe" tone="blue">Eres tú</Badge>
        <Badge v-if="data.extended" tone="green">{{ data.internalProfileLink ? 'De tu club' : 'Perfil público' }}</Badge>
        <Badge v-else tone="slate"><Icon icon="lock" class="mr-1 h-2.5 w-2.5" />Perfil completo privado</Badge>
        <RouterLink :to="{ name: 'team', params: { teamId: data.team.id } }" class="btn-secondary btn-sm py-1.5">Ver el equipo</RouterLink>
        <RouterLink v-if="data.internalProfileLink" :to="data.internalProfileLink" class="btn-secondary btn-sm py-1.5">
          <Icon icon="chart-line" class="h-3 w-3" />Perfil en la plantilla
        </RouterLink>
      </template>
      <!-- Sin el perfil completo la banda no lleva el dato del puesto: no hay nada que cambiar. -->
      <template v-if="data.extended" #summary>
        <PositionSummaryPicker v-model="summaryPosition" :own="position" :you="data.isMe" />
      </template>
    </PlayerHeroCard>

    <!-- Su propia ficha: quién la ve así y dónde se cambia (el interruptor está en «Mi perfil»). -->
    <Alert v-if="data.isMe" kind="info">
      Esta es tu ficha pública. Tu club y tu plantilla la ven completa; fuera de ellos,
      {{ auth.player?.publicProfile ? 'también completa, porque tu perfil es público' : 'solo tus datos básicos y las actas oficiales' }}.
      Lo cambias en <RouterLink :to="{ name: 'my-profile' }" class="font-semibold underline hover:no-underline">Mi perfil</RouterLink>.
    </Alert>

    <Alert v-else-if="!data.extended" kind="info">
      <template v-if="data.hasAccount">
        {{ data.entry.fullName }} no ha hecho público su perfil completo: fuera de su club solo se ven sus datos básicos y las actas oficiales de la federación.
      </template>
      <template v-else>Las actas de Tercer Tiempo de este jugador son internas de su club. Aquí se ven sus datos básicos y las actas oficiales de la federación.</template>
    </Alert>

    <!-- Dorsales: no hay uno fijo, el de cada jornada sale de su acta -->
    <section class="card">
      <h2 class="font-semibold text-slate-900">Dorsales</h2>
      <p class="text-xs text-slate-500">Los que ha llevado esta temporada según las actas públicas de la federación, haya jugado o se quedase en el banquillo.</p>
      <p v-if="data.entry.shirtNumbers.length === 0" class="mt-3 text-sm text-slate-500">Todavía no aparece con dorsal en ningún acta de esta temporada.</p>
      <ShirtNumberUsage v-else :usage="data.entry.shirtNumbers" class="mt-3 max-w-md" />
    </section>

    <!-- Partido a partido -->
    <section class="card">
      <h2 class="font-semibold text-slate-900">Partido a partido</h2>
      <p class="text-xs text-slate-500">
        <template v-if="data.extended">Acta interna del cuerpo técnico cuando existe; si no, el acta pública de la federación (sin asistencias, faltas, nota ni el dato de su puesto).</template>
        <template v-else>Según las actas públicas de la federación.</template>
        Pulsa en una columna para ordenar por ella.
      </p>
      <p v-if="rows.length === 0" class="mt-3 text-sm text-slate-500">Todavía no aparece en ningún acta de esta temporada.</p>
      <div v-else class="mt-3 overflow-x-auto">
        <table class="table-sticky min-w-full text-sm">
          <thead class="text-xs text-slate-500">
            <tr>
              <SortHeader class="py-2 pr-3 text-left" label="Partido" title="Jornada" v-bind="state('match')" @sort="sortBy('match')" />
              <SortHeader class="px-2 py-2 text-center" label="Resultado" v-bind="state('result')" @sort="sortBy('result')" />
              <SortHeader class="col-sm px-2 py-2 text-center" label="Dorsal" title="Dorsal que llevó en ese partido" v-bind="state('shirt')" @sort="sortBy('shirt')" />
              <SortHeader class="px-2 py-2 text-center" label="Min" title="Minutos" v-bind="state('minutes')" @sort="sortBy('minutes')" />
              <SortHeader class="px-2 py-2 text-center" label="G" title="Goles" v-bind="state('goals')" @sort="sortBy('goals')" />
              <template v-if="data.extended">
                <SortHeader
                  v-for="{ stat, sortKey } in columns.stats"
                  :key="stat.key"
                  class="px-2 py-2 text-center"
                  :label="stat.short"
                  :title="stat.title"
                  v-bind="state(sortKey)"
                  @sort="sortBy(sortKey)"
                />
                <SortHeader v-if="columns.withAssists" class="col-sm px-2 py-2 text-center" label="A" title="Asistencias de gol" v-bind="state('assists')" @sort="sortBy('assists')" />
              </template>
              <SortHeader class="px-2 py-2 text-center" label="Tarjetas" title="Tarjetas (la roja pesa más)" v-bind="state('cards')" @sort="sortBy('cards')" />
              <SortHeader v-if="data.extended" class="col-md px-2 py-2 text-center" label="Faltas" title="Faltas cometidas" v-bind="state('fouls')" @sort="sortBy('fouls')" />
              <SortHeader v-if="data.extended" class="px-2 py-2 text-center" label="Nota" v-bind="state('rating')" @sort="sortBy('rating')" />
              <SortHeader class="col-md px-2 py-2 text-right" label="Fuente" v-bind="state('source')" @sort="sortBy('source')" />
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="row in sorted" :key="row.match.id">
              <td class="py-2 pr-3">
                <RouterLink :to="{ name: 'match', params: { matchId: row.match.id } }" class="font-medium text-slate-900 hover:text-brand-500 hover:underline">
                  J{{ row.match.matchday }} · <TeamName :prefix="row.home ? 'vs' : 'en'" :name="opponent(row).name" :crest-url="opponent(row).crestUrl" />
                </RouterLink>
                <p class="text-xs text-slate-400">{{ formatDate(row.match.kickoffAt) }} · {{ row.started ? 'titular' : 'suplente' }}</p>
              </td>
              <td class="px-2 py-2 text-center whitespace-nowrap tabular-nums">
                {{ row.match.homeGoals ?? '—' }}-{{ row.match.awayGoals ?? '—' }}
                <Badge v-if="outcome(row)" :tone="outcomeTone(outcome(row))" class="ml-1">{{ outcomeLabels[outcome(row)!] }}</Badge>
              </td>
              <td class="col-sm px-2 py-2 text-center tabular-nums text-slate-600">{{ row.shirt ?? '—' }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ row.minutes }}'</td>
              <td class="px-2 py-2 text-center font-semibold tabular-nums">{{ row.goals }}</td>
              <template v-if="data.extended">
                <td v-for="{ stat } in columns.stats" :key="stat.key" class="px-2 py-2 text-center whitespace-nowrap tabular-nums">{{ row.stats ? stat.value(row.stats) : '—' }}</td>
                <td v-if="columns.withAssists" class="col-sm px-2 py-2 text-center tabular-nums">{{ row.assists ?? '—' }}</td>
              </template>
              <td class="px-2 py-2 text-center"><CardMarks :yellow-cards="row.yellow" :red-card="row.red" /></td>
              <td v-if="data.extended" class="col-md px-2 py-2 text-center tabular-nums">{{ row.fouls ?? '—' }}</td>
              <td v-if="data.extended" class="px-2 py-2 text-center"><RatingBadge v-if="row.source === 'internal'" :rating="row.rating" size="sm" /><span v-else class="text-slate-400">—</span></td>
              <td class="col-md px-2 py-2 text-right text-xs text-slate-500">{{ row.source === 'internal' ? 'Acta interna' : 'Acta oficial' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>
