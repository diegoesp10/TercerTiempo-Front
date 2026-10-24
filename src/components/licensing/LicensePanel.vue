<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { LicensingCatalogDto, TeamLicenseDto } from '@/types/api';
import {
  billingIntervalLabels,
  formatDate,
  formatPrice,
  licensePlanLabels,
  licenseStatusLabels,
  licenseStatusTone,
} from '@/utils/format';
import { isSubscribed } from './plans';

/**
 * Licencias del club: una por equipo vinculado, con su plan (Básica o Premium), su facturación (mensual o anual) y
 * su renovación. Empiezan con la prueba (con todo Premium); sin licencia vigente, el equipo entero pierde el acceso a
 * sus datos privados hasta que el club la renueve. Los planes se eligen en /licencias.
 */
const catalog = shallowRef<LicensingCatalogDto | null>(null);
const teams = ref<TeamLicenseDto[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const busyTeam = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const status = await api.licensing.status();
    catalog.value = status.catalog;
    teams.value = status.teams;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const expired = computed(() => teams.value.filter((t) => t.status === 'Expired'));
const currency = computed(() => catalog.value?.currency ?? 'EUR');

const plansLink = (team: TeamLicenseDto) => ({ name: 'licenses', query: { equipo: team.teamId } });

/** Parte consumida del periodo actual (prueba o lo pagado), para la barra. */
function progress(team: TeamLicenseDto) {
  if (team.status === 'Expired') return 100;
  const total = team.status === 'Trial' ? catalog.value?.trialDays ?? 30 : team.interval === 'Yearly' ? 365 : 30;
  return Math.min(100, Math.max(4, Math.round((1 - team.daysLeft / total) * 100)));
}

const days = (n: number) => (n === 1 ? '1 día' : `${n} días`);

function replace(updated: TeamLicenseDto) {
  teams.value = teams.value.map((t) => (t.teamId === updated.teamId ? updated : t));
}

async function cancelRenewal(team: TeamLicenseDto) {
  const ok = await confirmDialog({
    title: 'Cancelar la renovación',
    message: `${team.teamName} no se renovará. Mantiene el acceso hasta el ${formatDate(team.validUntil)}; después, el cuerpo técnico y los jugadores dejarán de ver sus datos privados (no se borran) hasta que vuelvas a contratar.`,
    confirmLabel: 'Cancelar renovación',
    cancelLabel: 'Mantener',
    danger: true,
  });
  if (!ok) return;
  await act(team, () => api.licensing.cancelRenewal(team.teamId));
}

async function resumeRenewal(team: TeamLicenseDto) {
  await act(team, () => api.licensing.resumeRenewal(team.teamId));
}

async function act(team: TeamLicenseDto, call: () => Promise<TeamLicenseDto>) {
  busyTeam.value = team.teamId;
  error.value = null;
  try {
    replace(await call());
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busyTeam.value = null;
  }
}
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold text-slate-900">Licencias de tus equipos</h2>
        <p class="mt-1 max-w-2xl text-xs text-slate-500">
          Una licencia por equipo: <strong class="text-slate-700">Básica</strong> para el entrenador y su plantilla o <strong class="text-slate-700">Premium</strong> para un cuerpo técnico completo,
          pagando cada mes o una vez al año. Sin licencia vigente, los datos privados del equipo se conservan pero nadie del equipo puede verlos.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Badge v-if="catalog?.provider === 'mock'" tone="amber">Pagos simulados</Badge>
        <RouterLink :to="{ name: 'licenses' }" class="btn-secondary px-3 py-1.5 text-xs">Planes y precios</RouterLink>
      </div>
    </div>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>
    <Alert v-else-if="expired.length" kind="warning" class="mt-3">
      <strong>{{ expired.length === 1 ? 'Un equipo' : `${expired.length} equipos` }}</strong> sin licencia vigente: su plantilla, técnicos y jugadores no pueden entrar hasta que la renueves.
    </Alert>

    <Spinner v-if="loading" class="my-6" />
    <p v-else-if="teams.length === 0" class="mt-3 text-sm text-slate-500">Vincula un equipo para empezar su prueba gratuita de {{ catalog?.trialDays ?? 30 }} días con todo Premium.</p>

    <div v-else class="mt-4 grid gap-4" :class="teams.length > 1 ? 'lg:grid-cols-2' : ''">
      <article v-for="team in teams" :key="team.teamId" class="flex flex-col rounded-xl border border-line bg-surface-2 p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="truncate font-semibold text-slate-900">{{ team.teamName }}</p>
            <p class="text-xs text-slate-500">
              <template v-if="team.plan">Plan {{ licensePlanLabels[team.plan] }} · {{ billingIntervalLabels[team.interval!].toLowerCase() }}</template>
              <template v-else>Prueba con todo Premium · sin plan elegido</template>
            </p>
          </div>
          <Badge :tone="licenseStatusTone[team.status]">{{ licenseStatusLabels[team.status] }}</Badge>
        </div>

        <!-- Tiempo que queda -->
        <div class="mt-4">
          <div class="flex items-baseline justify-between gap-2 text-xs">
            <span class="text-slate-600">
              <template v-if="team.status === 'Expired'">Caducó el {{ formatDate(team.validUntil) }}. Los datos se conservan.</template>
              <template v-else-if="team.status === 'Trial'">Prueba gratis hasta el {{ formatDate(team.trialEndsOn) }}</template>
              <template v-else>Pagado hasta el {{ formatDate(team.validUntil) }}</template>
            </span>
            <span v-if="team.status !== 'Expired'" class="shrink-0 font-semibold text-slate-800">{{ days(team.daysLeft) }}</span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
            <div
              class="h-full rounded-full"
              :class="team.status === 'Expired' ? 'bg-red-600' : team.daysLeft <= 7 && !team.renewsOn ? 'bg-amber-400' : 'bg-brand-500'"
              :style="{ width: `${progress(team)}%` }"
            />
          </div>
        </div>

        <ul class="mt-4 space-y-1.5 text-xs text-slate-600">
          <li class="flex items-center gap-2">
            <Icon icon="user-group" class="h-3 w-3 text-slate-400" />
            <span>
              Cuerpo técnico: <strong class="text-slate-800">{{ team.staffCount }} de {{ team.staffLimit }}</strong>
              <template v-if="team.staffCount >= team.staffLimit"> · completo<template v-if="team.effectivePlan === 'Basic'">, pasa a Premium para nombrar más</template></template>
            </span>
          </li>
          <li v-if="team.renewsOn && team.status !== 'Expired'" class="flex items-center gap-2">
            <Icon icon="credit-card" class="h-3 w-3 text-slate-400" />
            <span>Próximo cobro: <strong class="text-slate-800">{{ formatPrice(team.renewalPriceCents ?? 0, currency) }}</strong> el {{ formatDate(team.renewsOn) }}</span>
          </li>
          <li v-else-if="team.plan && team.status !== 'Expired'" class="flex items-center gap-2">
            <Icon icon="circle-info" class="h-3 w-3 text-amber-400" />
            <span>No se renueva: el acceso acaba el {{ formatDate(team.validUntil) }}.</span>
          </li>
          <li v-else-if="team.status === 'Trial'" class="flex items-center gap-2">
            <Icon icon="circle-info" class="h-3 w-3 text-slate-400" />
            <span>Elige un plan antes del {{ formatDate(team.trialEndsOn) }}: no se cobra nada hasta que acabe la prueba.</span>
          </li>
          <li v-if="team.nextPlan || team.nextInterval" class="flex items-center gap-2">
            <Icon icon="calendar-check" class="h-3 w-3 text-slate-400" />
            <span>En la renovación pasa a {{ licensePlanLabels[team.nextPlan ?? team.plan!] }} {{ billingIntervalLabels[team.nextInterval ?? team.interval!].toLowerCase() }}.</span>
          </li>
        </ul>

        <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <RouterLink v-if="team.status === 'Expired'" :to="plansLink(team)" class="btn-primary px-3 py-1.5 text-xs">
            <Icon icon="credit-card" class="h-3.5 w-3.5" />Renovar licencia
          </RouterLink>
          <RouterLink v-else-if="!team.plan" :to="plansLink(team)" class="btn-primary px-3 py-1.5 text-xs">
            <Icon icon="star" class="h-3.5 w-3.5" />Elegir plan
          </RouterLink>
          <RouterLink v-else :to="plansLink(team)" class="btn-secondary px-3 py-1.5 text-xs">Cambiar plan</RouterLink>

          <button
            v-if="isSubscribed(team)"
            type="button"
            class="btn-ghost px-3 py-1.5 text-xs"
            v-busy="busyTeam === team.teamId"
            :disabled="busyTeam !== null"
            @click="cancelRenewal(team)"
          >Cancelar renovación</button>
          <button
            v-else-if="team.plan && !team.autoRenew && team.status !== 'Expired'"
            type="button"
            class="btn-ghost px-3 py-1.5 text-xs"
            v-busy="busyTeam === team.teamId"
            :disabled="busyTeam !== null"
            @click="resumeRenewal(team)"
          ><Icon icon="rotate-right" class="h-3 w-3" />Reactivar renovación</button>
        </div>
      </article>
    </div>
  </section>
</template>
