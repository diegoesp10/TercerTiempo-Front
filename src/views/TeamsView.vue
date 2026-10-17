<script setup lang="ts">
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const { data, loading, error } = useAsync(() => api.teams.list());
</script>

<template>
  <PageHeader title="Equipos" subtitle="Elige tu equipo y reclama tu ficha en la plantilla para empezar a registrar partidos." />

  <Alert v-if="auth.isAuthenticated && !auth.hasTeam" kind="info" class="mb-4">
    Todavía no perteneces a ningún equipo. Entra en el tuyo y pulsa <strong>«Soy yo»</strong> sobre tu ficha de la plantilla.
  </Alert>

  <Spinner v-if="loading" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <div v-else-if="data" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
    <RouterLink
      v-for="team in data"
      :key="team.id"
      :to="{ name: 'team', params: { teamId: team.id } }"
      class="card flex items-center gap-4 transition hover:border-emerald-300 hover:shadow"
      :class="team.id === auth.membership?.teamId ? 'border-emerald-300 bg-emerald-50' : ''"
    >
      <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
        <img v-if="team.crestUrl" :src="team.crestUrl" :alt="team.name" class="h-10 w-10 object-contain" />
        <span v-else>{{ team.shortName }}</span>
      </div>
      <div class="min-w-0 flex-1">
        <p class="truncate font-medium text-slate-900">{{ team.name }}</p>
        <p class="text-xs text-slate-500">
          <template v-if="team.position">{{ team.position }}º · {{ team.points }} pts · {{ team.played }} PJ</template>
          <template v-else>Sin clasificación</template>
        </p>
      </div>
      <span v-if="team.id === auth.membership?.teamId" class="text-xs font-medium text-emerald-700">Tu equipo</span>
    </RouterLink>
  </div>
</template>
