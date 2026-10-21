<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const code = ref(typeof route.query.code === 'string' ? route.query.code.toUpperCase() : '');
const loading = ref(false);
const error = ref<string | null>(null);

async function redeem() {
  loading.value = true;
  error.value = null;
  try {
    const coach = await api.coaches.redeem(code.value.trim());
    await auth.refreshAccount();
    const redeemed = coach.appointments.find((a) => a.status === 'Active' && a.squadId) ?? null;
    await router.push(redeemed?.squadId ? { name: 'squad', params: { squadId: redeemed.squadId } } : { name: 'home' });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <PageHeader title="Canjear un código de acceso" subtitle="El código que te entrega tu club al nombrarte para un equipo y una temporada." />

    <Alert v-if="!auth.isCoach" kind="warning">Solo las cuentas del cuerpo técnico canjean códigos de acceso.</Alert>

    <div v-else class="card">
      <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>

      <form class="flex flex-wrap items-end gap-3" @submit.prevent="redeem">
        <div class="min-w-48 flex-1">
          <label class="label" for="access-code">Código de acceso</label>
          <input
            id="access-code"
            v-model="code"
            type="text"
            required
            maxlength="12"
            autocomplete="off"
            spellcheck="false"
            placeholder="ABCD234567"
            class="input font-mono uppercase tracking-widest"
            @input="code = code.toUpperCase()"
          />
        </div>
        <button type="submit" class="btn-primary" :disabled="loading || code.trim().length < 6">{{ loading ? 'Canjeando…' : 'Canjear' }}</button>
      </form>

      <p class="mt-4 text-xs text-slate-500">
        Al canjearlo entras en el cuerpo técnico de la plantilla del equipo (se crea si todavía no existe, con las fichas que
        publica futbolasturiano.es) hasta la fecha de validez del nombramiento. Cada código solo se puede usar una vez.
      </p>
    </div>
  </div>
</template>
