<script setup lang="ts">
import type { RouteLocationNormalizedLoaded } from 'vue-router';
import GrassField from '@/components/backgrounds/GrassField.vue';
import AppShell from '@/components/layout/AppShell.vue';
import { useSeasonStore } from '@/stores/season';
import CookieBanner from '@/components/privacy/CookieBanner.vue';
import { usePresenceHeartbeat } from '@/composables/usePresenceHeartbeat';

// Las temporadas, las cookies y la cuenta se piden en main.ts, antes de montar. Las actualizaciones de datos de la API no
// se anuncian aquí: se siguen en la página oculta /jobs.
const season = useSeasonStore();
usePresenceHeartbeat();

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
      <!-- Un único nodo raíz por página para que la transición pueda animarlo (las vistas tienen varias raíces). Solo se
           anima la entrada: con out-in la página nueva no se monta (ni pide sus datos) hasta que sale la anterior, y
           sin animación de salida eso es un fotograma. -->
      <Transition name="page" mode="out-in">
        <!-- Cambiar de temporada vuelve a montar la página: todo se carga de nuevo con los datos de esa temporada. -->
        <div :key="`${season.selectedId ?? 'actual'}|${pageKey(route)}`" class="page-root">
          <component :is="Component" />
        </div>
      </Transition>
    </RouterView>
  </AppShell>
  <CookieBanner />
</template>
