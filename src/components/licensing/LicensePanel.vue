<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { LicensingStatusDto, TeamLicenseDto } from '@/types/api';
import { formatDate, formatMoney, licenseStatusLabels, licenseStatusTone } from '@/utils/format';

/**
 * Licencias del club: una por equipo vinculado, a tanto al mes. Empiezan con el periodo de prueba y se pagan por
 * meses en la pasarela (de momento simulada). Sin licencia vigente, el equipo entero pierde el acceso a sus datos
 * privados hasta que el club la renueve.
 */
const router = useRouter();
const status = shallowRef<LicensingStatusDto | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    status.value = await api.licensing.status();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const teams = computed(() => status.value?.teams ?? []);
const expired = computed(() => teams.value.filter((t) => t.status === 'Expired'));
const monthly = computed(() => (status.value ? formatMoney(status.value.monthlyPriceCents, status.value.currency) : ''));

const paying = ref<TeamLicenseDto | null>(null);
const months = ref(1);
const busy = ref(false);
const monthOptions = [1, 3, 6, 12].map((m) => ({ value: m, label: m === 1 ? '1 mes' : `${m} meses` }));
const total = computed(() => (status.value ? formatMoney(status.value.monthlyPriceCents * months.value, status.value.currency) : ''));

async function checkout() {
  if (!paying.value) return;
  busy.value = true;
  error.value = null;
  try {
    const session = await api.licensing.beginCheckout(paying.value.teamId, months.value);
    paying.value = null;
    await router.push(session.url);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold text-slate-900">Licencias de tus equipos</h2>
        <p class="mt-1 text-xs text-slate-500">
          Una licencia por equipo, <strong class="text-slate-700">{{ monthly }} al mes</strong>. Cada equipo prueba la aplicación gratis
          <template v-if="status">{{ status.trialDays }} días</template> desde que lo vinculas; después, sin licencia, el club, su cuerpo técnico y
          sus jugadores dejan de ver los datos privados del equipo (no se borran) hasta que la renueves.
        </p>
      </div>
      <Badge v-if="status?.provider === 'mock'" tone="amber">Pagos simulados</Badge>
    </div>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>
    <Alert v-else-if="expired.length" kind="warning" class="mt-3">
      <strong>{{ expired.length === 1 ? 'Un equipo' : `${expired.length} equipos` }}</strong> sin licencia vigente: su plantilla, técnicos y jugadores no pueden entrar hasta que la renueves.
    </Alert>

    <Spinner v-if="loading" class="my-6" />
    <p v-else-if="teams.length === 0" class="mt-3 text-sm text-slate-500">Vincula un equipo para empezar su periodo de prueba.</p>
    <ul v-else class="mt-4 divide-y divide-line">
      <li v-for="team in teams" :key="team.teamId" class="flex flex-wrap items-center gap-3 py-3">
        <div class="min-w-0 flex-1">
          <p class="font-medium text-slate-900">{{ team.teamName }}</p>
          <p class="text-xs text-slate-500">
            <template v-if="team.status === 'Trial'">Periodo de prueba hasta el {{ formatDate(team.trialEndsOn) }} ({{ team.daysLeft }} {{ team.daysLeft === 1 ? 'día' : 'días' }}).</template>
            <template v-else-if="team.status === 'Active'">Licencia pagada hasta el {{ formatDate(team.validUntil) }} ({{ team.daysLeft }} {{ team.daysLeft === 1 ? 'día' : 'días' }}).</template>
            <template v-else>Caducó el {{ formatDate(team.validUntil) }}. Los datos del equipo se conservan.</template>
          </p>
        </div>
        <Badge :tone="licenseStatusTone[team.status]">{{ licenseStatusLabels[team.status] }}</Badge>
        <button type="button" class="btn-primary px-3 py-1.5 text-xs" @click="paying = team; months = 1">
          <Icon icon="credit-card" class="mr-1.5 h-3.5 w-3.5" />{{ team.status === 'Expired' ? 'Renovar' : 'Pagar meses' }}
        </button>
      </li>
    </ul>

    <Modal :open="paying !== null" :title="paying ? `Licencia de ${paying.teamName}` : ''" @close="paying = null">
      <p class="text-sm text-slate-600">
        Elige cuántos meses pagas. Se suman a partir del último día con acceso<template v-if="paying && paying.status !== 'Expired'"> ({{ formatDate(paying.validUntil) }})</template>, así que pagar durante la prueba no te quita días.
      </p>
      <div class="mt-4 w-48">
        <label class="label" for="license-months">Meses</label>
        <SearchSelect id="license-months" :model-value="months" :options="monthOptions" @update:model-value="months = Number($event ?? 1)" />
      </div>
      <p class="mt-4 text-sm text-slate-700">Total: <strong class="font-figures text-xl text-slate-900">{{ total }}</strong></p>
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-ghost" @click="paying = null">Cancelar</button>
        <button type="button" class="btn-primary" v-busy="busy" :disabled="busy" @click="checkout">Ir al pago</button>
      </div>
    </Modal>
  </section>
</template>
