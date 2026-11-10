<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { CookieCategory, CookieDto, CookiePolicyDto, CookieStorage, UpsertCookieRequest } from '@/types/api';
import { formatKickoff } from '@/utils/format';

/**
 * Catálogo de cookies de la base de datos (lo que explica la política y el panel de ajustes) y versión de la política:
 * publicar una nueva vuelve a pedir el consentimiento a todos.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const policy = ref<CookiePolicyDto | null>(null);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const busy = ref(false);
const editing = ref<CookieDto | null>(null);
const formOpen = ref(false);
const form = reactive<UpsertCookieRequest>({ name: '', category: 'Necessary', storage: 'LocalStorage', provider: 'Tercer Tiempo', purpose: '', duration: '', sortOrder: 10 });
const newVersion = ref('');

const categoryLabels: Record<CookieCategory, string> = { Necessary: 'Necesaria', Preferences: 'Preferencias', Analytics: 'Analítica' };
const categoryTone: Record<CookieCategory, 'green' | 'blue' | 'amber'> = { Necessary: 'green', Preferences: 'blue', Analytics: 'amber' };
const storageLabels: Record<CookieStorage, string> = { Cookie: 'Cookie', LocalStorage: 'Local', SessionStorage: 'Sesión' };

async function guard<T>(action: () => Promise<T>): Promise<T | undefined> {
  busy.value = true;
  try {
    error.value = null;
    return await action();
  } catch (e) {
    if ((e as { status?: number }).status === 401) emit('unauthorized');
    else error.value = errorMessage(e);
    return undefined;
  } finally {
    busy.value = false;
  }
}

async function load() {
  const result = await guard(() => api.privacy.cookies());
  if (result) {
    policy.value = result;
    newVersion.value = new Date().toISOString().slice(0, 10);
  }
}

function openForm(cookie: CookieDto | null) {
  editing.value = cookie;
  Object.assign(form, cookie
    ? { name: cookie.name, category: cookie.category, storage: cookie.storage, provider: cookie.provider, purpose: cookie.purpose, duration: cookie.duration, sortOrder: cookie.sortOrder }
    : { name: '', category: 'Necessary', storage: 'LocalStorage', provider: 'Tercer Tiempo', purpose: '', duration: '', sortOrder: 10 });
  formOpen.value = true;
}

async function save() {
  const body = { ...form };
  const result = await guard(() => (editing.value ? adminApi.updateCookie(props.token, editing.value.id, body) : adminApi.createCookie(props.token, body)));
  if (result) {
    policy.value = result;
    formOpen.value = false;
    notice.value = body.category === 'Analytics' && !editing.value
      ? 'Cookie de analítica añadida: publica una versión nueva para volver a pedir el consentimiento.'
      : 'Catálogo guardado.';
  }
}

async function remove(cookie: CookieDto) {
  if (!(await confirmDialog({ title: `Quitar ${cookie.name}`, message: 'Deja de aparecer en la política de cookies y en el panel de ajustes.', confirmLabel: 'Quitar', danger: true }))) return;
  const result = await guard(() => adminApi.deleteCookie(props.token, cookie.id));
  if (result) policy.value = result;
}

async function publish() {
  if (!(await confirmDialog({
    title: `Publicar la versión ${newVersion.value}`,
    message: 'El aviso de cookies volverá a salir a todos y la analítica se parará hasta que cada visitante elija de nuevo.',
    confirmLabel: 'Publicar',
  }))) return;
  const result = await guard(() => adminApi.publishCookiePolicy(props.token, newVersion.value.trim()));
  if (result) {
    policy.value = result;
    notice.value = `Versión ${result.version} publicada.`;
  }
}

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <Alert v-if="notice" kind="success">{{ notice }}</Alert>

    <div v-if="policy" class="card">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 class="font-semibold text-slate-900">Política de cookies</h2>
          <p class="text-xs text-slate-500">Versión <strong>{{ policy.version }}</strong> · publicada {{ formatKickoff(policy.updatedAt) }}. Los consentimientos solo valen para la versión con la que se dieron.</p>
        </div>
        <form class="flex items-end gap-2" @submit.prevent="publish">
          <label class="w-40">
            <span class="label">Nueva versión</span>
            <input v-model="newVersion" type="text" maxlength="40" required class="input" />
          </label>
          <button type="submit" class="btn-secondary" :disabled="busy || !newVersion.trim() || newVersion.trim() === policy.version">Publicar</button>
        </form>
      </div>
    </div>

    <div v-if="policy" class="card">
      <div class="mb-3 flex items-center justify-between gap-2">
        <h2 class="font-semibold text-slate-900">Catálogo</h2>
        <button type="button" class="btn-primary" @click="openForm(null)"><Icon icon="plus" class="h-3.5 w-3.5" /> Añadir</button>
      </div>
      <div class="overflow-x-auto rounded-lg border border-slate-200">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr><th class="px-3 py-2 text-left">Nombre</th><th class="px-3 py-2 text-left">Categoría</th><th class="px-3 py-2 text-left">Dónde</th><th class="px-3 py-2 text-left">Finalidad</th><th class="px-3 py-2 text-left">Duración</th><th class="px-3 py-2" /></tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="cookie in policy.cookies" :key="cookie.id">
              <td class="px-3 py-2 font-mono text-xs text-slate-800">{{ cookie.name }}</td>
              <td class="px-3 py-2"><Badge :tone="categoryTone[cookie.category]">{{ categoryLabels[cookie.category] }}</Badge></td>
              <td class="px-3 py-2 text-xs text-slate-600">{{ storageLabels[cookie.storage] }}</td>
              <td class="max-w-md px-3 py-2 text-xs text-slate-600">{{ cookie.purpose }}</td>
              <td class="px-3 py-2 text-xs whitespace-nowrap text-slate-600">{{ cookie.duration }}</td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <button type="button" class="btn-ghost text-xs" @click="openForm(cookie)">Editar</button>
                <button type="button" class="btn-ghost text-xs text-red-600" @click="remove(cookie)">Quitar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <Modal :open="formOpen" :title="editing ? `Editar ${editing.name}` : 'Añadir al catálogo'" size="md" @close="formOpen = false">
      <form class="space-y-3" @submit.prevent="save">
        <label class="block">
          <span class="label">Nombre (clave en el navegador)</span>
          <input v-model="form.name" type="text" maxlength="100" required :disabled="!!editing" class="input font-mono" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label>
            <span class="label">Categoría</span>
            <select v-model="form.category" class="input">
              <option value="Necessary">Necesaria (exenta)</option>
              <option value="Preferences">Preferencias (exenta)</option>
              <option value="Analytics">Analítica (con consentimiento)</option>
            </select>
          </label>
          <label>
            <span class="label">Dónde se guarda</span>
            <select v-model="form.storage" class="input">
              <option value="LocalStorage">Almacenamiento local</option>
              <option value="SessionStorage">Almacenamiento de sesión</option>
              <option value="Cookie">Cookie</option>
            </select>
          </label>
        </div>
        <label class="block">
          <span class="label">Finalidad</span>
          <textarea v-model="form.purpose" maxlength="500" required rows="3" class="input" />
        </label>
        <div class="grid grid-cols-3 gap-3">
          <label class="col-span-2">
            <span class="label">Duración</span>
            <input v-model="form.duration" type="text" maxlength="100" required class="input" />
          </label>
          <label>
            <span class="label">Orden</span>
            <input v-model.number="form.sortOrder" type="number" min="0" max="1000" class="input" />
          </label>
        </div>
        <label class="block">
          <span class="label">Responsable</span>
          <input v-model="form.provider" type="text" maxlength="100" required class="input" />
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="formOpen = false">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="busy">Guardar</button>
        </div>
      </form>
    </Modal>
  </section>
</template>
