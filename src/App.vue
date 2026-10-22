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
    <RouterView v-slot="{ Component, route }">
      <!-- Un único nodo raíz por página para que la transición pueda animarlo (las vistas tienen varias raíces). -->
      <Transition name="page" mode="out-in">
        <div :key="route.path" class="page-root">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
  </AppShell>
</template>
