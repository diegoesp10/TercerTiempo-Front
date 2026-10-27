<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { adminApi } from '@/api/admin';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import type { AdminAuthResponse, AdminMfaChallenge } from '@/types/api';

/**
 * Segundo paso del login del administrador (solo en publicación): el código de 6 cifras de Microsoft Authenticator.
 * La primera vez enseña el QR para dar de alta la cuenta en la app; el primer código bueno la deja dada de alta.
 */
const props = defineProps<{ challenge: AdminMfaChallenge; userName: string }>();
const emit = defineEmits<{ verified: [response: AdminAuthResponse]; restart: [message: string | null] }>();

const EXPIRED = 'La verificación ha caducado: vuelve a entrar con tu usuario y tu contraseña.';

const code = ref('');
const busy = ref(false);
const error = ref<string | null>(null);
const qr = ref<string | null>(null);
const input = ref<HTMLInputElement | null>(null);
const setup = computed(() => props.challenge.setup);
let expiry: ReturnType<typeof setTimeout> | null = null;

// La librería del QR solo se descarga cuando hay que dar de alta la app. Negro sobre blanco en los dos temas: la
// cámara no lee bien un QR invertido.
watch(setup, async (value) => {
  qr.value = null;
  if (!value) return;
  const { toDataURL } = await import('qrcode');
  qr.value = await toDataURL(value.authenticatorUri, { width: 416, margin: 2, errorCorrectionLevel: 'M', color: { dark: '#0b1220', light: '#ffffff' } });
}, { immediate: true });

// El billete dura 5 minutos: pasado ese tiempo hay que volver a poner la contraseña.
watch(() => props.challenge.expiresAt, (expiresAt) => {
  if (expiry) clearTimeout(expiry);
  expiry = setTimeout(() => emit('restart', EXPIRED), Math.max(0, new Date(expiresAt).getTime() - Date.now()));
}, { immediate: true });

onMounted(() => input.value?.focus());
onBeforeUnmount(() => {
  if (expiry) clearTimeout(expiry);
});

const digits = computed(() => code.value.replace(/\D/g, ''));
// Con las 6 cifras escritas (o pegadas) se comprueba solo.
watch(digits, (value) => {
  if (value.length === 6 && !busy.value) void verify();
});

async function verify() {
  if (digits.value.length !== 6) {
    error.value = 'Escribe las 6 cifras del código.';
    return;
  }
  busy.value = true;
  error.value = null;
  try {
    emit('verified', await adminApi.verifyMfa(props.challenge.ticket, digits.value));
  } catch (e) {
    if (e instanceof ApiError && e.problem.code === 'admin.mfa_expired') {
      emit('restart', errorMessage(e));
      return;
    }
    error.value = e instanceof ApiError ? (e.fieldErrors.code?.[0] ?? errorMessage(e)) : errorMessage(e);
    code.value = '';
    input.value?.focus();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div>
    <h1 class="flex items-center gap-2 text-2xl font-bold text-slate-900"><Icon icon="lock" class="h-5 w-5 text-accent-400" /> Verificación en dos pasos</h1>

    <template v-if="setup">
      <p class="mt-1 text-sm text-slate-500">
        Primera vez en este servidor: da de alta <strong class="text-slate-700">{{ userName }}</strong> en Microsoft Authenticator. A partir de ahora
        entrar pedirá también su código.
      </p>
      <ol class="mt-5 space-y-2 text-sm text-slate-600">
        <li class="flex gap-3">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-display text-xs font-bold text-brand-500">1</span>
          <span>En Microsoft Authenticator pulsa <strong class="text-slate-800">+</strong> y elige <strong class="text-slate-800">Otra cuenta (Google, Facebook, etc.)</strong>.</span>
        </li>
        <li class="flex gap-3">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-display text-xs font-bold text-brand-500">2</span>
          <span>Escanea este código QR.</span>
        </li>
        <li class="flex gap-3">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/10 font-display text-xs font-bold text-brand-500">3</span>
          <span>Escribe abajo el código de 6 cifras que sale para «Tercer Tiempo».</span>
        </li>
      </ol>
      <div class="mt-4 flex justify-center">
        <img v-if="qr" :src="qr" width="208" height="208" class="rounded-xl ring-1 ring-line" alt="Código QR para dar de alta Tercer Tiempo en la app de autenticación" />
        <div v-else class="h-52 w-52 animate-pulse rounded-xl bg-surface-2" aria-label="Generando el código QR" />
      </div>
      <details class="mt-3 text-xs text-slate-500">
        <summary class="cursor-pointer select-none font-semibold text-brand-500">¿No puedes escanearlo? Escribe la clave a mano</summary>
        <p class="mt-2">Cuenta: <strong class="text-slate-700">{{ userName }}</strong> · tipo: basada en tiempo</p>
        <code class="mt-1 block select-all break-all rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm tracking-wider text-slate-900">{{ setup.sharedKey }}</code>
      </details>
    </template>
    <p v-else class="mt-1 text-sm text-slate-500">
      Abre Microsoft Authenticator y escribe el código de 6 cifras de «Tercer Tiempo» (<strong class="text-slate-700">{{ userName }}</strong>).
    </p>

    <form class="mt-5 space-y-4" @submit.prevent="verify">
      <Alert v-if="error" kind="error">{{ error }}</Alert>
      <div>
        <label class="label" for="admin-mfa-code">Código de verificación</label>
        <input
          id="admin-mfa-code"
          ref="input"
          v-model="code"
          type="text"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="7"
          placeholder="000000"
          required
          class="input text-center font-figures text-2xl tracking-[0.4em]"
        />
      </div>
      <button type="submit" class="btn-primary w-full py-2.5" v-busy="busy" :disabled="busy">
        {{ busy ? 'Comprobando…' : setup ? 'Activar y entrar' : 'Entrar' }}
      </button>
      <button type="button" class="btn-ghost w-full" :disabled="busy" @click="emit('restart', null)">Volver</button>
    </form>
  </div>
</template>
