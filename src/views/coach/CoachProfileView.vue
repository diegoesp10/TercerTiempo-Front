<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import PlayerHeroCard, { type HeroStat } from '@/components/players/PlayerHeroCard.vue';
import PlayerPhotoWizard from '@/components/players/PlayerPhotoWizard.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useBackFallback } from '@/composables/useBackFallback';
import { useAuthStore } from '@/stores/auth';
import type { CoachDto, CoachTeamDto } from '@/types/api';
import { crestFor } from '@/utils/crests';
import { formatDate, staffRoleLabels } from '@/utils/format';

/**
 * Perfil de un técnico, como la ficha de un jugador: su foto, el equipo que dirige y los que ha dirigido por los
 * nombramientos de sus clubes. Lo ve cualquier cuenta con sesión; la foto solo la sube, cambia o quita él mismo.
 */
const props = defineProps<{ coachId: string }>();
const auth = useAuthStore();
useBackFallback(() => ({ to: { name: 'home' }, label: 'Volver al inicio' }));

const { data, loading, error, run } = useAsync(() => api.coaches.profile(props.coachId));
// De un perfil a otro la vista se reutiliza: se vuelve a pedir el nuevo.
watch(() => props.coachId, () => void run());

const current = computed(() => data.value?.teams.filter((t) => t.current) ?? []);
const previous = computed(() => data.value?.teams.filter((t) => !t.current) ?? []);
const main = computed(() => current.value[0] ?? null);

const heroStats = computed<HeroStat[]>(() => {
  const teams = data.value?.teams ?? [];
  const firstYear = teams.map((t) => t.validFrom.slice(0, 4)).sort()[0];
  return [
    { label: 'Equipos ahora', value: current.value.length },
    { label: 'Temporadas', value: new Set(teams.map((t) => t.seasonLabel)).size },
    { label: 'Clubes', value: new Set(teams.map((t) => t.clubName)).size },
    { label: 'Desde', value: firstYear ?? '—' },
  ];
});

const meta = computed(() => {
  if (!main.value) return 'Sin equipo esta temporada';
  const others = current.value.length - 1;
  return `${staffRoleLabels[main.value.role]} · ${main.value.clubName}${others > 0 ? ` · y ${others} equipo${others === 1 ? '' : 's'} más` : ''}`;
});

/** La plantilla es privada: solo se ofrece abrirla a quien tiene acceso (su cuerpo técnico o el club del equipo). */
const canOpenSquad = (team: CoachTeamDto) => !!team.squadId && (auth.isMySquad(team.squadId) || (auth.isClub && auth.isMyTeam(team.teamId)));
const period = (team: CoachTeamDto) => `Del ${formatDate(team.validFrom)} al ${formatDate(team.validUntil)}`;

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
        <Badge tone="blue"><Icon icon="user-group" class="mr-1 text-[11px]" />Cuerpo técnico</Badge>
        <button v-if="data.isMe" type="button" class="btn-primary" @click="photoOpen = true">
          <Icon icon="camera" class="mr-1.5 h-3.5 w-3.5" />{{ data.photoUrl ? 'Cambiar mi foto' : 'Subir mi foto' }}
        </button>
      </template>
    </PlayerHeroCard>

    <section class="card mb-6">
      <h2 class="font-semibold text-slate-900">{{ data.isMe ? 'Equipos que diriges' : 'Equipos que dirige' }}</h2>
      <p class="text-xs text-slate-500">Por los nombramientos de su club: cada uno vale como mucho una temporada.</p>

      <p v-if="current.length === 0" class="mt-4 text-sm text-slate-500">Ahora mismo no tiene ningún nombramiento vigente.</p>
      <ul v-else class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <li v-for="team in current" :key="`${team.teamId}-${team.seasonLabel}`" class="rounded-xl border border-line bg-surface-2 p-4">
          <div class="flex items-center gap-3">
            <TeamCrest :src="crestFor(team.teamCrestUrl, team.teamId)" :name="team.teamName" :short-name="team.teamShortName" size="lg" />
            <div class="min-w-0 flex-1">
              <RouterLink :to="{ name: 'team', params: { teamId: team.teamId } }" class="block truncate font-semibold text-slate-900 hover:text-accent-400">{{ team.teamName }}</RouterLink>
              <p class="truncate text-xs text-slate-500">{{ team.competitionName }} · {{ team.seasonLabel }}</p>
            </div>
            <Badge tone="green">Vigente</Badge>
          </div>
          <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div><dt class="text-slate-500">Función</dt><dd class="font-semibold text-slate-800">{{ staffRoleLabels[team.role] }}</dd></div>
            <div><dt class="text-slate-500">Club</dt><dd class="truncate font-semibold text-slate-800">{{ team.clubName }}</dd></div>
          </dl>
          <p class="mt-2 text-xs text-slate-500">{{ period(team) }}</p>
          <RouterLink v-if="canOpenSquad(team)" :to="{ name: 'squad', params: { squadId: team.squadId } }" class="btn-secondary mt-3 w-full">
            <Icon icon="table-list" class="h-3.5 w-3.5" />Abrir la plantilla
          </RouterLink>
        </li>
      </ul>
    </section>

    <section v-if="previous.length" class="card">
      <h2 class="font-semibold text-slate-900">Antes</h2>
      <ul class="mt-3 divide-y divide-line">
        <li v-for="team in previous" :key="`${team.teamId}-${team.seasonLabel}`" class="flex items-center gap-3 py-2.5">
          <TeamCrest :src="crestFor(team.teamCrestUrl, team.teamId)" :name="team.teamName" :short-name="team.teamShortName" size="sm" />
          <div class="min-w-0 flex-1">
            <RouterLink :to="{ name: 'team', params: { teamId: team.teamId } }" class="block truncate text-sm font-medium text-slate-800 hover:text-accent-400">{{ team.teamName }}</RouterLink>
            <p class="truncate text-xs text-slate-500">{{ staffRoleLabels[team.role] }} · {{ team.competitionName }} · {{ team.seasonLabel }}</p>
          </div>
          <span class="shrink-0 text-xs text-slate-500">hasta {{ formatDate(team.validUntil) }}</span>
        </li>
      </ul>
    </section>

    <PlayerPhotoWizard v-if="data.isMe" kind="coach" :open="photoOpen" :has-photo="!!data.photoUrl" @close="photoOpen = false" @saved-coach="onPhotoSaved" />
  </template>
</template>
