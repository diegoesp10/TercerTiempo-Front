<script setup lang="ts">
import { computed, provide, ref, shallowRef, toRef, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { squadKey } from '@/composables/useSquad';
import { useAuthStore } from '@/stores/auth';
import type { SquadDetailDto } from '@/types/api';
import { levelLabels, staffRoleLabels, visibilityLabels } from '@/utils/format';

const props = defineProps<{ squadId: string }>();

const auth = useAuthStore();
const route = useRoute();

const detail = shallowRef<SquadDetailDto | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const forbidden = ref(false);

async function reload() {
  loading.value = true;
  error.value = null;
  forbidden.value = false;
  try {
    detail.value = await api.squads.get(props.squadId);
  } catch (e) {
    error.value = errorMessage(e);
    forbidden.value = e instanceof ApiError && e.status === 403;
  } finally {
    loading.value = false;
  }
}

watch(() => props.squadId, () => void reload(), { immediate: true });

provide(squadKey, { squadId: toRef(props, 'squadId'), detail, reload });

const summary = computed(() => detail.value?.summary ?? null);
const isMyPlayerSquad = computed(() => auth.playerSquad?.squadId === props.squadId);

const tabs = [
  { name: 'squad', label: 'Plantilla' },
  { name: 'squad-matches', label: 'Partidos y actas' },
  { name: 'squad-stats', label: 'Estadísticas' },
  { name: 'squad-compare', label: 'Comparador' },
] as const;
</script>

<template>
  <Spinner v-if="loading && !detail" />

  <template v-else-if="error">
    <Alert v-if="forbidden" kind="warning">
      Esta plantilla es <strong>privada</strong>: solo su cuerpo técnico y sus jugadores vinculados pueden ver sus actas y estadísticas.
      <template v-if="auth.isCoach"> ¿Eres de su cuerpo técnico? Tu club te entrega un código de acceso: <RouterLink to="/codigo-acceso" class="font-medium underline">canjéalo</RouterLink>.</template>
      <template v-else-if="auth.isPlayer"> ¿Juegas en el equipo? <RouterLink to="/invitacion" class="font-medium underline">Vincúlate con el código de tu cuerpo técnico</RouterLink>.</template>
      <template v-else> <RouterLink to="/login" class="font-medium underline">Entra</RouterLink> si formas parte del equipo.</template>
    </Alert>
    <Alert v-else kind="error">{{ error }}</Alert>
  </template>

  <template v-else-if="summary && detail">
    <div class="mb-6 flex flex-wrap items-center gap-4">
      <TeamCrest :src="summary.teamCrestUrl" :name="summary.teamName" :short-name="summary.teamShortName" size="lg" />
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl font-semibold tracking-tight text-slate-900">
          <RouterLink :to="{ name: 'team', params: { teamId: summary.teamId } }" class="hover:text-accent-400">{{ summary.teamName }}</RouterLink>
        </h1>
        <p class="text-sm text-slate-500">{{ levelLabels[summary.competitionLevel] }} · {{ summary.competitionName }} · {{ summary.seasonLabel }}</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Badge :tone="summary.visibility === 'Public' ? 'green' : 'slate'">Plantilla {{ visibilityLabels[summary.visibility].toLowerCase() }}</Badge>
        <Badge v-if="summary.myRole" tone="blue">{{ staffRoleLabels[summary.myRole] }}</Badge>
        <Badge v-else-if="isMyPlayerSquad" tone="green">Tu plantilla</Badge>
        <span class="text-xs text-slate-500">{{ summary.playersCount }} jugadores · {{ summary.staffCount }} en el staff</span>
      </div>
    </div>

    <nav class="mb-6 flex gap-1 overflow-x-auto border-b border-slate-200 whitespace-nowrap" aria-label="Secciones de la plantilla">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.name"
        :to="{ name: tab.name, params: { squadId } }"
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition"
        :class="route.name === tab.name ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>

    <RouterView />
  </template>
</template>
