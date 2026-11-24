<script setup lang="ts">
import { computed, reactive } from 'vue';
import { api } from '@/api';
import TeamSeasonStats from '@/components/squads/TeamSeasonStats.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useSort } from '@/composables/useSort';
import type { FormResultDto, HeadToHeadMatchDto, PreviewPlayerDto, TeamPreviewDto } from '@/types/api';
import { formatDate, formatKickoff } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';
import PlayerName from '@/components/players/PlayerName.vue';

/**
 * Previa del partido para el cuerpo técnico y el club: probabilidades con sus razones, forma y balance de cada equipo
 * y los jugadores en forma del rival según las actas públicas. `myTeamId` orienta la lectura (quién es el rival).
 */
/** `squadId`: plantilla desde la que se abre; con ella se muestran también los datos del equipo de su cuerpo técnico. */
const props = defineProps<{ matchId: string; myTeamId?: string; squadId?: string }>();

const { data, loading, error } = useAsync(() => api.matches.preview(props.matchId), { redirectOnError: false });

const pct = (value: number) => `${Math.round(value * 100)}%`;

/**
 * Tramos de la barra de probabilidades. El ancho sale de la proporción exacta (normalizada a 100 %, sin redondeos que
 * la desborden) y la cifra solo va dentro si el tramo cabe; si no, se lee en la leyenda de debajo.
 */
const MIN_LABEL_SHARE = 0.12;
const segments = computed(() => {
  if (!data.value) return [];
  const p = data.value.prediction;
  const values = [Math.max(0, p.homeWin), Math.max(0, p.draw), Math.max(0, p.awayWin)];
  const total = values.reduce((sum, v) => sum + v, 0) || 1;
  const labels = [`Gana ${data.value.home.team.shortName}`, 'Empate', `Gana ${data.value.away.team.shortName}`];
  const tones = ['bg-sky-100 text-sky-800', 'bg-slate-100 text-slate-700', 'bg-amber-100 text-amber-800'];
  return values.map((value, i) => {
    const share = value / total;
    return { key: i, label: labels[i], tone: tones[i], share, width: `${(share * 100).toFixed(3)}%`, text: pct(value), inside: share >= MIN_LABEL_SHARE };
  });
});

const sides = computed(() => {
  if (!data.value) return [];
  const { home, away } = data.value;
  return [home, away].map((side) => ({ side, isMine: side.team.id === props.myTeamId, isRival: !!props.myTeamId && side.team.id !== props.myTeamId }));
});

const favourite = computed(() => {
  if (!data.value) return null;
  const p = data.value.prediction;
  if (p.homeWin >= p.draw && p.homeWin >= p.awayWin) return { name: data.value.home.team.name, team: data.value.home.team, value: p.homeWin };
  if (p.awayWin >= p.draw) return { name: data.value.away.team.name, team: data.value.away.team, value: p.awayWin };
  return { name: 'Empate', team: null, value: p.draw };
});

const outcomeTone: Record<FormResultDto['outcome'], string> = {
  W: 'bg-emerald-100 text-emerald-800',
  D: 'bg-slate-100 text-slate-700',
  L: 'bg-red-100 text-red-800',
};
const outcomeLetter: Record<FormResultDto['outcome'], string> = { W: 'V', D: 'E', L: 'D' };

const record = (t: TeamPreviewDto) => `${t.won}V-${t.drawn}E-${t.lost}D`;

// Ya jugado: la previa sigue siendo la de antes del partido y se ve cómo acabó.
const finalScore = computed(() => {
  const m = data.value?.match;
  return m && m.status === 'Played' && m.homeGoals !== null && m.awayGoals !== null ? { home: m.homeGoals, away: m.awayGoals } : null;
});
const predictedRight = computed(() => {
  if (!finalScore.value || !data.value) return null;
  const p = data.value.prediction;
  const pick = p.homeWin >= p.draw && p.homeWin >= p.awayWin ? 1 : p.awayWin >= p.draw ? -1 : 0;
  return pick === Math.sign(finalScore.value.home - finalScore.value.away);
});

const h2h = computed(() => data.value?.headToHead ?? null);
// Precedentes de la misma temporada primero agrupados por temporada (del más reciente al más antiguo).
const h2hSeasons = computed(() => {
  const groups: { season: string; matches: HeadToHeadMatchDto[] }[] = [];
  for (const m of h2h.value?.matches ?? []) {
    const last = groups[groups.length - 1];
    if (last && last.season === m.seasonLabel) last.matches.push(m);
    else groups.push({ season: m.seasonLabel, matches: [m] });
  }
  return groups;
});
const perMatch = (p: PreviewPlayerDto) => (p.matches > 0 ? (p.minutes / p.matches).toFixed(0) : '0');

// `form` no tiene columna: es el orden «en forma» con el que llegan del servidor y el de partida.
type PlayerSortKey = 'form' | 'player' | 'matches' | 'minutes' | 'goals' | 'lastThree' | 'cards';
const playerGetters: Record<PlayerSortKey, (p: PreviewPlayerDto) => number | string> = {
  form: (p) => p.formScore,
  player: (p) => p.name,
  matches: (p) => p.matches * 100 + p.started,
  minutes: (p) => (p.matches > 0 ? p.minutes / p.matches : 0),
  goals: (p) => p.goals,
  lastThree: (p) => p.goalsLastThree,
  cards: (p) => p.redCards * 10 + p.yellowCards,
};
const homePlayers = computed(() => data.value?.home.inFormPlayers ?? []);
const awayPlayers = computed(() => data.value?.away.inFormPlayers ?? []);
const playerSorts = reactive([
  useSort<PreviewPlayerDto, PlayerSortKey>(homePlayers, playerGetters, 'form', { ascendingFirst: ['player'] }),
  useSort<PreviewPlayerDto, PlayerSortKey>(awayPlayers, playerGetters, 'form', { ascendingFirst: ['player'] }),
]);
</script>

<template>
  <Spinner v-if="loading && !data" label="Preparando la previa…" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <div v-else-if="data" class="space-y-6">
    <!-- Probabilidades -->
    <section class="card">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="eyebrow">Previa · {{ data.competitionName }} · jornada {{ data.match.matchday }}</p>
          <p v-if="data.asOf" class="mt-1 text-xs text-slate-500">
            <Icon icon="clock-rotate-left" class="mr-1 h-3 w-3 text-slate-400" />Con los datos hasta el inicio del partido ({{ formatKickoff(data.asOf) }}):
            {{ data.leagueMatchesBefore === 0 ? 'todavía no se había jugado nada en la liga' : `${data.leagueMatchesBefore} partidos de la liga jugados antes` }}<template v-if="data.tableFromResults && data.leagueMatchesBefore">, con la clasificación de ese día</template>.
          </p>
          <h2 class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xl font-bold text-slate-900">
            <TeamName :name="data.home.team.name" :crest-url="data.home.team.crestUrl" :short-name="data.home.team.shortName" size="sm" />
            <span class="text-slate-400">vs</span>
            <TeamName :name="data.away.team.name" :crest-url="data.away.team.crestUrl" :short-name="data.away.team.shortName" size="sm" />
          </h2>
        </div>
        <div v-if="favourite" class="text-right">
          <p class="text-xs uppercase tracking-wide text-slate-500">Favorito según los datos</p>
          <p class="flex flex-wrap items-center justify-end gap-2 break-words font-display text-2xl font-bold text-slate-900 sm:text-3xl">
            <TeamCrest v-if="favourite.team" :src="favourite.team.crestUrl" :name="favourite.team.name" :short-name="favourite.team.shortName" size="md" />
            {{ favourite.name }} <span class="text-brand-500">{{ pct(favourite.value) }}</span>
          </p>
        </div>
      </div>

      <div class="mt-5 flex h-9 w-full overflow-hidden rounded-lg text-xs font-semibold" role="img" :aria-label="`Victoria local ${pct(data.prediction.homeWin)}, empate ${pct(data.prediction.draw)}, victoria visitante ${pct(data.prediction.awayWin)}`">
        <div
          v-for="segment in segments"
          :key="segment.key"
          class="flex min-w-0 shrink-0 items-center justify-center overflow-hidden whitespace-nowrap"
          :class="segment.tone"
          :style="{ width: segment.width }"
          :title="`${segment.label}: ${segment.text}`"
        >
          <span v-if="segment.inside" class="truncate px-1">{{ segment.text }}</span>
        </div>
      </div>
      <div class="mt-2 grid grid-cols-1 gap-1 text-xs text-slate-500 sm:grid-cols-3 sm:gap-2">
        <span v-for="(segment, i) in segments" :key="segment.key" class="flex min-w-0 items-center gap-1.5" :class="i === 1 ? 'sm:justify-center' : i === 2 ? 'sm:justify-end' : ''">
          <span class="h-2.5 w-2.5 shrink-0 rounded-sm" :class="segment.tone" aria-hidden="true" />
          <span class="min-w-0 break-words">{{ segment.label }}</span>
          <strong class="tabular-nums text-slate-700">{{ segment.text }}</strong>
        </span>
      </div>

      <div v-if="finalScore" class="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm">
        <span class="text-slate-500">Así acabó:</span>
        <strong class="font-display text-lg tabular-nums text-slate-900">{{ data.home.team.shortName }} {{ finalScore.home }} – {{ finalScore.away }} {{ data.away.team.shortName }}</strong>
        <Badge :tone="predictedRight ? 'green' : 'slate'">{{ predictedRight ? 'La previa acertó el ganador' : 'La previa no acertó el ganador' }}</Badge>
      </div>

      <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-slate-500">Goles esperados</dt>
          <dd class="font-display text-xl font-bold text-slate-900">{{ data.prediction.expectedHomeGoals.toFixed(2) }} – {{ data.prediction.expectedAwayGoals.toFixed(2) }}</dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-slate-500">Resultado más probable</dt>
          <dd class="font-display text-xl font-bold text-slate-900">{{ data.prediction.mostLikelyScore }}</dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-slate-500">Actas públicas analizadas</dt>
          <dd class="font-display text-xl font-bold text-slate-900">{{ data.home.officialSheets }} / {{ data.away.officialSheets }}</dd>
        </div>
      </dl>

      <h3 class="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">Por qué</h3>
      <ul class="mt-2 space-y-1.5 text-sm text-slate-700">
        <li v-for="reason in data.prediction.reasons" :key="reason" class="flex gap-2">
          <Icon icon="circle-info" class="mt-1 h-3.5 w-3.5 shrink-0 text-brand-500" />
          <span>{{ reason }}</span>
        </li>
      </ul>
    </section>

    <!-- Equipos -->
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <section v-for="({ side, isMine, isRival }, i) in sides" :key="side.team.id" class="card" :class="isRival ? 'border-amber-400/50' : ''">
        <div class="flex items-center gap-3">
          <TeamCrest :src="side.team.crestUrl" :name="side.team.name" :short-name="side.team.shortName" size="lg" />
          <div class="min-w-0 flex-1">
            <h3 class="min-w-0 break-words text-lg font-semibold text-slate-900">{{ side.team.name }}</h3>
            <p class="text-xs text-slate-500">
              {{ side.position ? `${side.position}º` : 'Sin clasificar' }} · {{ side.points }} pts · {{ record(side) }} · {{ side.goalsFor }}:{{ side.goalsAgainst }}
            </p>
          </div>
          <Badge v-if="isMine" tone="green">Mi equipo</Badge>
          <Badge v-else-if="isRival" tone="amber">Rival</Badge>
        </div>

        <dl class="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div class="rounded-lg bg-surface-2 py-2"><dt class="text-xs text-slate-500">Pts/partido</dt><dd class="font-semibold text-slate-900">{{ side.pointsPerMatch.toFixed(2) }}</dd></div>
          <div class="rounded-lg bg-surface-2 py-2"><dt class="text-xs text-slate-500">Goles a favor</dt><dd class="font-semibold text-slate-900">{{ side.goalsForPerMatch.toFixed(2) }}</dd></div>
          <div class="rounded-lg bg-surface-2 py-2"><dt class="text-xs text-slate-500">En contra</dt><dd class="font-semibold text-slate-900">{{ side.goalsAgainstPerMatch.toFixed(2) }}</dd></div>
        </dl>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
          <div>
            <p class="text-xs text-slate-500">Últimos {{ side.form.length }}</p>
            <div class="mt-1 flex gap-1">
              <span
                v-for="result in side.form"
                :key="result.matchId"
                class="flex flex-col items-center gap-0.5"
                :title="`J${result.matchday} ${result.home ? 'vs' : 'en'} ${result.opponentName}: ${result.goalsFor}-${result.goalsAgainst}`"
              >
                <TeamCrest :src="result.opponentCrestUrl ?? `/api/teams/${result.opponentId}/crest`" :name="result.opponentName" size="xs" />
                <span class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" :class="outcomeTone[result.outcome]">{{ outcomeLetter[result.outcome] }}</span>
              </span>
              <span v-if="side.form.length === 0" class="text-xs text-slate-400">sin partidos</span>
            </div>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-500">Como {{ side.atVenue.label === 'en casa' ? 'local' : 'visitante' }}</p>
            <p class="font-semibold text-slate-900">{{ side.atVenue.won }}V-{{ side.atVenue.drawn }}E-{{ side.atVenue.lost }}D · {{ side.atVenue.goalsFor }}:{{ side.atVenue.goalsAgainst }}</p>
          </div>
        </div>

        <!-- Jugadores en forma (actas públicas) -->
        <h4 class="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Jugadores en forma <span class="font-normal normal-case">· según {{ side.officialSheets }} actas públicas</span>
        </h4>
        <p v-if="side.inFormPlayers.length === 0" class="mt-2 text-sm text-slate-500">Todavía no hay actas públicas guardadas de sus partidos.</p>
        <div v-else class="mt-2 overflow-x-auto">
          <table class="table-sticky min-w-full text-sm">
            <thead class="text-xs text-slate-500">
              <tr>
                <SortHeader class="py-1 pr-2 text-left" label="Jugador" v-bind="playerSorts[i].state('player')" @sort="playerSorts[i].sortBy('player')" />
                <SortHeader class="px-2 py-1 text-center" label="PJ" title="Partidos (titular)" v-bind="playerSorts[i].state('matches')" @sort="playerSorts[i].sortBy('matches')" />
                <SortHeader class="col-sm px-2 py-1 text-center" label="Min/PJ" title="Minutos por partido" v-bind="playerSorts[i].state('minutes')" @sort="playerSorts[i].sortBy('minutes')" />
                <SortHeader class="px-2 py-1 text-center" label="Goles" title="Goles (de penalti)" v-bind="playerSorts[i].state('goals')" @sort="playerSorts[i].sortBy('goals')" />
                <SortHeader class="col-md px-2 py-1 text-center" label="Últ. 3" title="Goles en los tres últimos partidos" v-bind="playerSorts[i].state('lastThree')" @sort="playerSorts[i].sortBy('lastThree')" />
                <SortHeader class="px-2 py-1 text-center" label="TA/TR" title="Tarjetas amarillas / rojas (la roja pesa más)" v-bind="playerSorts[i].state('cards')" @sort="playerSorts[i].sortBy('cards')" />
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="player in playerSorts[i].sorted" :key="player.name">
                <td class="py-1 pr-2 lg:whitespace-nowrap">
                  <PlayerName :name="player.name" :photo-url="player.photoUrl" class="font-medium text-slate-800" />
                </td>
                <td class="px-2 py-1 text-center tabular-nums">{{ player.matches }} <span class="text-slate-400">({{ player.started }})</span></td>
                <td class="col-sm px-2 py-1 text-center tabular-nums">{{ perMatch(player) }}'</td>
                <td class="px-2 py-1 text-center tabular-nums font-semibold">{{ player.goals }}<span v-if="player.penaltyGoals" class="font-normal text-slate-400"> ({{ player.penaltyGoals }}p)</span></td>
                <td class="col-md px-2 py-1 text-center tabular-nums">{{ player.goalsLastThree }}</td>
                <td class="px-2 py-1 text-center tabular-nums"><span class="text-amber-700">{{ player.yellowCards }}</span> / <span class="text-red-600">{{ player.redCards }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div class="rounded-lg border border-line px-2 py-1.5"><dt class="text-slate-500">Penaltis a favor</dt><dd class="font-semibold text-slate-900">{{ side.setPieces.penaltyGoalsFor }}</dd></div>
          <div class="rounded-lg border border-line px-2 py-1.5"><dt class="text-slate-500">Penaltis en contra</dt><dd class="font-semibold text-slate-900">{{ side.setPieces.penaltyGoalsAgainst }}</dd></div>
          <div class="rounded-lg border border-line px-2 py-1.5"><dt class="text-slate-500">Goles en propia (rival)</dt><dd class="font-semibold text-slate-900">{{ side.setPieces.ownGoalsFor }}</dd></div>
          <div class="rounded-lg border border-line px-2 py-1.5"><dt class="text-slate-500">Tarjetas</dt><dd class="font-semibold text-slate-900">{{ side.setPieces.yellowCards }} <span class="text-amber-700">TA</span> · {{ side.setPieces.redCards }} <span class="text-red-600">TR</span></dd></div>
        </dl>
      </section>
    </div>

    <!-- Precedentes: todos los enfrentamientos anteriores guardados, también de temporadas pasadas -->
    <section v-if="h2h" class="card">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h3 class="font-semibold text-slate-900"><Icon icon="arrow-right-arrow-left" class="mr-2 h-4 w-4 text-slate-400" />Precedentes</h3>
        <p v-if="h2h.played > 0" class="text-xs text-slate-500">
          {{ h2h.played }} {{ h2h.played === 1 ? 'partido' : 'partidos' }} antes de este<template v-if="h2h.seasons > 1"> en {{ h2h.seasons }} temporadas</template>
        </p>
      </div>
      <p v-if="h2h.played === 0" class="mt-2 text-sm text-slate-500">
        No hay enfrentamientos anteriores guardados entre los dos equipos (ni esta temporada ni en las pasadas que hay en Tercer Tiempo).
      </p>
      <template v-else>
        <dl class="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div class="rounded-lg bg-sky-100 py-2 text-sky-800"><dt class="break-words px-1 text-xs">Gana {{ data.home.team.shortName }}</dt><dd class="font-display text-xl font-bold tabular-nums">{{ h2h.homeWins }}</dd></div>
          <div class="rounded-lg bg-slate-100 py-2 text-slate-700"><dt class="text-xs">Empates</dt><dd class="font-display text-xl font-bold tabular-nums">{{ h2h.draws }}</dd></div>
          <div class="rounded-lg bg-amber-100 py-2 text-amber-800"><dt class="break-words px-1 text-xs">Gana {{ data.away.team.shortName }}</dt><dd class="font-display text-xl font-bold tabular-nums">{{ h2h.awayWins }}</dd></div>
        </dl>
        <p class="mt-2 text-center text-xs tabular-nums text-slate-500">Goles: {{ data.home.team.shortName }} {{ h2h.homeGoals }} – {{ h2h.awayGoals }} {{ data.away.team.shortName }}</p>

        <div v-for="group in h2hSeasons" :key="group.season" class="mt-4">
          <h4 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Temporada {{ group.season }}</h4>
          <ul class="mt-1 divide-y divide-line">
            <li v-for="m in group.matches" :key="m.matchId" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold" :class="outcomeTone[m.outcome]" :title="`Para ${data.home.team.shortName}`">{{ outcomeLetter[m.outcome] }}</span>
              <RouterLink :to="{ name: 'match', params: { matchId: m.matchId } }" class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 hover:text-accent-400">
                <TeamName :name="m.homeTeam.name" :crest-url="m.homeTeam.crestUrl" :short-name="m.homeTeam.shortName" size="xs" />
                <strong class="tabular-nums text-slate-900">{{ m.homeGoals }} – {{ m.awayGoals }}</strong>
                <TeamName :name="m.awayTeam.name" :crest-url="m.awayTeam.crestUrl" :short-name="m.awayTeam.shortName" size="xs" />
              </RouterLink>
              <span class="w-full text-xs text-slate-500 sm:w-auto sm:text-right">
                {{ m.sameSeason ? 'Esta temporada' : m.competitionName }} · J{{ m.matchday }} · {{ formatDate(m.kickoffAt) }}
              </span>
            </li>
          </ul>
        </div>
      </template>
    </section>

    <!-- Lo que apunta tu cuerpo técnico (córners, posesión, tiros…), que no está en ninguna fuente pública -->
    <TeamSeasonStats v-if="squadId && myTeamId" compact :squad-id="squadId" :team-id="myTeamId" />

    <section class="rounded-xl border border-line bg-surface-2 p-4 text-xs text-slate-500">
      <p v-for="note in data.dataNotes" :key="note" class="flex gap-2"><Icon icon="triangle-exclamation" class="mt-0.5 h-3 w-3 shrink-0 text-amber-500" /><span>{{ note }}</span></p>
    </section>
  </div>
</template>
