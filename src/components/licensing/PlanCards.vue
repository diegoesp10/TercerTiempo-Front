<script setup lang="ts">
import { computed } from 'vue';
import type { BillingInterval, LicenseItem, LicensingCatalogDto } from '@/types/api';
import { formatPrice } from '@/utils/format';
import { clubFeatures, freeMonths, priceOf, staffFeatures } from './plans';

/**
 * Tarjetas de precios con el selector mensual/anual: la licencia de club y, aparte, las licencias de técnico. La acción
 * de cada tarjeta (contratar, añadir técnicos, registrarse…) la pone quien la usa en el slot «action».
 */
const props = defineProps<{ catalog: LicensingCatalogDto }>();
const interval = defineModel<BillingInterval>('interval', { default: 'Monthly' });

const currency = computed(() => props.catalog.currency);
const maxFree = computed(() => Math.max(0, freeMonths(props.catalog.club), freeMonths(props.catalog.staffSeat)));
const monthlyEquivalent = (cents: number) => formatPrice(Math.round(cents / 12), currency.value);

const cards = computed(() => [
  {
    item: 'Club' as LicenseItem,
    title: 'Licencia de club',
    tagline: 'El club al completo, sin técnicos',
    price: props.catalog.club,
    prefix: '',
    unit: '',
    features: clubFeatures,
    note: 'El club hace todo lo del cuerpo técnico',
    noteDetail: `Durante la prueba incluye ${props.catalog.trialStaffSeats === 1 ? '1 técnico' : `${props.catalog.trialStaffSeats} técnicos`}.`,
  },
  {
    item: 'StaffSeat' as LicenseItem,
    title: 'Licencias de técnico',
    tagline: 'Cuentas para el cuerpo técnico, cuando las necesites',
    price: props.catalog.staffSeat,
    prefix: '+',
    unit: ' por técnico',
    features: staffFeatures,
    note: 'Se añaden con la licencia de club',
    noteDetail: `Hasta ${props.catalog.maxStaffSeats} técnicos por club.`,
  },
]);
</script>

<template>
  <div>
    <div class="flex justify-center">
      <div class="inline-flex rounded-full border border-line bg-surface-2 p-1" role="radiogroup" aria-label="Facturación">
        <button
          v-for="option in (['Monthly', 'Yearly'] as const)"
          :key="option"
          type="button"
          role="radio"
          :aria-checked="interval === option"
          class="flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition"
          :class="interval === option ? 'bg-action text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'"
          @click="interval = option"
        >
          {{ option === 'Monthly' ? 'Mensual' : 'Anual' }}
          <span
            v-if="option === 'Yearly' && maxFree > 0"
            class="rounded-full px-2 py-0.5 text-[11px] font-bold"
            :class="interval === option ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'"
          >{{ maxFree }} meses gratis</span>
        </button>
      </div>
    </div>

    <div class="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-5 md:grid-cols-2">
      <article
        v-for="card in cards"
        :key="card.item"
        class="relative flex flex-col rounded-2xl border bg-surface p-6 shadow-card"
        :class="card.item === 'Club' ? 'border-brand-500/60 ring-1 ring-brand-500/30' : 'border-line'"
      >
        <span
          v-if="card.item === 'Club'"
          class="absolute -top-3 left-6 rounded-full bg-action px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm"
        >Lo primero que contratas</span>

        <div>
          <h3 class="text-xl font-bold text-slate-900">{{ card.title }}</h3>
          <p class="mt-0.5 text-sm text-slate-500">{{ card.tagline }}</p>
        </div>

        <div class="mt-5">
          <p class="flex flex-wrap items-baseline gap-1.5">
            <span class="font-figures text-4xl font-extrabold tracking-tight text-slate-900">{{ card.prefix }}{{ formatPrice(priceOf(card.price, interval), currency) }}</span>
            <span class="text-sm font-medium text-slate-500">{{ interval === 'Yearly' ? '/año' : '/mes' }}{{ card.unit }}</span>
          </p>
          <p class="mt-1 min-h-5 text-xs text-slate-500">
            <template v-if="interval === 'Yearly'">
              Equivale a {{ monthlyEquivalent(card.price.yearlyPriceCents) }}/mes<template v-if="freeMonths(card.price) > 0"> · <strong class="text-emerald-700">{{ freeMonths(card.price) }} meses gratis</strong></template>
            </template>
            <template v-else>O {{ formatPrice(card.price.yearlyPriceCents, currency) }}/año{{ card.unit }} pagando de una vez</template>
          </p>
        </div>

        <div class="mt-5 flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
            <Icon :icon="card.item === 'Club' ? 'shield-halved' : 'user-group'" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <p class="font-semibold text-slate-900">{{ card.note }}</p>
            <p class="text-xs text-slate-500">{{ card.noteDetail }}</p>
          </div>
        </div>

        <ul class="mt-5 flex-1 space-y-2 text-sm text-slate-700">
          <li v-for="feature in card.features" :key="feature" class="flex items-start gap-2.5">
            <Icon icon="check" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>{{ feature }}</span>
          </li>
        </ul>

        <div class="mt-6">
          <slot name="action" :item="card.item" :price-cents="priceOf(card.price, interval)" />
        </div>
      </article>
    </div>
  </div>
</template>
