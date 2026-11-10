<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { ClubLicenseDto, LicensingCatalogDto } from '@/types/api';
import {
  billingIntervalLabels,
  formatDate,
  formatPrice,
  licenseStatusLabels,
  licenseStatusTone,
  staffCountLabel,
} from '@/utils/format';
import { isSubscribed, subscriptionLabel } from './plans';
import { confirmResumeRenewal } from './resumeRenewal';
import { useAlertsStore } from '@/stores/alerts';
import TeamName from '@/components/teams/TeamName.vue';

/**
 * Licencia del club: la licencia de club, que cubre el primer equipo y sus filiales con todas las funciones para el
 * club, más sus licencias de técnico (una bolsa para todos sus equipos), con su facturación y su renovación. Empieza con
 * la prueba (con unos técnicos incluidos); sin licencia vigente, ningún equipo del club puede ver sus datos privados
 * hasta que el club la renueve. Se contrata y se amplía en /licencias.
 */
const catalog = shallowRef<LicensingCatalogDto | null>(null);
const license = ref<ClubLicenseDto | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const busy = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const status = await api.licensing.status();
    catalog.value = status.catalog;
    license.value = status.licenses[0] ?? null;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const currency = computed(() => catalog.value?.currency ?? 'EUR');
const plansLink = { name: 'licenses' };

/** Parte consumida del periodo actual (prueba o lo pagado), para la barra. */
const progress = computed(() => {
  const l = license.value;
  if (!l || l.status === 'Expired') return 100;
  const total = l.status === 'Trial' ? catalog.value?.trialDays ?? 30 : l.interval === 'Yearly' ? 365 : 30;
  return Math.min(100, Math.max(4, Math.round((1 - l.daysLeft / total) * 100)));
});

const days = (n: number) => (n === 1 ? '1 día' : `${n} días`);

async function cancelRenewal() {
  if (!license.value) return;
  const ok = await confirmDialog({
    title: 'Cancelar la renovación',
    message: `La licencia de ${license.value.clubName} no se renovará. Mantiene el acceso hasta el ${formatDate(license.value.validUntil)}; después, el cuerpo técnico y los jugadores de todos sus equipos dejarán de ver sus datos privados (no se borran) hasta que vuelvas a contratar.`,
    confirmLabel: 'Cancelar renovación',
    cancelLabel: 'Mantener',
    danger: true,
  });
  if (!ok) return;
  await act(() => api.licensing.cancelRenewal());
}

async function resumeRenewal() {
  if (!license.value || !catalog.value || !(await confirmResumeRenewal(license.value, catalog.value))) return;
  await act(() => api.licensing.resumeRenewal());
}

// Cancelar o reactivar crea o resuelve los avisos de caducidad de la campanita.
const alerts = useAlertsStore();

async function act(call: () => Promise<ClubLicenseDto>) {
  busy.value = true;
  error.value = null;
  try {
    license.value = await call();
    void alerts.load();
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
        <h2 class="font-semibold text-slate-900">Licencia del club</h2>
        <p class="mt-1 max-w-2xl text-xs text-slate-500">
          La <strong class="text-slate-700">licencia de club</strong> cubre el primer equipo y todos sus filiales, y el club puede hacerlo todo él solo. Las
          <strong class="text-slate-700">licencias de técnico</strong> dan cuenta propia al cuerpo técnico de cualquiera de tus equipos y se añaden cuando las necesites.
          Sin licencia vigente, los datos privados se conservan pero nadie de los equipos puede verlos.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Badge v-if="catalog?.provider === 'mock'" tone="amber">Pagos simulados</Badge>
        <RouterLink :to="plansLink" class="btn-secondary px-3 py-1.5 text-xs">Precios</RouterLink>
      </div>
    </div>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>
    <Alert v-else-if="license?.status === 'Expired'" kind="warning" class="mt-3">
      <strong>Licencia caducada:</strong> la plantilla, los técnicos y los jugadores de tus equipos no pueden entrar hasta que la renueves.
    </Alert>

    <Spinner v-if="loading" class="my-6" />
    <article v-else-if="license" class="mt-4 rounded-xl border border-line bg-surface-2 p-4">
      <div class="flex flex-wrap items-start justify-between gap-2">
        <div class="min-w-0">
          <p class="truncate font-semibold text-slate-900">{{ license.clubName }}</p>
          <p class="text-xs text-slate-500">
            <template v-if="license.contracted">{{ subscriptionLabel(license.staffSeats) }} · {{ billingIntervalLabels[license.interval!].toLowerCase() }}</template>
            <template v-else>Prueba con {{ staffCountLabel(license.staffLimit) }} · sin contratar</template>
          </p>
        </div>
        <Badge :tone="licenseStatusTone[license.status]">{{ licenseStatusLabels[license.status] }}</Badge>
      </div>

      <!-- Tiempo que queda -->
      <div class="mt-4">
        <div class="flex items-baseline justify-between gap-2 text-xs">
          <span class="text-slate-600">
            <template v-if="license.status === 'Expired'">Caducó el {{ formatDate(license.validUntil) }}. Los datos se conservan.</template>
            <template v-else-if="license.status === 'Trial'">Prueba gratis hasta el {{ formatDate(license.trialEndsOn) }}</template>
            <template v-else>Pagado hasta el {{ formatDate(license.validUntil) }}</template>
          </span>
          <span v-if="license.status !== 'Expired'" class="shrink-0 font-semibold text-slate-800">{{ days(license.daysLeft) }}</span>
        </div>
        <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
          <div
            class="h-full rounded-full"
            :class="license.status === 'Expired' ? 'bg-red-600' : license.daysLeft <= 7 && !license.renewsOn ? 'bg-amber-400' : 'bg-brand-500'"
            :style="{ width: `${progress}%` }"
          />
        </div>
      </div>

      <!-- Equipos cubiertos y técnicos de la bolsa del club -->
      <div class="mt-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipos que cubre · técnicos</p>
          <p class="text-xs" :class="license.staffInUse >= license.staffLimit ? 'font-semibold text-amber-500' : 'text-slate-600'">
            <Icon icon="user-group" class="mr-1 h-3 w-3 text-slate-400" />{{ license.staffInUse }} de {{ staffCountLabel(license.staffLimit) }} nombrados
          </p>
        </div>
        <ul class="mt-2 grid grid-cols-1 gap-2" :class="license.teams.length > 1 ? 'lg:grid-cols-2' : ''">
          <li v-for="team in license.teams" :key="team.teamId" class="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-xs">
            <TeamName :name="team.teamName" :crest-url="team.teamCrestUrl" :team-id="team.teamId" size="sm" class="min-w-0" />
            <span class="shrink-0 text-slate-600">{{ staffCountLabel(team.staffCount) }}</span>
          </li>
        </ul>
        <p v-if="license.status !== 'Expired' && license.staffInUse >= license.staffLimit" class="mt-2 text-xs text-slate-500">
          <template v-if="isSubscribed(license)">Para nombrar a otro técnico, <RouterLink :to="plansLink" class="font-medium text-accent-400 hover:underline">añade licencias de técnico</RouterLink>.</template>
          <template v-else-if="license.contracted">Reactiva la renovación para poder añadir más técnicos.</template>
          <template v-else>Contrata la licencia de club para poder añadir más técnicos.</template>
        </p>
      </div>

      <ul class="mt-4 space-y-1.5 text-xs text-slate-600">
        <li v-if="license.renewsOn && license.status !== 'Expired'" class="flex items-center gap-2">
          <Icon icon="credit-card" class="h-3 w-3 text-slate-400" />
          <span>Próximo cobro: <strong class="text-slate-800">{{ formatPrice(license.renewalPriceCents ?? 0, currency) }}</strong> el {{ formatDate(license.renewsOn) }}</span>
        </li>
        <li v-else-if="license.contracted && license.status !== 'Expired'" class="flex items-center gap-2">
          <Icon icon="circle-info" class="h-3 w-3 text-amber-400" />
          <span>No se renueva: el acceso acaba el {{ formatDate(license.validUntil) }}.</span>
        </li>
        <li v-else-if="license.status === 'Trial'" class="flex items-center gap-2">
          <Icon icon="circle-info" class="h-3 w-3 text-slate-400" />
          <span>Contrata la licencia antes del {{ formatDate(license.trialEndsOn) }}: no se cobra nada hasta que acabe la prueba.</span>
        </li>
        <li v-if="license.nextStaffSeats !== null || license.nextInterval" class="flex items-center gap-2">
          <Icon icon="calendar-check" class="h-3 w-3 text-slate-400" />
          <span>En la renovación pasa a {{ subscriptionLabel(license.nextStaffSeats ?? license.staffSeats) }} {{ billingIntervalLabels[license.nextInterval ?? license.interval!].toLowerCase() }}.</span>
        </li>
      </ul>

      <div class="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <RouterLink v-if="license.status === 'Expired'" :to="plansLink" class="btn-primary px-3 py-1.5 text-xs">
          <Icon icon="credit-card" class="h-3.5 w-3.5" />Renovar licencia
        </RouterLink>
        <RouterLink v-else-if="!license.contracted" :to="plansLink" class="btn-primary px-3 py-1.5 text-xs">
          <Icon icon="star" class="h-3.5 w-3.5" />Contratar licencia
        </RouterLink>
        <RouterLink v-else :to="plansLink" class="btn-secondary px-3 py-1.5 text-xs"><Icon icon="user-group" class="h-3.5 w-3.5" />Técnicos y facturación</RouterLink>

        <button
          v-if="isSubscribed(license)"
          type="button"
          class="btn-ghost px-3 py-1.5 text-xs"
          v-busy="busy"
          :disabled="busy"
          @click="cancelRenewal"
        >Cancelar renovación</button>
        <button
          v-else-if="license.contracted && !license.autoRenew && license.status !== 'Expired'"
          type="button"
          class="btn-ghost px-3 py-1.5 text-xs"
          v-busy="busy"
          :disabled="busy"
          @click="resumeRenewal"
        ><Icon icon="rotate-right" class="h-3 w-3" />Reactivar renovación</button>
      </div>
    </article>
  </section>
</template>
