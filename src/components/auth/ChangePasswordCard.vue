<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import PasswordChecklist from '@/components/auth/PasswordChecklist.vue';
import Alert from '@/components/ui/Alert.vue';
import { useAuthStore } from '@/stores/auth';
import type { PasswordStatusDto } from '@/types/api';
import { formatKickoff } from '@/utils/format';
import { PASSWORD_MAX_LENGTH, passwordLooksValid, tokenEmail } from '@/utils/password';

/**
 * Cambio de contraseña de cualquier cuenta (club, cuerpo técnico o jugador): con la actual, una nueva que cumpla los
 * requisitos y como mucho una vez cada 24 horas. Al cambiarla se cierran las demás sesiones; esta sigue abierta.
 */
const auth = useAuthStore();
const email = computed(() => tokenEmail(auth.token));

const status = shallowRef<PasswordStatusDto | null>(null);
const form = reactive({ currentPassword: '', newPassword: '', confirm: '' });
const show = ref(false);
const saving = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const done = ref(false);

async function loadStatus() {
  try {
    status.value = await api.auth.passwordStatus();
  } catch {
    status.value = null;
  }
}
onMounted(loadStatus);

const mismatch = computed(() => form.confirm.length > 0 && form.confirm !== form.newPassword);
const canSubmit = computed(() =>
  (status.value?.canChange ?? true)
  && form.currentPassword.length > 0
  && passwordLooksValid(form.newPassword, email.value)
  && form.newPassword !== form.currentPassword
  && form.confirm === form.newPassword,
);

async function submit() {
  if (!canSubmit.value) return;
  saving.value = true;
  error.value = null;
  fieldErrors.value = {};
  done.value = false;
  try {
    await auth.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
    Object.assign(form, { currentPassword: '', newPassword: '', confirm: '' });
    show.value = false;
    done.value = true;
    await loadStatus();
  } catch (e) {
    if (e instanceof ApiError && Object.keys(e.fieldErrors).length) fieldErrors.value = e.fieldErrors;
    else error.value = errorMessage(e);
    if (e instanceof ApiError && e.status === 409) await loadStatus();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900"><Icon icon="key" class="h-4 w-4 text-slate-500" />Contraseña</h2>
        <p class="mt-1 max-w-2xl text-sm text-slate-500">
          Puedes cambiarla una vez al día. Al cambiarla se cierran las sesiones abiertas en otros dispositivos.
        </p>
      </div>
      <p v-if="status?.changedAt" class="text-xs text-slate-500">Último cambio: {{ formatKickoff(status.changedAt) }}</p>
    </div>

    <Alert v-if="done" kind="success" class="mt-4">Contraseña cambiada. Las demás sesiones se han cerrado; en esta sigues dentro.</Alert>
    <Alert v-if="error" kind="error" class="mt-4">{{ error }}</Alert>
    <Alert v-if="status && !status.canChange && status.nextChangeAt" kind="info" class="mt-4">
      Ya la has cambiado en las últimas 24 horas. Podrás volver a cambiarla a partir del {{ formatKickoff(status.nextChangeAt) }}.
    </Alert>

    <form v-else class="mt-4 grid max-w-xl grid-cols-1 gap-4" novalidate @submit.prevent="submit">
      <div>
        <label class="label" for="current-password">Contraseña actual</label>
        <input
          id="current-password"
          v-model="form.currentPassword"
          :type="show ? 'text' : 'password'"
          autocomplete="current-password"
          :maxlength="PASSWORD_MAX_LENGTH"
          required
          class="input"
        />
        <p v-if="fieldErrors.currentPassword" class="field-error">{{ fieldErrors.currentPassword[0] }}</p>
      </div>

      <div>
        <div class="flex items-center justify-between gap-2">
          <label class="label" for="new-password">Contraseña nueva</label>
          <button type="button" class="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800" :aria-pressed="show" @click="show = !show">
            <Icon :icon="show ? 'eye-slash' : 'eye'" class="h-3.5 w-3.5" />{{ show ? 'Ocultar' : 'Mostrar' }}
          </button>
        </div>
        <input
          id="new-password"
          v-model="form.newPassword"
          :type="show ? 'text' : 'password'"
          autocomplete="new-password"
          :maxlength="PASSWORD_MAX_LENGTH"
          required
          class="input"
          aria-describedby="new-password-rules"
        />
        <PasswordChecklist id="new-password-rules" :password="form.newPassword" :email="email" />
        <p v-if="form.newPassword && form.newPassword === form.currentPassword" class="field-error">Tiene que ser distinta de la actual.</p>
        <p v-for="message in fieldErrors.newPassword ?? []" :key="message" class="field-error">{{ message }}</p>
      </div>

      <div>
        <label class="label" for="confirm-password">Repite la contraseña nueva</label>
        <input
          id="confirm-password"
          v-model="form.confirm"
          :type="show ? 'text' : 'password'"
          autocomplete="new-password"
          :maxlength="PASSWORD_MAX_LENGTH"
          required
          class="input"
        />
        <p v-if="mismatch" class="field-error">No coincide con la contraseña nueva.</p>
      </div>

      <div>
        <button type="submit" class="btn-primary" v-busy="saving" :disabled="saving || !canSubmit">Cambiar contraseña</button>
      </div>
    </form>
  </section>
</template>
