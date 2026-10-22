<script setup lang="ts">
import { onMounted } from 'vue';
import GrassField from '@/components/backgrounds/GrassField.vue';
import AppShell from '@/components/layout/AppShell.vue';
import { useAuthStore } from '@/stores/auth';
import { useSyncStore } from '@/stores/sync';

const auth = useAuthStore();
const sync = useSyncStore();

// Al arrancar con sesión guardada, refrescamos la cuenta (plantillas, vínculos, visibilidad) sin bloquear la UI,
// y empezamos a sondear la sincronización de la API para avisar mientras actualiza datos.
onMounted(() => {
  if (auth.isAuthenticated) void auth.refreshAccount().catch(() => undefined);
  sync.start();
});
</script>

<template>
  <GrassField />
  <AppShell>
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </AppShell>
</template>
