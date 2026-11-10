<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { errorMessage } from '@/api/http';
import Modal from '@/components/ui/Modal.vue';
import { useConsentStore } from '@/stores/consent';
import type { ConsentAction, CookieCategory } from '@/types/api';

/**
 * Aviso de cookies al entrar (mientras no se elija con la versión vigente de la política) y panel para ajustarlas en
 * cualquier momento. Aceptar y rechazar pesan lo mismo; las necesarias y las de preferencias no se pueden desactivar
 * porque están exentas, y la analítica propia arranca desactivada.
 */
const consent = useConsentStore();
const analytics = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);

watch(() => consent.settingsOpen, (open) => {
  if (open) analytics.value = consent.analyticsAllowed;
});

const categories: { value: CookieCategory; title: string; text: string; locked: boolean }[] = [
  { value: 'Necessary', title: 'Necesarias', text: 'Sesión iniciada y tu elección sobre las cookies. Sin ellas la web no funciona.', locked: true },
  { value: 'Preferences', title: 'Preferencias', text: 'Lo que tú eliges: tema claro u oscuro, temporada que consultas, tu club primero. Solo se guardan porque lo pides.', locked: true },
  { value: 'Analytics', title: 'Analítica propia', text: 'Páginas vistas, búsquedas y botones más usados, para mejorar la web. Se guardan en Tercer Tiempo y no se comparten con nadie.', locked: false },
];

const byCategory = computed(() => {
  const cookies = consent.policy?.cookies ?? [];
  return Object.fromEntries(categories.map((c) => [c.value, cookies.filter((k) => k.category === c.value)]));
});

async function choose(action: ConsentAction) {
  saving.value = true;
  error.value = null;
  try {
    await consent.choose(action, action === 'Custom' ? analytics.value : action === 'AcceptAll');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div
    v-if="consent.needsBanner && !consent.settingsOpen"
    class="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/98 px-4 py-4 shadow-card sm:px-6"
    role="dialog"
    aria-live="polite"
    aria-label="Cookies"
    data-no-track
  >
    <div class="mx-auto flex max-w-[1760px] flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <p class="text-sm leading-relaxed text-slate-700">
        Usamos lo necesario para que la web funcione y recordar tus preferencias. Con tu permiso, también medimos qué páginas,
        búsquedas y botones se usan más, con datos que se quedan en Tercer Tiempo.
        <RouterLink to="/cookies" class="font-semibold text-accent-400 hover:underline">Política de cookies</RouterLink>.
      </p>
      <div class="flex shrink-0 flex-wrap gap-2">
        <button type="button" class="btn-secondary" :disabled="saving" @click="choose('RejectAll')">Rechazar</button>
        <button type="button" class="btn-ghost" :disabled="saving" @click="consent.settingsOpen = true">Configurar</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="choose('AcceptAll')">Aceptar</button>
      </div>
    </div>
    <p v-if="error" class="mx-auto mt-2 max-w-[1760px] text-sm text-red-600">{{ error }}</p>
  </div>

  <Modal :open="consent.settingsOpen" title="Configurar cookies" size="lg" @close="consent.settingsOpen = false">
    <div class="space-y-4" data-no-track>
      <p class="text-sm text-slate-600">
        Tercer Tiempo no usa cookies de publicidad ni de terceros: todo lo que guarda está en tu navegador y es nuestro.
        Puedes cambiar esto cuando quieras desde el enlace «Cookies» del pie de página.
      </p>
      <section v-for="category in categories" :key="category.value" class="rounded-xl border border-line p-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <h3 class="font-semibold text-slate-900">{{ category.title }}</h3>
            <p class="mt-1 text-sm text-slate-600">{{ category.text }}</p>
          </div>
          <span v-if="category.locked" class="shrink-0 text-xs font-semibold text-emerald-600">Siempre activas</span>
          <label v-else class="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
            <input v-model="analytics" type="checkbox" class="h-4 w-4 accent-brand-500" />
            {{ analytics ? 'Activada' : 'Desactivada' }}
          </label>
        </div>
        <ul v-if="byCategory[category.value]?.length" class="mt-3 space-y-1 text-xs text-slate-500">
          <li v-for="cookie in byCategory[category.value]" :key="cookie.id">
            <code class="text-slate-700">{{ cookie.name }}</code> · {{ cookie.purpose }} · {{ cookie.duration }}
          </li>
        </ul>
      </section>
      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-secondary" :disabled="saving" @click="choose('RejectAll')">Rechazar todo</button>
        <button type="button" class="btn-secondary" :disabled="saving" @click="choose('Custom')">Guardar mi elección</button>
        <button type="button" class="btn-primary" :disabled="saving" @click="choose('AcceptAll')">Aceptar todo</button>
      </div>
    </div>
  </Modal>
</template>
