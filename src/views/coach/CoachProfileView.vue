<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import PlayerHeroCard, { type HeroStat } from '@/components/players/PlayerHeroCard.vue';
import PlayerPhotoWizard from '@/components/players/PlayerPhotoWizard.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import CardTally from '@/components/ui/CardTally.vue';
import Spinner from '@/components/ui/Spinner.vue';
import DisciplineBadge from '@/components/squads/DisciplineBadge.vue';
import { useAsync } from '@/composables/useAsync';
import { useBackFallback } from '@/composables/useBackFallback';
import { useAuthStore } from '@/stores/auth';
import type { CoachDto, CoachTeamDto } from '@/types/api';
import { crestFor } from '@/utils/crests';
import { formatDate, formatNumber, staffRoleLabels } from '@/utils/format';

/**
 * Perfil de un miembro del cuerpo técnico (entrenador, ayudante, fisio, delegado...), como la ficha de un jugador: su
 * foto, su balance (partidos ganados, empatados y perdidos de sus equipos mientras estuvo y la posición media en la
 * clasificación), los equipos con los que está ahora y su historial de equipos y temporadas por los nombramientos de sus
 * clubes. En los equipos de ahora, sus tarjetas de la temporada en las actas oficiales y si llega apercibido o
 * sancionado al próximo partido (el del equipo principal, en la cabecera). Lo ve cualquier cuenta con sesión; la foto
 * solo la sube, cambia o quita él mismo.
 */
const props = defineProps<{ coachId: string }>();
const auth = useAuthStore();
useBackFallback(() => ({ to: { name: 'home' }, label: 'Volver al inicio' }));

const { data, loading, error, run } = useAsync(() => api.coaches.profile(props.coachId));
// De un perfil a otro la vista se reutiliza: se vuelve a pedir el nuevo.
watch(() => props.coachId, () => void run());

const current = computed(() => data.value?.teams.filter((t) => t.current) ?? []);
const main = computed(() => current.value[0] ?? null);

// Historial completo por temporadas, de la más reciente a la más antigua (el servidor ya los manda ordenados).
const history = computed(() => {
  const seasons = new Map<string, CoachTeamDto[]>();
  for (const team of data.value?.teams ?? []) seasons.set(team.seasonLabel, [...(seasons.get(team.seasonLabel) ?? []), team]);
  return [...seasons.entries()].sort(([a], [b]) => b.localeCompare(a)).map(([season, teams]) => ({ season, teams }));
});

const summary = computed(() => data.value?.summary ?? null);

const heroStats = computed<HeroStat[]>(() => {
  const teams = data.value?.teams ?? [];
  const s = summary.value;
  return [
    { label: 'Partidos', value: s?.played ?? 0 },
    { label: 'Ganados', value: s?.played ? s.won : '—' },
    { label: 'Empatados', value: s?.played ? s.drawn : '—' },
    { label: 'Perdidos', value: s?.played ? s.lost : '—' },
    { label: 'Puntos por partido', value: s?.pointsPerMatch != null ? formatNumber(s.pointsPerMatch, 2) : '—' },
    { label: 'Posición media', value: s?.averagePosition != null ? formatNumber(s.averagePosition, 1) : '—' },
    { label: 'Temporadas', value: new Set(teams.map((t) => t.seasonLabel)).size },
  ];
});

/** Ganados, empatados y perdidos en una barra, con su porcentaje. */
const outcomes = computed(() => {
  const s = summary.value;
  if (!s || s.played === 0) return [];
  return [
    { key: 'won', label: 'Ganados', count: s.won, pct: s.winPct ?? 0, bar: 'bg-emerald-500', text: 'text-success' },
    { key: 'drawn', label: 'Empatados', count: s.drawn, pct: s.drawPct ?? 0, bar: 'bg-slate-400', text: 'text-slate-500' },
    { key: 'lost', label: 'Perdidos', count: s.lost, pct: s.lossPct ?? 0, bar: 'bg-red-500', text: 'text-danger' },
  ];
});

const percent = (value: number) => `${formatNumber(value, 1)} %`;
const ordinal = (team: CoachTeamDto) => (team.position ? `${team.position}.º${team.teamsInTable ? ` de ${team.teamsInTable}` : ''}` : null);

const meta = computed(() => {
  if (!main.value) return 'Sin equipo esta temporada';
  const others = current.value.length - 1;
  return `${staffRoleLabels[main.value.role]} · ${main.value.clubName}${others > 0 ? ` · y ${others} equipo${others === 1 ? '' : 's'} más` : ''}`;
});

/** La plantilla es privada: solo se ofrece abrirla a quien tiene acceso (su cuerpo técnico o el club del equipo). */
const canOpenSquad = (team: CoachTeamDto) => !!team.squadId && (auth.isMySquad(team.squadId) || (auth.isClub && auth.isMyTeam(team.teamId)));
const period = (team: CoachTeamDto) => `Del ${formatDate(team.validFrom)} al ${formatDate(team.leftOn ?? team.validUntil)}`;
// Las actas públicas firman el cuerpo técnico de cada partido: «en 12 de 14 actas como Entrenador».
const actas = (team: CoachTeamDto) =>
  team.officialAppearances
    ? `${team.officialAppearances} de ${team.officialSheets} actas${team.officialRole ? ` como ${team.officialRole}` : ''}`
    : `No figura en las ${team.officialSheets} actas`;
const actasTitle = (team: CoachTeamDto) =>
  `Actas públicas guardadas de los partidos del equipo mientras estuvo (${team.officialSheets}) y en cuántas aparece con su nombre.`;

const photoOpen = ref(false);
function onPhotoSaved(coach: CoachDto) {
  auth.setCoach(coach);
  void run();
}
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <PlayerHeroCard
      class="mb-6"
      :team="main ? `${main.teamName} · ${main.seasonLabel}` : 'Cuerpo técnico'"
      :team-crest-url="main?.teamCrestUrl"
      :team-id="main?.teamId"
      :name="data.displayName"
      :photo-url="data.photoUrl"
      :meta="meta"
      :stats="heroStats"
    >
      <template #actions>
        <Badge tone="blue"><Icon icon="user-group" class="mr-1 text-2xs" />Cuerpo técnico</Badge>
        <DisciplineBadge v-if="main" :discipline="main.discipline?.next" staff reason />
        <button v-if="data.isMe" type="button" class="btn-primary" @click="photoOpen = true">
          <Icon icon="camera" class="mr-1.5 h-3.5 w-3.5" />{{ data.photoUrl ? 'Cambiar mi foto' : 'Subir mi foto' }}
        </button>
        <RouterLink
          v-if="data.isMe"
          :to="{ name: 'settings' }"
          class="group grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface text-slate-600 shadow-sm transition hover:border-brand-400/60 hover:text-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          title="Ajustes de tu cuenta: tema, contraseña y más"
          aria-label="Ajustes de tu cuenta"
        >
          <Icon icon="gear" class="h-4 w-4 transition-transform duration-500 group-hover:rotate-90" />
        </RouterLink>
      </template>
    </PlayerHeroCard>

    <section v-if="summary && summary.played > 0" class="card mb-6">
      <h2 class="font-semibold text-slate-900"><Icon icon="chart-line" class="mr-2 h-4 w-4 text-slate-400" />Balance</h2>
      <p class="text-xs text-slate-500">
        Los partidos de sus equipos mientras estuvo con ellos, del primer día de su nombramiento hasta que lo dejó o acabó, cada partido una vez.
      </p>
      <div class="mt-4 flex h-2.5 overflow-hidden rounded-full bg-surface-3" role="img" :aria-label="outcomes.map((o) => `${o.label}: ${o.count} (${percent(o.pct)})`).join(', ')">
        <div v-for="o in outcomes" :key="o.key" :class="o.bar" :style="{ width: `${o.pct}%` }" />
      </div>
      <dl class="mt-3 grid grid-cols-3 gap-2 text-center">
        <div v-for="o in outcomes" :key="o.key" class="min-w-0 rounded-xl border border-line bg-surface-2 p-2.5">
          <dt class="break-words text-2xs text-slate-500">{{ o.label }}</dt>
          <dd class="text-lg font-bold tabular-nums text-slate-900">{{ o.count }}</dd>
          <dd class="text-xs font-semibold tabular-nums" :class="o.text">{{ percent(o.pct) }}</dd>
        </div>
      </dl>
      <p class="mt-3 text-xs text-slate-500">
        {{ summary.played }} {{ summary.played === 1 ? 'partido' : 'partidos' }} · {{ summary.points }} puntos ·
        {{ summary.goalsFor }} goles a favor y {{ summary.goalsAgainst }} en contra<template v-if="summary.averagePosition != null"> ·
        posición media {{ formatNumber(summary.averagePosition, 1) }} ({{ summary.rankedTeams }} {{ summary.rankedTeams === 1 ? 'equipo y temporada' : 'equipos y temporadas' }})</template>.
      </p>
    </section>

    <section class="card mb-6">
      <h2 class="font-semibold text-slate-900">{{ data.isMe ? 'Tus equipos ahora' : 'Equipos ahora' }}</h2>
      <p class="text-xs text-slate-500">Por los nombramientos de su club: cada uno vale como mucho una temporada.</p>

      <p v-if="current.length === 0" class="mt-4 text-sm text-slate-500">Ahora mismo no tiene ningún nombramiento vigente.</p>
      <ul v-else class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <li v-for="team in current" :key="`${team.teamId}-${team.seasonLabel}`" class="rounded-xl border border-line bg-surface-2 p-4">
          <div class="flex items-center gap-3">
            <TeamCrest :src="crestFor(team.teamCrestUrl, team.teamId)" :name="team.teamName" :short-name="team.teamShortName" size="lg" />
            <div class="min-w-0 flex-1">
              <RouterLink :to="{ name: 'team', params: { teamId: team.teamId } }" class="block break-words font-semibold text-slate-900 hover:text-accent-400">{{ team.teamName }}</RouterLink>
              <p class="break-words text-xs text-slate-500">{{ team.competitionName }} · {{ team.seasonLabel }}</p>
            </div>
            <Badge tone="green">Vigente</Badge>
          </div>
          <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="min-w-0"><dt class="text-slate-500">Función</dt><dd class="font-semibold text-slate-800">{{ staffRoleLabels[team.role] }}</dd></div>
            <div class="min-w-0"><dt class="text-slate-500">Club</dt><dd class="break-words font-semibold text-slate-800">{{ team.clubName }}</dd></div>
            <div v-if="team.record && team.record.played > 0" class="min-w-0">
              <dt class="text-slate-500">Balance</dt>
              <dd class="font-semibold tabular-nums text-slate-800">
                <span class="text-success">{{ team.record.won }} G</span> · {{ team.record.drawn }} E · <span class="text-danger">{{ team.record.lost }} P</span>
              </dd>
            </div>
            <div v-if="ordinal(team)" class="min-w-0"><dt class="text-slate-500">Clasificación</dt><dd class="font-semibold tabular-nums text-slate-800">{{ ordinal(team) }}</dd></div>
            <div v-if="team.officialSheets" class="col-span-2 min-w-0">
              <dt class="text-slate-500">En las actas de la federación</dt>
              <dd class="font-semibold tabular-nums text-slate-800" :title="actasTitle(team)">{{ actas(team) }}</dd>
            </div>
            <div v-if="team.discipline" class="col-span-2 min-w-0">
              <dt class="text-slate-500">Tarjetas esta temporada</dt>
              <dd class="mt-0.5 flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                <CardTally :yellow-cards="team.discipline.yellowCards" :red-cards="team.discipline.redCards" title="Tarjetas de la temporada en las actas oficiales cerradas" />
                <span v-if="!team.discipline.yellowCards && !team.discipline.redCards">Ninguna</span>
                <!-- La del equipo principal ya va en la cabecera. -->
                <DisciplineBadge v-if="team !== main" :discipline="team.discipline.next" staff reason />
              </dd>
            </div>
          </dl>
          <p class="mt-2 text-xs text-slate-500">{{ period(team) }}</p>
          <RouterLink v-if="canOpenSquad(team)" :to="{ name: 'squad', params: { squadId: team.squadId } }" class="btn-secondary mt-3 w-full">
            <Icon icon="table-list" class="h-3.5 w-3.5" />Abrir la plantilla
          </RouterLink>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2 class="font-semibold text-slate-900"><Icon icon="clock-rotate-left" class="mr-2 h-4 w-4 text-slate-400" />Historial de equipos</h2>
      <p class="text-xs text-slate-500">Todos los equipos con los que ha estado en Tercer Tiempo, temporada a temporada, con su función y sus fechas.</p>

      <p v-if="history.length === 0" class="mt-4 text-sm text-slate-500">Todavía no ha estado en ningún equipo con un nombramiento de su club.</p>
      <div v-for="group in history" :key="group.season" class="mt-4">
        <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">Temporada {{ group.season }}</h3>
        <ul class="mt-1 divide-y divide-line">
          <li v-for="team in group.teams" :key="`${team.teamId}-${team.role}-${team.validFrom}`" class="flex flex-wrap items-center gap-3 py-2.5">
            <TeamCrest :src="crestFor(team.teamCrestUrl, team.teamId)" :name="team.teamName" :short-name="team.teamShortName" size="sm" />
            <div class="min-w-0 flex-1">
              <RouterLink :to="{ name: 'team', params: { teamId: team.teamId } }" class="block break-words text-sm font-medium text-slate-800 hover:text-accent-400">{{ team.teamName }}</RouterLink>
              <p class="break-words text-xs text-slate-500">{{ staffRoleLabels[team.role] }} · {{ team.clubName }} · {{ team.competitionName }}</p>
              <p v-if="(team.record && team.record.played > 0) || ordinal(team)" class="mt-0.5 flex flex-wrap gap-x-2 text-xs tabular-nums text-slate-600">
                <span v-if="team.record && team.record.played > 0" :title="`${team.record.goalsFor} goles a favor y ${team.record.goalsAgainst} en contra`">
                  {{ team.record.played }} PJ ·
                  <span class="text-success">{{ team.record.won }} G</span> · {{ team.record.drawn }} E · <span class="text-danger">{{ team.record.lost }} P</span>
                  · {{ team.record.points }} pts
                </span>
                <span v-if="ordinal(team)" class="font-semibold text-slate-800"><Icon icon="list-ol" class="mr-0.5 h-3 w-3 text-slate-400" />{{ ordinal(team) }}</span>
                <span v-if="team.officialSheets" :title="actasTitle(team)"><Icon icon="file-lines" class="mr-0.5 h-3 w-3 text-slate-400" />{{ actas(team) }}</span>
              </p>
            </div>
            <div class="shrink-0 text-right text-xs text-slate-500">
              <Badge v-if="team.current" tone="green">Vigente</Badge>
              <Badge v-else-if="team.leftOn" tone="amber">Dejó el equipo</Badge>
              <p class="mt-0.5">{{ period(team) }}</p>
            </div>
          </li>
        </ul>
      </div>
    </section>

    <PlayerPhotoWizard v-if="data.isMe" kind="coach" :open="photoOpen" :has-photo="!!data.photoUrl" @close="photoOpen = false" @saved-coach="onPhotoSaved" />
  </template>
</template>
