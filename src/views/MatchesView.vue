<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api';
import MatchRow from '@/components/matches/MatchRow.vue';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const teamId = computed(() => auth.membership?.teamId ?? null);

const { data, loading, error } = useAsync(
  () => (teamId.value ? api.teams.matches(teamId.value) : Promise.resolve([])),
);

const played = computed(() => (data.value ?? []).filter((m) => m.status === 'Played').reverse());
const upcoming = computed(() => (data.value ?? []).filter((m) => m.status !== 'Played'));
const pending = computed(() => played.value.filter((m) => !m.myPerformanceId).length);
</script>

<template>
  <PageHeader
    title="Partidos"
    :subtitle="auth.membership ? `${auth.membership.teamName} · ${auth.membership.competitionName} · ${auth.membership.seasonLabel}` : undefined"
  />

  <Alert v-if="!teamId" kind="info">
    Para ver el calendario necesitas pertenecer a un equipo.
    <RouterLink to="/equipos" class="font-medium underline">Elige tu equipo</RouterLink>.
  </Alert>

  <template v-else>
    <Spinner v-if="loading" />
    <Alert v-else-if="error" kind="error">{{ error }}</Alert>

    <template v-else-if="data">
      <Alert v-if="auth.canLogPerformance && pending > 0" kind="warning" class="mb-4">
        Tienes <strong>{{ pending }}</strong> {{ pending === 1 ? 'partido disputado sin registrar' : 'partidos disputados sin registrar' }}.
      </Alert>

      <section class="mb-8">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Disputados</h2>
        <p v-if="played.length === 0" class="text-sm text-slate-500">Aún no se ha disputado ningún partido.</p>
        <div v-else class="space-y-2">
          <MatchRow v-for="match in played" :key="match.id" :match="match" :team-id="teamId" />
        </div>
      </section>

      <section>
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Próximos</h2>
        <p v-if="upcoming.length === 0" class="text-sm text-slate-500">No quedan partidos programados.</p>
        <div v-else class="space-y-2">
          <MatchRow v-for="match in upcoming" :key="match.id" :match="match" :team-id="teamId" />
        </div>
      </section>
    </template>
  </template>
</template>
