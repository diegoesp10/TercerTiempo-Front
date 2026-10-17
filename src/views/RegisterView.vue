<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import { useAuthStore } from '@/stores/auth';
import type { AccountType, Position } from '@/types/api';
import { positionOptions } from '@/utils/format';

const auth = useAuthStore();
const router = useRouter();

const form = reactive<{
  accountType: AccountType;
  email: string;
  password: string;
  displayName: string;
  position: Position;
  birthDate: string;
}>({
  accountType: 'Coach',
  email: '',
  password: '',
  displayName: '',
  position: 'Midfielder',
  birthDate: '',
});

const isPlayer = computed(() => form.accountType === 'Player');

const accountTypes: { value: AccountType; title: string; description: string }[] = [
  { value: 'Coach', title: 'Cuerpo técnico', description: 'Entrenador, ayudante, delegado… Creas la plantilla y registras las actas.' },
  { value: 'Player', title: 'Jugador', description: 'Te vinculas a tu ficha con el código de tu cuerpo técnico y sigues tus números.' },
];

const loading = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

async function submit() {
  loading.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    await auth.register({
      email: form.email,
      password: form.password,
      displayName: form.displayName,
      accountType: form.accountType,
      position: isPlayer.value ? form.position : null,
      birthDate: isPlayer.value && form.birthDate ? form.birthDate : null,
    });
    await router.push(isPlayer.value ? { name: 'join' } : { name: 'teams' });
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto mt-8 max-w-lg">
    <div class="card">
      <h1 class="text-xl font-semibold text-slate-900">Darme de alta</h1>
      <p class="mt-1 text-sm text-slate-500">Elige qué papel tienes en tu equipo: la cuenta no se puede cambiar después.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <Alert v-if="error" kind="error">{{ error }}</Alert>

        <div class="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Tipo de cuenta">
          <button
            v-for="type in accountTypes"
            :key="type.value"
            type="button"
            role="radio"
            :aria-checked="form.accountType === type.value"
            class="rounded-xl border p-3 text-left transition"
            :class="form.accountType === type.value ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30' : 'border-slate-200 bg-white hover:border-emerald-300'"
            @click="form.accountType = type.value"
          >
            <p class="font-medium text-slate-900">{{ type.title }}</p>
            <p class="mt-1 text-xs text-slate-500">{{ type.description }}</p>
          </button>
        </div>

        <div>
          <label class="label" for="displayName">Nombre y apellidos</label>
          <input id="displayName" v-model="form.displayName" type="text" required maxlength="100" class="input" />
          <p v-if="isPlayer" class="mt-1 text-xs text-slate-400">Tal y como apareces en la plantilla: así tu cuerpo técnico te reconoce al vincularte.</p>
          <p v-if="fieldErrors.displayName" class="field-error">{{ fieldErrors.displayName[0] }}</p>
        </div>

        <div v-if="isPlayer" class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="position">Posición</label>
            <select id="position" v-model="form.position" class="input">
              <option v-for="option in positionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
            <p v-if="fieldErrors.position" class="field-error">{{ fieldErrors.position[0] }}</p>
          </div>
          <div>
            <label class="label" for="birthDate">Fecha de nacimiento</label>
            <input id="birthDate" v-model="form.birthDate" type="date" class="input" />
            <p v-if="fieldErrors.birthDate" class="field-error">{{ fieldErrors.birthDate[0] }}</p>
          </div>
        </div>

        <div>
          <label class="label" for="email">Email</label>
          <input id="email" v-model="form.email" type="email" autocomplete="email" required class="input" />
          <p v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email[0] }}</p>
        </div>

        <div>
          <label class="label" for="password">Contraseña</label>
          <input id="password" v-model="form.password" type="password" autocomplete="new-password" required minlength="8" class="input" />
          <p class="mt-1 text-xs text-slate-400">Mínimo 8 caracteres con al menos un número.</p>
          <p v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password[0] }}</p>
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="loading">
          {{ loading ? 'Creando cuenta…' : isPlayer ? 'Crear cuenta de jugador' : 'Crear cuenta de cuerpo técnico' }}
        </button>
      </form>

      <p class="mt-4 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?
        <RouterLink to="/login" class="font-medium text-emerald-700 hover:underline">Entra</RouterLink>
      </p>
    </div>
  </div>
</template>
