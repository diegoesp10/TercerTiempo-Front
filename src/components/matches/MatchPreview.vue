<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import type { FormResultDto, PreviewPlayerDto, TeamPreviewDto } from '@/types/api';

/**
 * Previa del partido para el cuerpo técnico: probabilidades con sus razones, forma y balance de cada equipo y los
 * jugadores en forma del rival según las actas oficiales. `myTeamId` orienta la lectura (quién es el rival).
 */
const props = defineProps<{ matchId: string; myTeamId?: string }>();

const { data, loading, error } = useAsync(() => api.matches.preview(props.matchId));

const pct = (value: number) => `${Math.round(value * 100)}%`;

const sides = computed(() => {
  if (!data.value) return [];
  const { home, away } = data.value;
  return [home, away].map((side) => ({ side, isMine: side.team.id === props.myTeamId, isRival: !!props.myTeamId && side.team.id !== props.myTeamId }));
});

const favourite = computed(() => {
  if (!data.value) return null;
  const p = data.value.prediction;
  if (p.homeWin >= p.draw && p.homeWin >= p.awayWin) return { name: data.value.home.team.name, value: p.homeWin };
  if (p.awayWin >= p.draw) return { name: data.value.away.team.name, value: p.awayWin };
  return { name: 'Empate', value: p.draw };
});

const outcomeTone: Record<FormResultDto['outcome'], string> = {
  W: 'bg-emerald-500 text-white',
  D: 'bg-slate-400 text-white',
  L: 'bg-red-500 text-white',
};
const outcomeLetter: Record<FormResultDto['outcome'], string> = { W: 'V', D: 'E', L: 'D' };

const record = (t: TeamPreviewDto) => `${t.won}V-${t.drawn}E-${t.lost}D`;
const perMatch = (p: PreviewPlayerDto) => (p.matches > 0 ? (p.minutes / p.matches).toFixed(0) : '0');
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
          <h2 class="mt-1 text-2xl font-bold text-slate-900">
            {{ data.home.team.name }} <span class="text-slate-400">vs</span> {{ data.away.team.name }}
          </h2>
        </div>
        <div v-if="favourite" class="text-right">
          <p class="text-xs uppercase tracking-wide text-slate-500">Favorito según los datos</p>
          <p class="font-display text-3xl font-bold text-slate-900">{{ favourite.name }} <span class="text-brand-500">{{ pct(favourite.value) }}</span></p>
        </div>
      </div>

      <div class="mt-5 flex h-9 w-full overflow-hidden rounded-lg text-xs font-semibold text-white" role="img" :aria-label="`Victoria local ${pct(data.prediction.homeWin)}, empate ${pct(data.prediction.draw)}, victoria visitante ${pct(data.prediction.awayWin)}`">
        <div class="flex items-center justify-center bg-brand-500" :style="{ width: pct(data.prediction.homeWin) }">{{ pct(data.prediction.homeWin) }}</div>
        <div class="flex items-center justify-center bg-slate-400" :style="{ width: pct(data.prediction.draw) }">{{ pct(data.prediction.draw) }}</div>
        <div class="flex items-center justify-center bg-amber-500" :style="{ width: pct(data.prediction.awayWin) }">{{ pct(data.prediction.awayWin) }}</div>
      </div>
      <div class="mt-1 flex justify-between text-xs text-slate-500">
        <span>Gana {{ data.home.team.shortName }}</span><span>Empate</span><span>Gana {{ data.away.team.shortName }}</span>
      </div>

      <dl class="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-slate-500">Goles esperados</dt>
          <dd class="font-display text-xl font-bold text-slate-900">{{ data.prediction.expectedHomeGoals.toFixed(2) }} – {{ data.prediction.expectedAwayGoals.toFixed(2) }}</dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-slate-500">Resultado más probable</dt>
          <dd class="font-display text-xl font-bold text-slate-900">{{ data.prediction.mostLikelyScore }}</dd>
        </div>
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
          <dt class="text-xs text-slate-500">Actas oficiales analizadas</dt>
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
    <div class="grid gap-6 lg:grid-cols-2">
      <section v-for="{ side, isMine, isRival } in sides" :key="side.team.id" class="card" :class="isRival ? 'border-amber-400/50' : ''">
        <div class="flex items-center gap-3">
          <TeamCrest :src="side.team.crestUrl" :name="side.team.name" :short-name="side.team.shortName" size="lg" />
          <div class="min-w-0 flex-1">
            <h3 class="truncate text-lg font-semibold text-slate-900">{{ side.team.name }}</h3>
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
                class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                :class="outcomeTone[result.outcome]"
                :title="`J${result.matchday} ${result.home ? 'vs' : 'en'} ${result.opponentName}: ${result.goalsFor}-${result.goalsAgainst}`"
              >{{ outcomeLetter[result.outcome] }}</span>
              <span v-if="side.form.length === 0" class="text-xs text-slate-400">sin partidos</span>
            </div>
          </div>
          <div class="text-right">
            <p class="text-xs text-slate-500">Como {{ side.atVenue.label === 'en casa' ? 'local' : 'visitante' }}</p>
            <p class="font-semibold text-slate-900">{{ side.atVenue.won }}V-{{ side.atVenue.drawn }}E-{{ side.atVenue.lost }}D · {{ side.atVenue.goalsFor }}:{{ side.atVenue.goalsAgainst }}</p>
          </div>
        </div>

        <!-- Jugadores en forma (actas oficiales) -->
        <h4 class="mt-5 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Jugadores en forma <span class="font-normal normal-case">· según {{ side.officialSheets }} actas oficiales</span>
        </h4>
        <p v-if="side.inFormPlayers.length === 0" class="mt-2 text-sm text-slate-500">Todavía no hay actas oficiales descargadas de sus partidos.</p>
        <div v-else class="mt-2 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="py-1 pr-2 text-left">Jugador</th>
                <th class="px-2 py-1 text-center" title="Partidos (titular)">PJ</th>
                <th class="col-sm px-2 py-1 text-center" title="Minutos por partido">Min/PJ</th>
                <th class="px-2 py-1 text-center" title="Goles (de penalti)">Goles</th>
                <th class="col-md px-2 py-1 text-center" title="Goles en los tres últimos partidos">Últ. 3</th>
                <th class="px-2 py-1 text-center" title="Tarjetas amarillas / rojas">TA/TR</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="player in side.inFormPlayers" :key="player.name">
                <td class="py-1 pr-2 whitespace-nowrap">
                  <span v-if="player.shirtNumber" class="mr-1 text-slate-400">{{ player.shirtNumber }}</span>
                  <span class="font-medium text-slate-800">{{ player.name }}</span>
                </td>
                <td class="px-2 py-1 text-center tabular-nums">{{ player.matches }} <span class="text-slate-400">({{ player.started }})</span></td>
                <td class="col-sm px-2 py-1 text-center tabular-nums">{{ perMatch(player) }}'</td>
                <td class="px-2 py-1 text-center tabular-nums font-semibold">{{ player.goals }}<span v-if="player.penaltyGoals" class="font-normal text-slate-400"> ({{ player.penaltyGoals }}p)</span></td>
                <td class="col-md px-2 py-1 text-center tabular-nums">{{ player.goalsLastThree }}</td>
                <td class="px-2 py-1 text-center tabular-nums"><span class="text-amber-600">{{ player.yellowCards }}</span> / <span class="text-red-600">{{ player.redCards }}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        <dl class="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div class="rounded-lg border border-line px-2 py-1.5"><dt class="text-slate-500">Penaltis a favor</dt><dd class="font-semibold text-slate-900">{{ side.setPieces.penaltyGoalsFor }}</dd></div>
          <div class="rounded-lg border border-line px-2 py-1.5"><dt class="text-slate-500">Penaltis en contra</dt><dd class="font-semibold text-slate-900">{{ side.setPieces.penaltyGoalsAgainst }}</dd></div>
          <div class="rounded-lg border border-line px-2 py-1.5"><dt class="text-slate-500">Goles en propia (rival)</dt><dd class="font-semibold text-slate-900">{{ side.setPieces.ownGoalsFor }}</dd></div>
          <div class="rounded-lg border border-line px-2 py-1.5"><dt class="text-slate-500">Tarjetas</dt><dd class="font-semibold text-slate-900">{{ side.setPieces.yellowCards }} <span class="text-amber-600">TA</span> · {{ side.setPieces.redCards }} <span class="text-red-600">TR</span></dd></div>
        </dl>
      </section>
    </div>

    <section class="rounded-xl border border-line bg-surface-2 p-4 text-xs text-slate-500">
      <p v-for="note in data.dataNotes" :key="note" class="flex gap-2"><Icon icon="triangle-exclamation" class="mt-0.5 h-3 w-3 shrink-0 text-amber-500" /><span>{{ note }}</span></p>
    </section>
  </div>
</template>
