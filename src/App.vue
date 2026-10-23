<script setup lang="ts">
import { onMounted } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';
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

/**
 * Clave de la página: las rutas con pestañas (la plantilla) se identifican por su layout, así cambiar de pestaña no
 * vuelve a montar la cabecera ni a pedir la plantilla; el resto, por su ruta.
 */
function pageKey(route: RouteLocationNormalizedLoaded) {
  const layout = route.matched[0];
  if (!layout?.children.length) return route.path;
  return layout.path.replace(/:(\w+)\??/g, (_, name: string) => String(route.params[name] ?? ''));
}
</script>

<template>
  <GrassField />
  <AppShell>
    <RouterView v-slot="{ Component, route }">
      <!-- Un único nodo raíz por página para que la transición pueda animarlo (las vistas tienen varias raíces). -->
      <Transition name="page" mode="out-in">
        <div :key="pageKey(route)" class="page-root">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
  </AppShell>
</template>
