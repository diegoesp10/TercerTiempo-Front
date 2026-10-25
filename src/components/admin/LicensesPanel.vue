<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { AdminLicenseState, LicensesOverviewDto } from '@/types/api';
import { billingIntervalLabels, formatDate, formatKickoff, formatMoney, licensePlanLabels } from '@/utils/format';

/**
 * Licencias y cobros de todos los clubes para el administrador: quién está en prueba, quién paga, quién debe y cuánto,
 * lo cobrado y el ingreso mensual recurrente. Sin licencia vigente el equipo no tiene acceso a sus datos privados.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const data = ref<LicensesOverviewDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const filter = ref<'all' | 'owes' | 'trial' | 'paying' | 'inactive'>('all');

const stateLabels: Record<AdminLicenseState, string> = {
  trial: 'En prueba',
  'trial-plan': 'En prueba con plan',
  active: 'Al día',
  grace: 'Cobro pendiente',
  unpaid: 'Impagada',
  cancelled: 'Cancelada',
  'trial-ended': 'Prueba acabada',
};
const stateTone: Record<AdminLicenseState, 'green' | 'amber' | 'red' | 'blue' | 'slate'> = {
  trial: 'blue',
  'trial-plan': 'blue',
  active: 'green',
  grace: 'amber',
  unpaid: 'red',
  cancelled: 'slate',
  'trial-ended': 'slate',
};
const paymentStatusLabels = { Pending: 'Pendiente', Paid: 'Cobrado', Cancelled: 'Cancelado' } as const;
const paymentTone = { Pending: 'amber', Paid: 'green', Cancelled: 'slate' } as const;

const filtered = computed(() => {
  const rows = data.value?.licenses ?? [];
  switch (filter.value) {
    case 'owes': return rows.filter((r) => r.owedCents > 0);
    case 'trial': return rows.filter((r) => r.state === 'trial' || r.state === 'trial-plan');
    case 'paying': return rows.filter((r) => r.state === 'active');
    case 'inactive': return rows.filter((r) => !r.hasAccess);
    default: return rows;
  }
});

const money = (cents: number) => formatMoney(cents, data.value?.currency ?? 'EUR');

async function load() {
  loading.value = true;
  try {
    data.value = await adminApi.licenses(props.token);
    error.value = null;
  } catch (e) {
    if ((e as { status?: number }).status === 401) emit('unauthorized');
    else error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
defineExpose({ load });
</script>

<template>
  <section class="space-y-6">
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <Spinner v-if="loading && !data" />

    <template v-if="data">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div class="card">
          <p class="text-xs text-slate-500">Ingreso mensual recurrente</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ money(data.summary.monthlyRecurringCents) }}</p>
          <p class="text-xs text-slate-500">Suscripciones al día; las anuales, divididas entre 12.</p>
        </div>
        <div class="card">
          <p class="text-xs text-slate-500">Cobrado en total</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ money(data.summary.collectedCents) }}</p>
          <p class="text-xs text-slate-500">Pagos confirmados por la pasarela.</p>
        </div>
        <div class="card">
          <p class="text-xs text-slate-500">Pendiente de cobro</p>
          <p class="mt-1 text-2xl font-bold" :class="data.summary.owedCents > 0 ? 'text-red-600' : 'text-slate-900'">{{ money(data.summary.owedCents) }}</p>
          <p class="text-xs text-slate-500">{{ data.summary.grace }} en días de cortesía · {{ data.summary.unpaid }} impagadas</p>
        </div>
        <div class="card">
          <p class="text-xs text-slate-500">Equipos</p>
          <p class="mt-1 text-2xl font-bold text-slate-900">{{ data.summary.total }}</p>
          <p class="text-xs text-slate-500">
            {{ data.summary.paying }} al día · {{ data.summary.trial }} en prueba · {{ data.summary.inactive }} sin acceso
            <template v-if="data.summary.pendingCheckouts"> · {{ data.summary.pendingCheckouts }} pagos sin completar</template>
          </p>
        </div>
      </div>

      <section class="card">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="font-semibold text-slate-900">Licencias por equipo</h2>
            <p class="text-xs text-slate-500">Sin licencia vigente, nadie del club (club, cuerpo técnico ni jugadores) accede a los datos del equipo; el club solo puede pagar.</p>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <button
              v-for="option in ([['all', 'Todas'], ['owes', 'Deben'], ['trial', 'En prueba'], ['paying', 'Al día'], ['inactive', 'Sin acceso']] as const)"
              :key="option[0]"
              type="button"
              class="rounded-full border px-3 py-1 text-xs"
              :class="filter === option[0] ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600'"
              @click="filter = option[0]"
            >{{ option[1] }}</button>
            <button type="button" class="btn-ghost text-xs" v-busy="loading" :disabled="loading" @click="load"><Icon icon="rotate-right" class="h-3 w-3" /></button>
          </div>
        </div>

        <p v-if="!filtered.length" class="text-sm text-slate-500">No hay licencias en este filtro.</p>
        <div v-else class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left">Club · equipo</th>
                <th class="px-3 py-2 text-left">Estado</th>
                <th class="px-3 py-2 text-left">Plan</th>
                <th class="px-3 py-2 text-left">Pagada hasta</th>
                <th class="px-3 py-2 text-left">Próximo cobro</th>
                <th class="px-3 py-2 text-right">Debe</th>
                <th class="px-3 py-2 text-right">Cobrado</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in filtered" :key="row.id">
                <td class="px-3 py-2">
                  <span class="font-medium text-slate-800">{{ row.clubName }}</span>
                  <span class="block text-xs text-slate-500">{{ row.teamNames.length === 1 ? row.teamNames[0] : `${row.teamNames.length} equipos: ${row.teamNames.join(', ')}` }}</span>
                </td>
                <td class="px-3 py-2">
                  <Badge :tone="stateTone[row.state]">{{ stateLabels[row.state] }}</Badge>
                  <span v-if="!row.hasAccess" class="block text-xs text-red-600">Sin acceso</span>
                </td>
                <td class="px-3 py-2 text-xs whitespace-nowrap text-slate-700">
                  <template v-if="row.plan">{{ licensePlanLabels[row.plan] }} · {{ row.interval ? billingIntervalLabels[row.interval] : '—' }}</template>
                  <template v-else>Prueba (Premium)</template>
                  <span v-if="row.nextPlan || row.nextInterval" class="block text-slate-500">
                    Pasa a {{ licensePlanLabels[row.nextPlan ?? row.effectivePlan] }} · {{ billingIntervalLabels[row.nextInterval ?? row.interval ?? 'Monthly'] }}
                  </span>
                  <span v-if="row.plan && !row.autoRenew" class="block text-slate-500">Sin renovación</span>
                </td>
                <td class="px-3 py-2 text-xs whitespace-nowrap text-slate-600">
                  {{ row.paidUntil ? formatDate(row.paidUntil) : '—' }}
                  <span class="block text-slate-500">Prueba hasta {{ formatDate(row.trialEndsOn) }}</span>
                </td>
                <td class="px-3 py-2 text-xs whitespace-nowrap text-slate-600">
                  <template v-if="row.renewsOn && row.nextChargeCents !== null">{{ formatDate(row.renewsOn) }} · {{ money(row.nextChargeCents) }}</template>
                  <template v-else>—</template>
                </td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  <template v-if="row.owedCents > 0">
                    <span class="font-semibold text-red-600">{{ money(row.owedCents) }}</span>
                    <span v-if="row.owedSince" class="block text-xs text-slate-500">desde {{ formatDate(row.owedSince) }}</span>
                  </template>
                  <span v-else class="text-slate-400">—</span>
                </td>
                <td class="px-3 py-2 text-right text-xs whitespace-nowrap text-slate-600">
                  {{ money(row.paidCents) }}
                  <span v-if="row.lastPaymentAt" class="block text-slate-500">{{ formatKickoff(row.lastPaymentAt) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="card">
        <h2 class="mb-3 font-semibold text-slate-900">Últimos pagos</h2>
        <p v-if="!data.payments.length" class="text-sm text-slate-500">Todavía no hay pagos.</p>
        <div v-else class="overflow-x-auto rounded-lg border border-slate-200">
          <table class="min-w-full text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="px-3 py-2 text-left">Fecha</th>
                <th class="px-3 py-2 text-left">Club · equipo</th>
                <th class="px-3 py-2 text-left">Concepto</th>
                <th class="px-3 py-2 text-left">Estado</th>
                <th class="px-3 py-2 text-right">Importe</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="payment in data.payments" :key="payment.id">
                <td class="px-3 py-2 text-xs whitespace-nowrap text-slate-600">{{ formatKickoff(payment.paidAt ?? payment.createdAt) }}</td>
                <td class="px-3 py-2">
                  <span class="text-slate-800">{{ payment.clubName }}</span>
                </td>
                <td class="px-3 py-2 text-xs text-slate-700">
                  {{ payment.kind === 'Renewal' ? 'Renovación' : 'Alta' }} · {{ licensePlanLabels[payment.plan] }} {{ billingIntervalLabels[payment.interval].toLowerCase() }}
                  <span class="block text-slate-500">{{ payment.provider === 'mock' ? 'Pago simulado' : payment.provider }}</span>
                </td>
                <td class="px-3 py-2"><Badge :tone="paymentTone[payment.status]">{{ paymentStatusLabels[payment.status] }}</Badge></td>
                <td class="px-3 py-2 text-right whitespace-nowrap">
                  {{ money(payment.amountCents) }}
                  <span v-if="payment.amountCents === 0 && payment.periodPriceCents > 0" class="block text-xs text-slate-500">en prueba; luego {{ money(payment.periodPriceCents) }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
