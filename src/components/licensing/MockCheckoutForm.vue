<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import type { LicenseCheckoutDto, SimulatedPaymentOutcome } from '@/types/api';
import { formatMoney } from '@/utils/format';

/**
 * Página de pago de la pasarela simulada, hecha como Stripe Checkout: tarjeta, caducidad, CVC, titular y país, con
 * las tarjetas de prueba de Stripe y sus mismos resultados (pago correcto, autenticación 3D Secure, rechazada, sin
 * fondos, caducada). Los datos de la tarjeta no salen del navegador: a la API solo va el resultado de la prueba.
 */
const props = defineProps<{ checkout: LicenseCheckoutDto }>();
const emit = defineEmits<{ paid: [] }>();

interface TestCard {
  number: string;
  label: string;
  outcome: SimulatedPaymentOutcome | 'ThreeDSecure';
}

/** Las tarjetas de prueba de Stripe (stripe.com/docs/testing) y lo que contesta con cada una. */
const testCards: TestCard[] = [
  { number: '4242 4242 4242 4242', label: 'Pago correcto', outcome: 'Succeeded' },
  { number: '4000 0025 0000 3155', label: 'Pide autenticación (3D Secure)', outcome: 'ThreeDSecure' },
  { number: '4000 0000 0000 0002', label: 'Rechazada', outcome: 'Declined' },
  { number: '4000 0000 0000 9995', label: 'Sin fondos', outcome: 'InsufficientFunds' },
  { number: '4000 0000 0000 0069', label: 'Caducada', outcome: 'ExpiredCard' },
];

const form = reactive({ email: '', number: '', expiry: '', cvc: '', name: '', country: 'ES' });
const errors = reactive<Record<string, string | null>>({ number: null, expiry: null, cvc: null, name: null });
const paying = ref(false);
const payError = ref<string | null>(null);
const challenge = ref(false);

const digits = computed(() => form.number.replace(/\D/g, ''));
const brand = computed(() => (/^4/.test(digits.value) ? 'Visa' : /^(5[1-5]|2[2-7])/.test(digits.value) ? 'Mastercard' : /^3[47]/.test(digits.value) ? 'Amex' : null));
const chargedNow = computed(() => props.checkout.amountCents > 0);

function formatNumber(event: Event) {
  const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 16);
  form.number = value.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiry(event: Event) {
  const value = (event.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 4);
  form.expiry = value.length > 2 ? `${value.slice(0, 2)} / ${value.slice(2)}` : value;
}

function useCard(card: TestCard) {
  form.number = card.number;
  if (!form.expiry) form.expiry = '12 / 34';
  if (!form.cvc) form.cvc = '123';
  if (!form.name) form.name = 'Titular de prueba';
  payError.value = null;
}

const luhn = (value: string) => {
  let sum = 0;
  [...value].reverse().forEach((ch, i) => {
    let n = Number(ch);
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  });
  return value.length >= 13 && sum % 10 === 0;
};

function validate() {
  errors.number = luhn(digits.value) ? null : 'El número de la tarjeta no es válido.';
  const [mm, yy] = form.expiry.split('/').map((p) => Number(p.trim()));
  const now = new Date();
  const expired = !mm || !yy || mm > 12 || 2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1);
  errors.expiry = expired ? 'La fecha de caducidad no es válida.' : null;
  errors.cvc = /^\d{3,4}$/.test(form.cvc) ? null : 'El código de seguridad no es válido.';
  errors.name = form.name.trim() ? null : 'Escribe el nombre del titular.';
  return !errors.number && !errors.expiry && !errors.cvc && !errors.name;
}

async function submit() {
  payError.value = null;
  if (!validate()) return;
  const card = testCards.find((c) => c.number.replace(/\s/g, '') === digits.value);
  if (!card) {
    payError.value = 'En el modo de prueba solo valen las tarjetas de prueba de Stripe (elige una de la lista). Nunca uses una tarjeta real aquí.';
    return;
  }
  if (card.outcome === 'ThreeDSecure') {
    challenge.value = true;
    return;
  }
  await pay(card.outcome);
}

async function pay(outcome: SimulatedPaymentOutcome) {
  challenge.value = false;
  paying.value = true;
  try {
    // La pasarela tarda un poco en contestar, como la de verdad.
    await new Promise((resolve) => setTimeout(resolve, 700));
    const result = await api.licensing.simulatePayment(props.checkout.sessionId, outcome);
    if (result.succeeded) emit('paid');
    else payError.value = `${result.message} (${result.declineCode})`;
  } catch (e) {
    payError.value = errorMessage(e);
  } finally {
    paying.value = false;
  }
}
</script>

<template>
  <form class="space-y-4" novalidate @submit.prevent="submit">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900">Pagar con tarjeta</h2>
        <p class="mt-1 text-xs text-slate-500">Pasarela simulada con el mismo recorrido que Stripe Checkout. No se cobra nada y los datos de la tarjeta no salen de tu navegador.</p>
      </div>
      <span class="rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-500">Modo de prueba</span>
    </div>

    <!-- Tarjetas de prueba -->
    <div class="rounded-xl border border-dashed border-amber-400/50 bg-amber-400/5 p-3">
      <p class="text-xs font-semibold text-slate-700">Tarjetas de prueba de Stripe</p>
      <div class="mt-2 grid grid-cols-1 gap-1.5">
        <button
          v-for="card in testCards"
          :key="card.number"
          type="button"
          class="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left text-xs transition"
          :class="digits === card.number.replace(/\s/g, '') ? 'border-brand-400 bg-brand-500/10' : 'border-line bg-surface hover:border-brand-400/60'"
          @click="useCard(card)"
        >
          <span class="whitespace-nowrap font-mono text-slate-800">{{ card.number }}</span>
          <span class="min-w-0 truncate text-right text-slate-500">{{ card.label }}</span>
        </button>
      </div>
      <p class="mt-2 text-[11px] text-slate-500">Cualquier fecha futura y cualquier CVC de 3 cifras.</p>
    </div>

    <div>
      <label class="label" for="pay-email">Correo electrónico</label>
      <input id="pay-email" v-model="form.email" type="email" autocomplete="off" class="input" placeholder="tu@club.es" />
    </div>

    <fieldset>
      <legend class="label">Información de la tarjeta</legend>
      <div class="overflow-hidden rounded-xl border border-line bg-surface focus-within:border-brand-400">
        <div class="relative border-b border-line">
          <input
            :value="form.number"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            class="w-full bg-transparent px-3 py-2.5 font-mono text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="1234 1234 1234 1234"
            aria-label="Número de tarjeta"
            @input="formatNumber"
          />
          <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">{{ brand ?? '' }}<Icon v-if="!brand" icon="credit-card" class="h-4 w-4 text-slate-400" /></span>
        </div>
        <div class="grid grid-cols-2">
          <input
            :value="form.expiry"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            class="border-r border-line bg-transparent px-3 py-2.5 font-mono text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="MM / AA"
            aria-label="Caducidad"
            @input="formatExpiry"
          />
          <input
            v-model="form.cvc"
            type="text"
            inputmode="numeric"
            maxlength="4"
            autocomplete="off"
            class="bg-transparent px-3 py-2.5 font-mono text-slate-900 outline-none placeholder:text-slate-400"
            placeholder="CVC"
            aria-label="CVC"
          />
        </div>
      </div>
      <p v-for="key in ['number', 'expiry', 'cvc']" v-show="errors[key]" :key="key" class="mt-1 text-xs text-red-500">{{ errors[key] }}</p>
    </fieldset>

    <div class="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
      <div>
        <label class="label" for="pay-name">Nombre del titular</label>
        <input id="pay-name" v-model="form.name" type="text" autocomplete="off" class="input" placeholder="Como aparece en la tarjeta" />
        <p v-if="errors.name" class="mt-1 text-xs text-red-500">{{ errors.name }}</p>
      </div>
      <div>
        <label class="label" for="pay-country">País</label>
        <select id="pay-country" v-model="form.country" class="input">
          <option value="ES">España</option>
          <option value="PT">Portugal</option>
          <option value="FR">Francia</option>
        </select>
      </div>
    </div>

    <Alert v-if="payError" kind="error">{{ payError }}</Alert>

    <button type="submit" class="btn-primary w-full py-3 text-base" v-busy="paying" :disabled="paying">
      <Icon icon="lock" class="h-4 w-4" />
      <template v-if="paying">Procesando…</template>
      <template v-else-if="chargedNow">Pagar {{ formatMoney(checkout.amountCents, checkout.currency) }}</template>
      <template v-else>Suscribirse · hoy 0 €</template>
    </button>
    <p class="flex items-center justify-center gap-1.5 text-[11px] text-slate-500"><Icon icon="shield-halved" class="h-3 w-3" />Con Stripe, este formulario lo sirve Stripe y Tercer Tiempo no ve la tarjeta.</p>
  </form>

  <!-- 3D Secure: lo que enseñaría el banco -->
  <Modal :open="challenge" title="Autenticación de tu banco" size="md" @close="pay('AuthenticationFailed')">
    <div class="text-center">
      <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-500/15 text-brand-500"><Icon icon="shield-halved" class="h-5 w-5" /></span>
      <p class="mt-3 font-semibold text-slate-900">Confirma el pago en tu banco (simulado)</p>
      <p class="mt-1 text-sm text-slate-500">
        Banco de pruebas · {{ checkout.clubName }} · {{ chargedNow ? formatMoney(checkout.amountCents, checkout.currency) : 'alta sin cobro hoy' }}
      </p>
      <p class="mt-3 text-xs text-slate-500">Con Stripe, aquí aparece la pantalla de tu banco (código por SMS o la app del banco).</p>
    </div>
    <template #footer>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-ghost" @click="pay('AuthenticationFailed')">Rechazar</button>
        <button type="button" class="btn-primary" @click="pay('Succeeded')">Autorizar</button>
      </div>
    </template>
  </Modal>
</template>
