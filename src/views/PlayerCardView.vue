<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api';
import PlayerHeroCard from '@/components/players/PlayerHeroCard.vue';
import PublicProfileToggle from '@/components/players/PublicProfileToggle.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import TeamName from '@/components/teams/TeamName.vue';
import { useAsync } from '@/composables/useAsync';
import type { MatchDto } from '@/types/api';
import { formatDate, formatNumber, outcomeLabels, outcomeTone, positionLabels, type Outcome } from '@/utils/format';

/**
 * Ficha de un jugador para cualquier cuenta con sesión: datos básicos y la temporada según las actas oficiales. Su
 * club y su plantilla (o todos, si el jugador lo ha hecho público) ven además las actas de Tercer Tiempo: asistencias
 * de gol, faltas y nota.
 */
const props = defineProps<{ teamId: string; entryId: string }>();
const { data, loading, error, run } = useAsync(() => api.teams.playerCard(props.teamId, props.entryId));

const meta = computed(() => {
  const card = data.value;
  if (!card) return '';
  return [card.entry.position ? positionLabels[card.entry.position] : 'Sin posición', card.entry.shirtNumber !== null ? `dorsal ${card.entry.shirtNumber}` : null, card.team.competitionName]
    .filter(Boolean)
    .join(' · ');
});

interface Row {
  match: MatchDto;
  home: boolean;
  source: 'internal' | 'official';
  started: boolean;
  minutes: number;
  goals: number;
  assists: number | null;
  yellow: number;
  red: boolean;
  fouls: number | null;
  rating: number | null;
}

/** Partido a partido: el acta interna si se ve y existe; si no, la oficial. */
const rows = computed<Row[]>(() => {
  const card = data.value;
  if (!card) return [];
  const byMatch = new Map<string, Row>();
  for (const o of card.official) {
    if (!o.line.played) continue;
    byMatch.set(o.match.id, {
      match: o.match, home: o.home, source: 'official', started: o.line.started, minutes: o.line.minutesPlayed,
      goals: o.line.goals + o.line.penaltyGoals, assists: null, yellow: o.line.yellowCards, red: o.line.redCard, fouls: null, rating: null,
    });
  }
  for (const i of card.internal) {
    const p = i.performance;
    if (p.minutesPlayed <= 0) continue;
    byMatch.set(i.match.id, {
      match: i.match, home: i.home, source: 'internal', started: p.started, minutes: p.minutesPlayed,
      goals: p.goals, assists: p.assists, yellow: p.yellowCards, red: p.redCard, fouls: p.fouls ?? 0, rating: p.rating,
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

/** Cifras de la banda: las oficiales siempre; con el perfil completo, también asistencias de gol y nota. */
const band = computed(() => {
  const card = data.value;
  if (!card) return [];
  const official = card.entry.stats;
  const internal = card.internalStats;
  const items = [
    { label: 'Partidos', value: String(Math.max(official?.appearances ?? 0, internal?.appearances ?? 0)) },
    { label: 'Titular', value: String(Math.max(official?.started ?? 0, internal?.started ?? 0)) },
    { label: 'Minutos', value: String(Math.max(official?.minutesPlayed ?? 0, internal?.minutesPlayed ?? 0)) },
    { label: 'Goles', value: String(Math.max(official?.goals ?? 0, internal?.goals ?? 0)) },
    { label: 'Tarjetas', value: `${Math.max(official?.yellowCards ?? 0, internal?.yellowCards ?? 0)}/${Math.max(official?.redCards ?? 0, internal?.redCards ?? 0)}` },
  ];
  if (card.extended) {
    items.push({ label: 'Asistencias de gol', value: internal ? String(internal.assists) : '—' });
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
      :number="data.entry.shirtNumber"
      :photo-url="data.entry.photoUrl"
      :stats="band"
    >
      <template #actions>
        <Badge v-if="data.isMe" tone="blue">Eres tú</Badge>
        <Badge v-if="data.extended" tone="green">{{ data.internalProfileLink ? 'De tu club' : 'Perfil público' }}</Badge>
        <Badge v-else tone="slate"><Icon icon="lock" class="mr-1 h-2.5 w-2.5" />Perfil completo privado</Badge>
        <RouterLink :to="{ name: 'team', params: { teamId: data.team.id } }" class="btn-secondary px-3 py-1.5 text-xs">Ver el equipo</RouterLink>
        <RouterLink v-if="data.internalProfileLink" :to="data.internalProfileLink" class="btn-secondary px-3 py-1.5 text-xs">
          <Icon icon="chart-line" class="h-3 w-3" />Perfil en la plantilla
        </RouterLink>
      </template>
    </PlayerHeroCard>

    <section v-if="data.isMe" class="card">
      <PublicProfileToggle @changed="run" />
    </section>

    <Alert v-else-if="!data.extended" kind="info">
      <template v-if="data.hasAccount">
        {{ data.entry.fullName }} no ha hecho público su perfil completo: fuera de su club solo se ven sus datos básicos y las actas oficiales de la federación.
      </template>
      <template v-else>Las actas de Tercer Tiempo de este jugador son internas de su club. Aquí se ven sus datos básicos y las actas oficiales de la federación.</template>
    </Alert>

    <!-- Partido a partido -->
    <section class="card">
      <h2 class="font-semibold text-slate-900">Partido a partido</h2>
      <p class="text-xs text-slate-500">
        <template v-if="data.extended">Acta interna del cuerpo técnico cuando existe; si no, el acta pública de la federación (sin asistencias, faltas ni nota).</template>
        <template v-else>Según las actas públicas de la federación.</template>
      </p>
      <p v-if="rows.length === 0" class="mt-3 text-sm text-slate-500">Todavía no aparece en ningún acta de esta temporada.</p>
      <div v-else class="mt-3 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="py-2 pr-3 text-left">Partido</th>
              <th class="px-2 py-2 text-center">Resultado</th>
              <th class="px-2 py-2 text-center">Min</th>
              <th class="px-2 py-2 text-center">G</th>
              <th v-if="data.extended" class="px-2 py-2 text-center" title="Asistencias de gol">A</th>
              <th class="px-2 py-2 text-center">Tarjetas</th>
              <th v-if="data.extended" class="col-md px-2 py-2 text-center">Faltas</th>
              <th v-if="data.extended" class="px-2 py-2 text-center">Nota</th>
              <th class="col-md px-2 py-2 text-right">Fuente</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="row in rows" :key="row.match.id">
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
              <td class="px-2 py-2 text-center tabular-nums">{{ row.minutes }}'</td>
              <td class="px-2 py-2 text-center font-semibold tabular-nums">{{ row.goals }}</td>
              <td v-if="data.extended" class="px-2 py-2 text-center tabular-nums">{{ row.assists ?? '—' }}</td>
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
