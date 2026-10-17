<script setup lang="ts">
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { staffRoleLabels, visibilityLabels } from '@/utils/format';

const auth = useAuthStore();

const { data, loading, error } = useAsync(async () => {
  const squads = await api.squads.mine();
  auth.setCoachSquads(squads);
  return squads;
});
</script>

<template>
  <PageHeader :title="`Hola, ${auth.displayName}`" subtitle="Plantillas en las que formas parte del cuerpo técnico.">
    <template #actions>
      <RouterLink to="/invitacion" class="btn-secondary">Unirme con un código</RouterLink>
      <RouterLink to="/equipos" class="btn-primary">Crear plantilla</RouterLink>
    </template>
  </PageHeader>

  <Spinner v-if="loading" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <div v-if="data.length === 0" class="card">
      <h2 class="font-semibold text-slate-900">Todavía no gestionas ninguna plantilla</h2>
      <ul class="mt-3 space-y-2 text-sm text-slate-600">
        <li>
          <strong>¿Eres el primero de tu cuerpo técnico en entrar?</strong>
          Busca tu equipo en <RouterLink to="/equipos" class="font-medium text-emerald-700 hover:underline">Equipos</RouterLink>
          y pulsa «Crear plantilla»: se importan las fichas publicadas por futbolasturiano.es y obtienes un código de invitación.
        </li>
        <li>
          <strong>¿Tu plantilla ya existe?</strong>
          Pide el código a quien la creó y
          <RouterLink to="/invitacion" class="font-medium text-emerald-700 hover:underline">únete al cuerpo técnico</RouterLink>.
        </li>
      </ul>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2">
      <article v-for="squad in data" :key="squad.id" class="card flex flex-col gap-4">
        <div class="flex items-start gap-4">
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600">
            <img v-if="squad.teamCrestUrl" :src="squad.teamCrestUrl" :alt="squad.teamName" class="h-12 w-12 object-contain" loading="lazy" />
            <span v-else>{{ squad.teamShortName }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <h2 class="truncate text-lg font-semibold text-slate-900">{{ squad.teamName }}</h2>
            <p class="text-sm text-slate-500">{{ squad.competitionName }} · {{ squad.seasonLabel }}</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <Badge :tone="squad.visibility === 'Public' ? 'green' : 'slate'">{{ visibilityLabels[squad.visibility] }}</Badge>
              <Badge v-if="squad.myRole" tone="blue">{{ staffRoleLabels[squad.myRole] }}</Badge>
              <span class="text-xs text-slate-500">{{ squad.playersCount }} jugadores · {{ squad.staffCount }} en el staff</span>
            </div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          <RouterLink :to="{ name: 'squad', params: { squadId: squad.id } }" class="btn-secondary">Plantilla</RouterLink>
          <RouterLink :to="{ name: 'squad-matches', params: { squadId: squad.id } }" class="btn-primary">Partidos y actas</RouterLink>
          <RouterLink :to="{ name: 'squad-stats', params: { squadId: squad.id } }" class="btn-ghost">Estadísticas</RouterLink>
        </div>
      </article>
    </div>
  </template>
</template>
