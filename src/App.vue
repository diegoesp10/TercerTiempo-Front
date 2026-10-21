<script setup lang="ts">
import { onMounted } from 'vue';
import PitchBackground from '@/components/backgrounds/PitchBackground.vue';
import AppShell from '@/components/layout/AppShell.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

// Al arrancar con sesión guardada, refrescamos la cuenta (plantillas, vínculos, visibilidad) sin bloquear la UI.
onMounted(() => {
  if (auth.isAuthenticated) void auth.refreshAccount().catch(() => undefined);
});
</script>

<template>
  <PitchBackground />
  <AppShell>
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </AppShell>
</template>
