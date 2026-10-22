<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import BrandMark from '@/components/layout/BrandMark.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import type { TeamLicenseDto } from '@/types/api';
import { formatDate, formatMoney } from '@/utils/format';

/**
 * Pasarela de pago simulada. Ocupa el sitio que tendrá Stripe Checkout: muestra el importe y una tarjeta de prueba
 * y confirma el pago con un clic, sin cobro real. Cuando se integre Stripe, esta página redirigirá a su Checkout.
 */
const props = defineProps<{ sessionId: string }>();
const router = useRouter();

const { data, loading, error, run } = useAsync(() => api.licensing.checkout(props.sessionId));
watch(() => props.sessionId, () => void run());

const paying = ref(false);
const payError = ref<string | null>(null);
const result = ref<TeamLicenseDto | null>(null);

async function pay() {
  paying.value = true;
  payError.value = null;
  try {
    await new Promise((resolve) => setTimeout(resolve, 900));
    result.value = await api.licensing.confirm(props.sessionId);
  } catch (e) {
    payError.value = errorMessage(e);
  } finally {
    paying.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-lg">
    <Spinner v-if="loading && !data" />
    <Alert v-else-if="error" kind="error">{{ error }}</Alert>

    <div v-else-if="data" class="card">
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <BrandMark :size="34" />
          <div>
            <p class="eyebrow">Pago de licencia</p>
            <h1 class="text-xl font-bold text-slate-900">{{ data.teamName }}</h1>
          </div>
        </div>
        <Badge tone="amber">Pasarela simulada</Badge>
      </div>

      <dl class="mt-5 divide-y divide-line rounded-xl border border-line bg-surface-2 text-sm">
        <div class="flex justify-between px-4 py-2"><dt class="text-slate-500">Concepto</dt><dd class="text-slate-800">Licencia de equipo · {{ data.months }} {{ data.months === 1 ? 'mes' : 'meses' }}</dd></div>
        <div class="flex justify-between px-4 py-2"><dt class="text-slate-500">Importe</dt><dd class="font-figures text-lg font-extrabold text-slate-900">{{ formatMoney(data.amountCents, data.currency) }}</dd></div>
        <div class="flex justify-between px-4 py-2"><dt class="text-slate-500">Referencia</dt><dd class="font-mono text-xs text-slate-600">{{ data.sessionId }}</dd></div>
      </dl>

      <template v-if="result">
        <Alert kind="success" class="mt-5">
          Pago confirmado. <strong>{{ result.teamName }}</strong> tiene licencia hasta el <strong>{{ formatDate(result.validUntil) }}</strong>.
        </Alert>
        <div class="mt-4 flex flex-wrap gap-2">
          <RouterLink to="/" class="btn-primary">Volver a mi club</RouterLink>
          <RouterLink v-if="result.squadId" :to="{ name: 'squad', params: { squadId: result.squadId } }" class="btn-secondary">Ver la plantilla</RouterLink>
        </div>
      </template>

      <template v-else-if="data.status === 'Paid'">
        <Alert kind="info" class="mt-5">Este pago ya estaba confirmado.</Alert>
        <RouterLink to="/" class="btn-primary mt-4">Volver a mi club</RouterLink>
      </template>

      <form v-else class="mt-5 space-y-3" @submit.prevent="pay">
        <p class="text-xs text-slate-500">
          Aquí irá el formulario de Stripe. Mientras tanto no se cobra nada: la tarjeta de abajo es de prueba y el pago se confirma al pulsar el botón.
        </p>
        <div>
          <label class="label" for="card-number">Número de tarjeta</label>
          <input id="card-number" type="text" class="input font-mono" value="4242 4242 4242 4242" readonly />
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="label" for="card-exp">Caducidad</label>
            <input id="card-exp" type="text" class="input font-mono" value="12/30" readonly />
          </div>
          <div>
            <label class="label" for="card-cvc">CVC</label>
            <input id="card-cvc" type="text" class="input font-mono" value="123" readonly />
          </div>
        </div>
        <Alert v-if="payError" kind="error">{{ payError }}</Alert>
        <div class="flex flex-wrap justify-end gap-2 pt-2">
          <button type="button" class="btn-ghost" @click="router.push('/')">Cancelar</button>
          <button type="submit" class="btn-primary" v-busy="paying" :disabled="paying">
            <Icon icon="lock" class="mr-1.5 h-3.5 w-3.5" />Pagar {{ formatMoney(data.amountCents, data.currency) }} (simulado)
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
