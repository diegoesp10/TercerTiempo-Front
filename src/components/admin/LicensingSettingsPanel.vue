<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import type { LicenseItem, LicensingSettingsDto } from '@/types/api';
import { formatKickoff, formatMoney, licenseItemLabels } from '@/utils/format';

/**
 * Precios y prueba de las licencias, guardados en la base de datos: la licencia de club, cada licencia de técnico, la
 * prueba (días y técnicos) y el tope de técnicos por club. Los precios se editan en euros con IVA y viajan en céntimos.
 * La pasarela (simulada o Stripe) y sus claves son de cada entorno y no se tocan desde aquí.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: []; saved: [] }>();

interface PriceForm {
  item: LicenseItem;
  monthly: string;
  yearly: string;
  stripeMonthly: string;
  stripeYearly: string;
}

const settings = ref<LicensingSettingsDto | null>(null);
const currency = ref('EUR');
const trialDays = ref(30);
const trialStaffSeats = ref(2);
const maxStaffSeats = ref(30);
// Días de aviso de caducidad, escritos separados por comas («15, 5»).
const alertDays = ref('');
const parseAlertDays = (text: string) =>
  [...new Set(text.split(/[,;\s]+/).map((d) => Number(d)).filter((d) => Number.isInteger(d) && d > 0))].sort((a, b) => b - a);
const prices = ref<PriceForm[]>([]);
const error = ref<string | null>(null);
const saved = ref(false);
const saving = ref(false);

const toCents = (euros: string | number) => Math.round(Number(euros) * 100);
const toEuros = (cents: number) => (cents / 100).toFixed(2);

function fill(dto: LicensingSettingsDto) {
  settings.value = dto;
  currency.value = dto.currency;
  trialDays.value = dto.trialDays;
  trialStaffSeats.value = dto.trialStaffSeats;
  maxStaffSeats.value = dto.maxStaffSeats;
  alertDays.value = dto.expiryAlertDays.join(', ');
  prices.value = dto.prices.map((p) => ({
    item: p.item,
    monthly: toEuros(p.monthlyPriceCents),
    yearly: toEuros(p.yearlyPriceCents),
    stripeMonthly: p.stripeMonthlyPriceId ?? '',
    stripeYearly: p.stripeYearlyPriceId ?? '',
  }));
}

const dirty = computed(() => {
  const dto = settings.value;
  if (!dto) return false;
  return dto.currency !== currency.value.trim().toUpperCase()
    || dto.trialDays !== trialDays.value
    || dto.trialStaffSeats !== trialStaffSeats.value
    || dto.maxStaffSeats !== maxStaffSeats.value
    || dto.expiryAlertDays.join(',') !== parseAlertDays(alertDays.value).join(',')
    || prices.value.some((form) => {
      const p = dto.prices.find((x) => x.item === form.item);
      return !p || p.monthlyPriceCents !== toCents(form.monthly) || p.yearlyPriceCents !== toCents(form.yearly)
        || (p.stripeMonthlyPriceId ?? '') !== form.stripeMonthly.trim() || (p.stripeYearlyPriceId ?? '') !== form.stripeYearly.trim();
    });
});

/** Lo que se ahorra pagando el año frente a doce meses, para no poner por error un anual más caro. */
function yearlySaving(form: PriceForm) {
  const twelve = toCents(form.monthly) * 12;
  if (!twelve || !toCents(form.yearly)) return null;
  return Math.round((1 - toCents(form.yearly) / twelve) * 100);
}

async function guard<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    error.value = null;
    return await action();
  } catch (e) {
    if ((e as { status?: number }).status === 401) emit('unauthorized');
    else error.value = errorMessage(e);
    return undefined;
  }
}

async function load() {
  const result = await guard(() => adminApi.licensingSettings(props.token));
  if (result) fill(result);
}

async function save() {
  saving.value = true;
  saved.value = false;
  const result = await guard(() => adminApi.updateLicensingSettings(props.token, {
    currency: currency.value.trim().toUpperCase(),
    trialDays: trialDays.value,
    trialStaffSeats: trialStaffSeats.value,
    maxStaffSeats: maxStaffSeats.value,
    expiryAlertDays: parseAlertDays(alertDays.value),
    prices: prices.value.map((form) => ({
      item: form.item,
      monthlyPriceCents: toCents(form.monthly),
      yearlyPriceCents: toCents(form.yearly),
      stripeMonthlyPriceId: form.stripeMonthly.trim() || null,
      stripeYearlyPriceId: form.stripeYearly.trim() || null,
    })),
  }));
  if (result) {
    fill(result);
    saved.value = true;
    emit('saved');
  }
  saving.value = false;
}

onMounted(load);
</script>

<template>
  <section class="card">
    <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
      <h2 class="font-semibold text-slate-900">Precios y prueba de las licencias</h2>
      <div v-if="settings" class="flex items-center gap-2 text-xs text-slate-500">
        <Badge :tone="settings.provider === 'stripe' ? 'green' : 'amber'">{{ settings.provider === 'stripe' ? 'Stripe' : 'Pasarela simulada' }}</Badge>
        <span>Guardado {{ formatKickoff(settings.updatedAt) }}</span>
      </div>
    </div>
    <p class="mb-4 text-xs text-slate-500">
      Precios con IVA incluido. Los cambios valen desde ya para las altas, las pruebas que empiecen y los pagos nuevos.
      Las suscripciones ya creadas en Stripe siguen cobrando su precio hasta que cambies su renovación en Stripe; con la
      pasarela simulada, la próxima renovación ya cobra el precio nuevo. La pasarela y las claves de Stripe son de cada
      entorno (configuración y secretos), no de aquí.
    </p>

    <form v-if="settings" class="space-y-4" @submit.prevent="save">
      <div class="flex flex-wrap gap-3">
        <label class="w-28">
          <span class="label">Moneda</span>
          <input v-model="currency" type="text" required minlength="3" maxlength="3" class="input uppercase" />
        </label>
        <label class="w-36">
          <span class="label">Días de prueba</span>
          <input v-model.number="trialDays" type="number" required min="0" max="365" class="input" />
        </label>
        <label class="w-40">
          <span class="label">Técnicos en la prueba</span>
          <input v-model.number="trialStaffSeats" type="number" required min="0" :max="maxStaffSeats" class="input" />
        </label>
        <label class="w-40">
          <span class="label">Técnicos por club (tope)</span>
          <input v-model.number="maxStaffSeats" type="number" required min="1" max="200" class="input" />
        </label>
        <label class="w-56">
          <span class="label">Avisos de caducidad (días antes)</span>
          <input v-model="alertDays" type="text" inputmode="numeric" placeholder="15, 5" class="input" />
          <span class="mt-1 block text-[11px] text-slate-500">Campanita del club si su licencia acaba sin renovarse. Vacío = sin avisos; hasta 5 valores de 1 a 90.</span>
        </label>
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <fieldset v-for="form in prices" :key="form.item" class="rounded-lg border border-slate-200 p-4">
          <legend class="px-1 text-sm font-semibold text-slate-900">{{ licenseItemLabels[form.item] }}<template v-if="form.item === 'StaffSeat'"> (cada una)</template></legend>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label>
              <span class="label">Al mes (€)</span>
              <input v-model="form.monthly" type="number" required min="0.5" max="10000" step="0.01" class="input" />
            </label>
            <label>
              <span class="label">Al año (€)</span>
              <input v-model="form.yearly" type="number" required min="0.5" max="100000" step="0.01" class="input" />
            </label>
            <p class="self-end pb-2 text-xs text-slate-500 sm:col-span-2">
              <template v-if="yearlySaving(form) !== null">
                Doce meses: {{ formatMoney(toCents(form.monthly) * 12, currency || 'EUR') }} ·
                <span :class="yearlySaving(form)! < 0 ? 'text-red-600' : ''">el año ahorra un {{ yearlySaving(form) }} %</span>
              </template>
            </p>
            <label>
              <span class="label">Precio Stripe mensual</span>
              <input v-model="form.stripeMonthly" type="text" maxlength="100" placeholder="price_…" class="input font-mono text-xs" />
            </label>
            <label>
              <span class="label">Precio Stripe anual</span>
              <input v-model="form.stripeYearly" type="text" maxlength="100" placeholder="price_…" class="input font-mono text-xs" />
            </label>
          </div>
        </fieldset>
      </div>
      <p class="text-xs text-slate-500">
        Sin id de precio de Stripe, el pago se crea con el importe de aquí. Con él, Stripe cobra el precio que tenga ese id:
        mantenlo igual que el importe de esta pantalla.
      </p>

      <Alert v-if="error" kind="error">{{ error }}</Alert>
      <Alert v-if="saved && !dirty" kind="success">Precios guardados. La web pública ya muestra los nuevos.</Alert>

      <div class="flex flex-wrap gap-2">
        <button type="submit" class="btn-primary" v-busy="saving" :disabled="saving || !dirty">Guardar cambios</button>
        <button type="button" class="btn-ghost" :disabled="saving || !dirty" @click="fill(settings!)">Descartar</button>
      </div>
    </form>
    <Alert v-else-if="error" kind="error">{{ error }}</Alert>
  </section>
</template>
