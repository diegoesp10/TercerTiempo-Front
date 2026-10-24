<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import BrandMark from '@/components/layout/BrandMark.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import type { TeamLicenseDto } from '@/types/api';
import { billingIntervalLabels, billingIntervalSuffix, formatDate, formatMoney, formatPrice, licensePlanLabels, staffCountLabel } from '@/utils/format';

/**
 * Pago de una licencia. Con la pasarela simulada es la página de pago: resumen del pedido y una tarjeta de prueba que
 * confirma la suscripción con un clic, sin cobro real. Con Stripe es la página a la que vuelve el club desde Stripe
 * Checkout: confirma la sesión (el webhook hace lo mismo, lo que llegue antes) y enseña el resultado.
 */
const props = defineProps<{ sessionId: string }>();

const { data, loading, error, run } = useAsync(() => api.licensing.checkout(props.sessionId));
watch(() => props.sessionId, () => void run());

const paying = ref(false);
const payError = ref<string | null>(null);
const result = ref<TeamLicenseDto | null>(null);

const isMock = computed(() => data.value?.provider === 'mock');
const chargedNow = computed(() => (data.value?.amountCents ?? 0) > 0);
const period = computed(() => (data.value ? (data.value.interval === 'Yearly' ? 'cada año' : 'cada mes') : ''));

async function confirm(delayMs = 0) {
  paying.value = true;
  payError.value = null;
  try {
    if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
    result.value = await api.licensing.confirm(props.sessionId);
  } catch (e) {
    payError.value = errorMessage(e);
  } finally {
    paying.value = false;
  }
}

// Vuelta desde Stripe: la sesión ya está pagada allí; se confirma al llegar (y se reintenta un par de veces si Stripe
// aún no la da por completada).
watch(data, async (checkout) => {
  if (!checkout || checkout.provider === 'mock' || checkout.status !== 'Pending' || result.value) return;
  for (const wait of [0, 1500, 3000]) {
    await confirm(wait);
    if (result.value) break;
  }
});
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <Spinner v-if="loading && !data" class="my-12" />
    <Alert v-else-if="error" kind="error">{{ error }}</Alert>

    <template v-else-if="data">
      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <BrandMark :size="34" />
          <div>
            <p class="eyebrow">Licencia de equipo</p>
            <h1 class="text-2xl font-bold text-slate-900">{{ result || data.status === 'Paid' ? 'Suscripción activa' : 'Completa el pago' }}</h1>
          </div>
        </div>
        <Badge v-if="isMock" tone="amber">Pasarela simulada · sin cobro real</Badge>
      </div>

      <div class="grid gap-6 lg:grid-cols-5">
        <!-- Resumen del pedido -->
        <aside class="card lg:col-span-2 lg:self-start">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Resumen</p>
          <div class="mt-3 flex items-start justify-between gap-3">
            <div>
              <p class="text-lg font-bold text-slate-900">Licencia {{ licensePlanLabels[data.plan] }}</p>
              <p class="text-sm text-slate-500">{{ data.teamName }}</p>
            </div>
            <span class="rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">{{ billingIntervalLabels[data.interval] }}</span>
          </div>

          <ul class="mt-4 space-y-1.5 text-sm text-slate-600">
            <li class="flex gap-2"><Icon icon="check" class="mt-1 h-3 w-3 text-emerald-600" />Plantilla entera y todas las herramientas</li>
            <li class="flex gap-2"><Icon icon="check" class="mt-1 h-3 w-3 text-emerald-600" />{{ data.plan === 'Premium' ? 'Cuerpo técnico completo' : staffCountLabel(1) + ' con cuenta' }}</li>
            <li class="flex gap-2"><Icon icon="check" class="mt-1 h-3 w-3 text-emerald-600" />Sin permanencia, cancela cuando quieras</li>
          </ul>

          <dl class="mt-5 space-y-2 border-t border-line pt-4 text-sm">
            <div class="flex justify-between gap-3">
              <dt class="text-slate-500">Precio</dt>
              <dd class="font-figures text-slate-800">{{ formatPrice(data.periodPriceCents, data.currency) }}{{ billingIntervalSuffix[data.interval] }}</dd>
            </div>
            <div class="flex justify-between gap-3">
              <dt class="text-slate-500">{{ chargedNow ? 'Siguiente cobro' : 'Primer cobro' }}</dt>
              <dd class="text-right text-slate-800">{{ chargedNow ? (data.interval === 'Yearly' ? 'Dentro de un año' : 'Dentro de un mes') : formatDate(data.firstChargeOn) }}</dd>
            </div>
            <div class="flex items-baseline justify-between gap-3 border-t border-line pt-3">
              <dt class="font-semibold text-slate-900">Total hoy</dt>
              <dd class="font-figures text-2xl font-extrabold text-slate-900">{{ formatMoney(data.amountCents, data.currency) }}</dd>
            </div>
          </dl>
          <p class="mt-3 text-xs leading-relaxed text-slate-500">
            <template v-if="!chargedNow">Lo que te queda de prueba o de licencia se mantiene: el primer cobro de {{ formatPrice(data.periodPriceCents, data.currency) }} llega el {{ formatDate(data.firstChargeOn) }} y después {{ period }}.</template>
            <template v-else>Se renueva {{ period }} por {{ formatPrice(data.periodPriceCents, data.currency) }} hasta que canceles.</template>
            IVA incluido.
          </p>
        </aside>

        <!-- Pago o resultado -->
        <section class="card lg:col-span-3">
          <!-- Hecho -->
          <div v-if="result || data.status === 'Paid'" class="py-4 text-center">
            <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
              <Icon icon="check" class="h-6 w-6" />
            </span>
            <h2 class="mt-4 text-xl font-bold text-slate-900">¡Listo! {{ (result?.teamName ?? data.teamName) }} tiene licencia {{ licensePlanLabels[data.plan] }}</h2>
            <p v-if="result" class="mx-auto mt-2 max-w-md text-sm text-slate-500">
              <template v-if="result.renewsOn">Próximo cobro: {{ formatPrice(result.renewalPriceCents ?? data.periodPriceCents, data.currency) }} el {{ formatDate(result.renewsOn) }}. </template>
              Puedes cambiar de plan o cancelar la renovación cuando quieras desde tu club.
            </p>
            <p v-else class="mt-2 text-sm text-slate-500">Este pago ya estaba confirmado.</p>
            <div class="mt-6 flex flex-wrap justify-center gap-2">
              <RouterLink to="/" class="btn-primary">Volver a mi club</RouterLink>
              <RouterLink v-if="result?.squadId" :to="{ name: 'squad', params: { squadId: result.squadId } }" class="btn-secondary">Ver la plantilla</RouterLink>
            </div>
          </div>

          <!-- Stripe: confirmando la vuelta -->
          <div v-else-if="!isMock" class="py-8 text-center">
            <Spinner v-if="paying" />
            <template v-else>
              <Alert v-if="payError" kind="warning" class="text-left">{{ payError }} Si acabas de pagar, espera unos segundos y vuelve a comprobarlo.</Alert>
              <div class="mt-4 flex flex-wrap justify-center gap-2">
                <button type="button" class="btn-primary" @click="confirm()">Comprobar el pago</button>
                <RouterLink :to="{ name: 'licenses', query: { equipo: data.teamId } }" class="btn-ghost">Volver a los planes</RouterLink>
              </div>
            </template>
          </div>

          <!-- Pasarela simulada -->
          <form v-else class="space-y-4" @submit.prevent="confirm(900)">
            <div>
              <h2 class="font-semibold text-slate-900">Datos de pago</h2>
              <p class="mt-1 text-xs text-slate-500">
                Aquí irá el formulario seguro de Stripe. Mientras tanto no se cobra nada: la tarjeta es de prueba y la suscripción se confirma al pulsar el botón.
              </p>
            </div>
            <div>
              <label class="label" for="card-number">Número de tarjeta</label>
              <div class="relative">
                <input id="card-number" type="text" class="input pr-10 font-mono" value="4242 4242 4242 4242" readonly />
                <Icon icon="credit-card" class="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              </div>
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
            <button type="submit" class="btn-primary w-full py-3 text-base" v-busy="paying" :disabled="paying">
              <Icon icon="lock" class="h-4 w-4" />
              <template v-if="chargedNow">Pagar {{ formatMoney(data.amountCents, data.currency) }} y activar</template>
              <template v-else>Activar suscripción · hoy 0 €</template>
            </button>
            <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span class="inline-flex items-center gap-1.5"><Icon icon="shield-halved" class="h-3 w-3" />Pago seguro con Stripe</span>
              <RouterLink :to="{ name: 'licenses', query: { equipo: data.teamId } }" class="font-medium hover:text-slate-800">Cambiar de plan</RouterLink>
            </div>
          </form>
        </section>
      </div>
    </template>
  </div>
</template>
