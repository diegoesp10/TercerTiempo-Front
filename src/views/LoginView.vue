<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const form = reactive({ email: '', password: '' });
const loading = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

async function submit() {
  loading.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    await auth.login(form);
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
    await router.push(redirect);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto mt-8 max-w-md">
    <div class="card">
      <h1 class="text-xl font-semibold text-slate-900">Entrar</h1>
      <p class="mt-1 text-sm text-slate-500">Accede para registrar tu rendimiento partido a partido.</p>

      <form class="mt-6 space-y-4" @submit.prevent="submit">
        <Alert v-if="error" kind="error">{{ error }}</Alert>

        <div>
          <label class="label" for="email">Email</label>
          <input id="email" v-model="form.email" type="email" autocomplete="email" required class="input" />
          <p v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email[0] }}</p>
        </div>

        <div>
          <label class="label" for="password">Contraseña</label>
          <input id="password" v-model="form.password" type="password" autocomplete="current-password" required class="input" />
          <p v-if="fieldErrors.password" class="field-error">{{ fieldErrors.password[0] }}</p>
        </div>

        <button type="submit" class="btn-primary w-full" :disabled="loading">{{ loading ? 'Entrando…' : 'Entrar' }}</button>
      </form>

      <p class="mt-4 text-center text-sm text-slate-500">
        ¿Aún no tienes cuenta?
        <RouterLink to="/registro" class="font-medium text-emerald-700 hover:underline">Date de alta</RouterLink>
      </p>
    </div>
  </div>
</template>
