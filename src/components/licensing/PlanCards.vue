<script setup lang="ts">
import { computed } from 'vue';
import type { BillingInterval, LicensePlan, LicensingCatalogDto } from '@/types/api';
import { formatPrice, licensePlanLabels } from '@/utils/format';
import { freeMonths, planCopy, priceOf, sharedFeatures } from './plans';

/**
 * Tarjetas de precios de los dos planes con el selector mensual/anual. La acción de cada tarjeta (contratar, cambiar,
 * registrarse…) la pone quien la usa en el slot «action».
 */
const props = defineProps<{ catalog: LicensingCatalogDto; current?: LicensePlan | null }>();
const interval = defineModel<BillingInterval>('interval', { default: 'Monthly' });

const plans = computed(() => props.catalog.plans);
const maxFree = computed(() => Math.max(0, ...plans.value.map(freeMonths)));
const currency = computed(() => props.catalog.currency);

const monthlyEquivalent = (cents: number) => formatPrice(Math.round(cents / 12), currency.value);
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

    <div class="mx-auto mt-6 grid max-w-4xl gap-5 md:grid-cols-2">
      <article
        v-for="plan in plans"
        :key="plan.plan"
        class="relative flex flex-col rounded-2xl border bg-surface p-6 shadow-card"
        :class="plan.plan === 'Premium' ? 'border-brand-500/60 ring-1 ring-brand-500/30' : 'border-line'"
      >
        <span
          v-if="plan.plan === 'Premium'"
          class="absolute -top-3 left-6 rounded-full bg-action px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm"
        >Cuerpo técnico completo</span>

        <div class="flex items-start justify-between gap-3">
          <div>
            <h3 class="text-xl font-bold text-slate-900">{{ licensePlanLabels[plan.plan] }}</h3>
            <p class="mt-0.5 text-sm text-slate-500">{{ planCopy[plan.plan].tagline }}</p>
          </div>
          <span v-if="current === plan.plan" class="rounded-full border border-emerald-300/40 bg-emerald-100 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">Tu plan</span>
        </div>

        <div class="mt-5">
          <p class="flex items-baseline gap-1.5">
            <span class="font-figures text-4xl font-extrabold tracking-tight text-slate-900">{{ formatPrice(priceOf(plan, interval), currency) }}</span>
            <span class="text-sm font-medium text-slate-500">{{ interval === 'Yearly' ? '/año' : '/mes' }}</span>
          </p>
          <p class="mt-1 h-5 text-xs text-slate-500">
            <template v-if="interval === 'Yearly'">
              Equivale a {{ monthlyEquivalent(plan.yearlyPriceCents) }}/mes<template v-if="freeMonths(plan) > 0"> · <strong class="text-emerald-700">{{ freeMonths(plan) }} meses gratis</strong></template>
            </template>
            <template v-else>O {{ formatPrice(plan.yearlyPriceCents, currency) }}/año pagando de una vez</template>
          </p>
        </div>

        <div class="mt-5 flex items-center gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
          <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 text-brand-500">
            <Icon icon="user-group" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <p class="font-semibold text-slate-900">{{ plan.maxStaff === 1 ? '1 técnico' : `Hasta ${plan.maxStaff} técnicos` }}</p>
            <p class="truncate text-xs text-slate-500">{{ planCopy[plan.plan].staffNote }}</p>
          </div>
        </div>

        <ul class="mt-5 flex-1 space-y-2 text-sm text-slate-700">
          <li v-for="feature in [...sharedFeatures, ...planCopy[plan.plan].extras]" :key="feature" class="flex items-start gap-2.5">
            <Icon icon="check" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            <span>{{ feature }}</span>
          </li>
        </ul>

        <div class="mt-6">
          <slot name="action" :plan="plan.plan" :price-cents="priceOf(plan, interval)" />
        </div>
      </article>
    </div>
  </div>
</template>
