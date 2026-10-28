<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import CompetitionPicker from '@/components/competitions/CompetitionPicker.vue';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import MyClubBadge from '@/components/teams/MyClubBadge.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { useAsync } from '@/composables/useAsync';
import { useMyClub } from '@/composables/useMyClub';
import { useAuthStore } from '@/stores/auth';
import { useSeasonStore } from '@/stores/season';

const season = useSeasonStore();

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const competitions = useAsync(() => api.competitions.list());

const selectedId = ref<string | null>(typeof route.query.competition === 'string' ? route.query.competition : null);

const { preferredCompetition, isMine } = useMyClub();

/** Liga preferida: la de tu club (jugador, técnico o club) o, si no, la primera nacional. */
watch(competitions.data, (list) => {
  if (!list || list.length === 0) return;
  if (selectedId.value && list.some((c) => c.id === selectedId.value)) return;
  selectedId.value = preferredCompetition(list) ?? list.find((c) => c.level === 'National')?.id ?? list[0]?.id ?? null;
});

const teams = useAsync(() => (selectedId.value ? api.teams.list(selectedId.value) : Promise.resolve([])), { immediate: false });
/** Tu club, el primero. */
const orderedTeams = computed(() => [...(teams.data.value ?? [])].sort((a, b) => Number(isMine(b.id)) - Number(isMine(a.id))));

watch(selectedId, (id) => {
  if (!id) return;
  if (route.query.competition !== id) void router.replace({ query: { ...route.query, competition: id } });
  void teams.run();
}, { immediate: true });

const selected = computed(() => competitions.data.value?.find((c) => c.id === selectedId.value) ?? null);

const subtitle = 'Elige nivel, liga y grupo para ver equipos, calendarios y plantillas.';
</script>

<template>
  <PageHeader title="Equipos" :subtitle="subtitle" />

  <Alert v-if="auth.isCoach && auth.coachSquads.length === 0" kind="info" class="mb-4">
    Todavía no estás en ninguna plantilla. Pide a tu club tu código de acceso y
    <RouterLink to="/codigo-acceso" class="font-medium underline">canjéalo aquí</RouterLink>: entrarás directamente en la plantilla de tu equipo.
  </Alert>

  <Skeleton v-if="competitions.loading.value && !competitions.data.value" variant="cards" label="Cargando las competiciones…" />
  <Alert v-else-if="competitions.error.value" kind="error">{{ competitions.error.value }}</Alert>
  <Alert v-else-if="!competitions.data.value || competitions.data.value.length === 0" kind="warning">
    <template v-if="!season.isCurrent">No hay ligas guardadas de la temporada {{ season.selected?.label }}.</template>
    <template v-else>Todavía no hay ligas sincronizadas. Si acabas de arrancar la API, espera a que termine la primera sincronización.</template>
  </Alert>

  <template v-else>
    <CompetitionPicker v-model="selectedId" :competitions="competitions.data.value" class="mb-6" />

    <h2 v-if="selected" class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {{ selected.name }} · {{ selected.seasonLabel ?? 'sin temporada' }}
    </h2>

    <Skeleton v-if="teams.loading.value && !teams.data.value" variant="cards" :count="9" label="Cargando los equipos…" />
    <Alert v-else-if="teams.error.value" kind="error">{{ teams.error.value }}</Alert>

    <div v-else-if="teams.data.value" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" :class="{ 'is-refreshing': teams.loading.value }" :aria-busy="teams.loading.value">
      <RouterLink
        v-for="team in orderedTeams"
        :key="team.id"
        :to="{ name: 'team', params: { teamId: team.id } }"
        :data-track="team.name"
        class="card flex items-center gap-4 transition hover:border-brand-400/60 hover:shadow"
        :class="isMine(team.id) ? 'border-accent-400/60 bg-brand-500/15 ring-1 ring-accent-400/40' : ''"
      >
        <TeamCrest :src="team.crestUrl" :name="team.name" :short-name="team.shortName" size="lg" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-slate-900">{{ team.name }}</p>
          <p class="text-xs text-slate-500">
            <template v-if="team.position">{{ team.position }}º · {{ team.points }} pts · {{ team.played }} PJ</template>
            <template v-else>Sin clasificación</template>
          </p>
          <MyClubBadge v-if="isMine(team.id)" class="mt-1.5" />
        </div>
      </RouterLink>
    </div>
  </template>
</template>
