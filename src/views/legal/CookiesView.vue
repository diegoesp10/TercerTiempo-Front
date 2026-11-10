<script setup lang="ts">
import { computed, onMounted } from 'vue';
import LegalPage from '@/components/legal/LegalPage.vue';
import { useConsentStore } from '@/stores/consent';
import type { CookieCategory, CookieStorage } from '@/types/api';
import { formatDate } from '@/utils/format';

/** Política de cookies: el catálogo sale de la base de datos, así que siempre coincide con lo que la web guarda. */
const consent = useConsentStore();
onMounted(() => { if (!consent.policy) void consent.load(); });

const categoryLabels: Record<CookieCategory, string> = { Necessary: 'Necesarias', Preferences: 'Preferencias', Analytics: 'Analítica propia' };
const storageLabels: Record<CookieStorage, string> = { Cookie: 'Cookie', LocalStorage: 'Almacenamiento local', SessionStorage: 'Almacenamiento de sesión' };
const categories: CookieCategory[] = ['Necessary', 'Preferences', 'Analytics'];
const cookiesOf = (category: CookieCategory) => (consent.policy?.cookies ?? []).filter((c) => c.category === category);

const state = computed(() => {
  if (!consent.saved || consent.needsBanner) return 'Todavía no has elegido (o la política ha cambiado desde tu última elección).';
  return consent.analyticsAllowed ? 'Has aceptado la analítica propia.' : 'Has rechazado la analítica propia: solo se usan las necesarias y tus preferencias.';
});
</script>

<template>
  <LegalPage
    title="Política de cookies"
    :subtitle="consent.policy ? `Versión ${consent.policy.version} · actualizada el ${formatDate(consent.policy.updatedAt)}` : 'Qué guarda Tercer Tiempo en tu navegador y para qué.'"
  >
    <section>
      <h2>Qué guardamos y por qué</h2>
      <p>
        Tercer Tiempo no utiliza cookies de publicidad ni de terceros. Lo que guarda está en el almacenamiento de tu navegador
        (tecnología equivalente a las cookies) y solo lo lee Tercer Tiempo. Las <strong>necesarias</strong> y las de
        <strong>preferencias</strong> que tú eliges están exentas de consentimiento; la <strong>analítica propia</strong> solo
        se usa si la aceptas: cuenta páginas vistas, búsquedas y botones pulsados con un identificador anónimo, sin tu IP,
        y los datos se borran a los 13 meses.
      </p>
      <p class="mt-2">
        {{ state }}
        <button type="button" class="font-semibold text-accent-400 hover:underline" @click="consent.settingsOpen = true">Cambiar mi elección</button>
      </p>
    </section>

    <section v-for="category in categories" :key="category">
      <h2>{{ categoryLabels[category] }}</h2>
      <div class="overflow-x-auto rounded-lg border border-line">
        <table class="min-w-full text-xs">
          <thead class="bg-surface-2 text-left uppercase tracking-wide text-slate-500">
            <tr><th class="px-3 py-2">Nombre</th><th class="px-3 py-2">Tipo</th><th class="px-3 py-2">Finalidad</th><th class="px-3 py-2">Duración</th><th class="px-3 py-2">Responsable</th></tr>
          </thead>
          <tbody class="divide-y divide-line">
            <tr v-for="cookie in cookiesOf(category)" :key="cookie.id">
              <td data-label="Nombre" class="px-3 py-2 font-mono text-slate-800">{{ cookie.name }}</td>
              <td data-label="Tipo" class="px-3 py-2">{{ storageLabels[cookie.storage] }}</td>
              <td data-label="Finalidad" class="px-3 py-2">{{ cookie.purpose }}</td>
              <td data-label="Duración" class="px-3 py-2 sm:whitespace-nowrap">{{ cookie.duration }}</td>
              <td data-label="Responsable" class="px-3 py-2 sm:whitespace-nowrap">{{ cookie.provider }}</td>
            </tr>
            <tr v-if="cookiesOf(category).length === 0"><td colspan="5" class="px-3 py-2 text-slate-400">Ninguna.</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>Cómo retirar o cambiar el consentimiento</h2>
      <p>
        Desde «Cambiar mi elección» en esta página o el enlace «Cookies» del pie, en cualquier momento. Si retiras la
        analítica, se borra su identificador de tu navegador y dejamos de medir. También puedes borrar el almacenamiento del
        sitio desde los ajustes de tu navegador. Más información en la <RouterLink to="/privacidad" class="text-accent-400 hover:underline">política de privacidad</RouterLink>.
      </p>
    </section>
  </LegalPage>
</template>
