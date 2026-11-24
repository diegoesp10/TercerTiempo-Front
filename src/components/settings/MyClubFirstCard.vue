<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore } from '@/stores/settings';

// «Poner mi club siempre el primero» (se guarda en el dispositivo). Lo usan «Ajustes» y «Mi perfil» del jugador.
const auth = useAuthStore();
const settings = useSettingsStore();
</script>

<template>
  <section class="card">
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900"><Icon icon="shield-halved" class="h-4 w-4 text-slate-500" />Tu club</h2>
        <p class="mt-1 text-sm text-slate-500">
          Poner mi club siempre el primero: los buscadores de competición, la jornada y las clasificaciones se abren en la
          liga de tu club y la muestran arriba. Tu equipo siempre aparece destacado.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        :aria-checked="settings.myClubFirst"
        aria-label="Poner mi club siempre el primero"
        class="relative mt-1 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition"
        :class="settings.myClubFirst ? 'bg-action' : 'bg-slate-300'"
        @click="settings.setMyClubFirst(!settings.myClubFirst)"
      >
        <span class="inline-block h-5 w-5 rounded-full bg-white shadow transition" :class="settings.myClubFirst ? 'translate-x-5' : 'translate-x-0.5'" />
      </button>
    </div>
    <p v-if="auth.myTeamIds.length === 0" class="mt-3 text-xs text-slate-500">
      Todavía no perteneces a ningún equipo: cuando te unas a una plantilla o tu club vincule sus equipos, se aplicará solo.
    </p>
  </section>
</template>
