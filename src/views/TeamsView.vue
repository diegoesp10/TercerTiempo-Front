<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import CompetitionPicker from '@/components/competitions/CompetitionPicker.vue';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const competitions = useAsync(() => api.competitions.list());

const selectedId = ref<string | null>(typeof route.query.competition === 'string' ? route.query.competition : null);

// Selección inicial: la de la URL, si no la del equipo del jugador, si no la primera liga nacional.
watch(competitions.data, (list) => {
  if (!list || list.length === 0) return;
  if (selectedId.value && list.some((c) => c.id === selectedId.value)) return;
  selectedId.value = auth.membership?.competitionId ?? list.find((c) => c.level === 'National')?.id ?? list[0]?.id ?? null;
});

const teams = useAsync(() => (selectedId.value ? api.teams.list(selectedId.value) : Promise.resolve([])), { immediate: false });

watch(selectedId, (id) => {
  if (!id) return;
  if (route.query.competition !== id) void router.replace({ query: { ...route.query, competition: id } });
  void teams.run();
}, { immediate: true });

const selected = computed(() => competitions.data.value?.find((c) => c.id === selectedId.value) ?? null);
</script>

<template>
  <PageHeader title="Equipos" subtitle="Elige nivel, liga y grupo, entra en tu equipo y reclama tu ficha en la plantilla." />

  <Alert v-if="auth.isAuthenticated && !auth.hasTeam" kind="info" class="mb-4">
    Todavía no perteneces a ningún equipo. Entra en el tuyo y pulsa <strong>«Soy yo»</strong> sobre tu ficha de la plantilla
    (o <strong>«Unirme a este equipo»</strong> si su plantilla no está publicada).
  </Alert>

  <Spinner v-if="competitions.loading.value" />
  <Alert v-else-if="competitions.error.value" kind="error">{{ competitions.error.value }}</Alert>
  <Alert v-else-if="!competitions.data.value || competitions.data.value.length === 0" kind="warning">
    Todavía no hay ligas sincronizadas. Si acabas de arrancar la API, espera a que termine la primera sincronización.
  </Alert>

  <template v-else>
    <CompetitionPicker v-model="selectedId" :competitions="competitions.data.value" class="mb-6" />

    <h2 v-if="selected" class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
      {{ selected.name }} · {{ selected.currentSeasonLabel ?? 'sin temporada' }}
    </h2>

    <Spinner v-if="teams.loading.value" />
    <Alert v-else-if="teams.error.value" kind="error">{{ teams.error.value }}</Alert>

    <div v-else-if="teams.data.value" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <RouterLink
        v-for="team in teams.data.value"
        :key="team.id"
        :to="{ name: 'team', params: { teamId: team.id } }"
        class="card flex items-center gap-4 transition hover:border-emerald-300 hover:shadow"
        :class="team.id === auth.membership?.teamId ? 'border-emerald-300 bg-emerald-50' : ''"
      >
        <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
          <img v-if="team.crestUrl" :src="team.crestUrl" :alt="team.name" class="h-10 w-10 object-contain" loading="lazy" />
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
</template>
