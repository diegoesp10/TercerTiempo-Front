<script setup lang="ts">
import { ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import { useAuthStore } from '@/stores/auth';

/**
 * El jugador decide si su perfil completo (actas de Tercer Tiempo, asistencias de gol, nota) se ve desde fuera de su
 * club. La ficha básica con las actas oficiales la ve siempre cualquier cuenta con sesión.
 */
const emit = defineEmits<{ changed: [isPublic: boolean] }>();
const auth = useAuthStore();
const busy = ref(false);
const error = ref<string | null>(null);

async function toggle() {
  if (!auth.player) return;
  busy.value = true;
  error.value = null;
  try {
    const player = await api.players.setPublicProfile(!auth.player.publicProfile);
    auth.setPlayer(player);
    emit('changed', player.publicProfile);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div v-if="auth.player" class="flex items-start gap-3">
    <button
      type="button"
      role="switch"
      :aria-checked="auth.player.publicProfile"
      class="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition disabled:opacity-60"
      :class="auth.player.publicProfile ? 'bg-brand-500' : 'bg-surface-3'"
      :disabled="busy"
      aria-label="Perfil completo público"
      @click="toggle"
    >
      <span class="inline-block h-5 w-5 rounded-full bg-white shadow transition" :class="auth.player.publicProfile ? 'translate-x-5' : 'translate-x-0.5'" />
    </button>
    <div class="min-w-0 text-sm">
      <p class="font-semibold text-slate-900">{{ auth.player.publicProfile ? 'Perfil completo público' : 'Perfil completo solo para tu club' }}</p>
      <p class="text-xs text-slate-500">
        <template v-if="auth.player.publicProfile">Cualquier cuenta con sesión ve tus actas de Tercer Tiempo, asistencias de gol y nota (nunca las observaciones del técnico).</template>
        <template v-else>Fuera de tu club solo se ve tu ficha básica con las actas oficiales. Actívalo para enseñar también tus actas de Tercer Tiempo.</template>
      </p>
      <p v-if="error" class="mt-1 text-xs text-red-500">{{ error }}</p>
    </div>
  </div>
</template>
