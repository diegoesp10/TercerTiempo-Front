<script setup lang="ts">
import { ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import Alert from '@/components/ui/Alert.vue';
import { useAuthStore } from '@/stores/auth';

// Escudo de cada equipo del club con su botón de cambio (PNG, JPG, WebP, SVG o GIF hasta 2 MB).
const auth = useAuthStore();

const input = ref<HTMLInputElement | null>(null);
const targetTeamId = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

function pick(teamId: string) {
  targetTeamId.value = teamId;
  input.value?.click();
}

async function upload(event: Event) {
  const element = event.target as HTMLInputElement;
  const file = element.files?.[0];
  const teamId = targetTeamId.value;
  element.value = '';
  if (!file || !teamId) return;

  busy.value = true;
  error.value = null;
  notice.value = null;
  try {
    const result = await api.clubs.uploadTeamCrest(teamId, file);
    await auth.refreshAccount();
    notice.value = `Escudo de ${result.teamName} actualizado.`;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card">
    <input ref="input" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" class="hidden" aria-hidden="true" @change="upload" />
    <h2 class="text-lg font-bold text-slate-900">Escudo del club</h2>
    <p class="mt-1 text-sm text-slate-500">Es la insignia que se ve en la cabecera, en tu panel y junto a tus equipos. Imagen de hasta 2 MB.</p>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>
    <Alert v-else-if="notice" kind="success" class="mt-3">{{ notice }}</Alert>

    <p v-if="!auth.club || auth.club.teams.length === 0" class="mt-3 text-sm text-slate-500">Vincula un equipo a tu club para poder ponerle escudo.</p>
    <ul v-else class="mt-4 divide-y divide-slate-100">
      <li v-for="team in auth.club.teams" :key="team.teamId" class="flex flex-wrap items-center gap-4 py-3">
        <TeamCrest :src="team.teamCrestUrl" :name="team.teamName" :short-name="team.teamShortName" size="lg" />
        <div class="min-w-0 flex-1">
          <p class="font-medium text-slate-900">{{ team.teamName }}</p>
          <p class="text-xs text-slate-500">{{ team.teamCrestUrl ? 'Escudo guardado en Tercer Tiempo' : 'Sin escudo: se muestran las iniciales' }}</p>
        </div>
        <button type="button" class="btn-secondary px-3 py-1.5 text-sm" v-busy="busy" :disabled="busy" @click="pick(team.teamId)">
          <Icon icon="arrow-up-from-bracket" class="mr-1.5 h-3.5 w-3.5" />{{ team.teamCrestUrl ? 'Cambiar escudo' : 'Subir escudo' }}
        </button>
      </li>
    </ul>
  </section>
</template>
