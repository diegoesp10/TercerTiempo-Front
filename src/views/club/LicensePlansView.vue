<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import Spinner from '@/components/ui/Spinner.vue';
import PlanCards from '@/components/licensing/PlanCards.vue';
import { comparisonRows, firstChargeOn, isSubscribed, priceOf } from '@/components/licensing/plans';
import { confirmDialog } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import type { BillingInterval, LicensePlan, LicensingCatalogDto, TeamLicenseDto } from '@/types/api';
import {
  billingIntervalLabels,
  billingIntervalSuffix,
  formatDate,
  formatPrice,
  licensePlanLabels,
  licenseStatusLabels,
  licenseStatusTone,
  staffCountLabel,
} from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';

/**
 * Planes y precios. Para cualquiera explica qué incluye cada plan, cuánto cuesta y cómo funcionan la prueba y la
 * renovación; para un club, además, contrata o cambia la licencia del equipo elegido (?equipo=).
 */
const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

const catalog = shallowRef<LicensingCatalogDto | null>(null);
const teams = ref<TeamLicenseDto[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const interval = ref<BillingInterval>('Monthly');

async function load() {
  loading.value = true;
  error.value = null;
  try {
    if (auth.isClub) {
      const status = await api.licensing.status();
      catalog.value = status.catalog;
      teams.value = status.teams;
    } else {
      catalog.value = await api.licensing.plans();
    }
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch(() => auth.isClub, load, { immediate: true });

const teamId = computed({
  get: () => (typeof route.query.equipo === 'string' && teams.value.some((t) => t.teamId === route.query.equipo) ? route.query.equipo : teams.value[0]?.teamId ?? null),
  set: (value) => void router.replace({ query: { ...route.query, equipo: value ?? undefined } }),
});
const team = computed(() => teams.value.find((t) => t.teamId === teamId.value) ?? null);
const subscribed = computed(() => (team.value ? isSubscribed(team.value) : false));

// Al cambiar de equipo, el selector arranca en la facturación que ya tiene.
watch(team, (t) => { if (t?.interval) interval.value = t.nextInterval ?? t.interval; }, { immediate: true });

const plans = computed(() => catalog.value?.plans ?? []);
const planOf = (plan: LicensePlan) => plans.value.find((p) => p.plan === plan)!;
const currency = computed(() => catalog.value?.currency ?? 'EUR');
const price = (plan: LicensePlan, billing: BillingInterval = interval.value) => formatPrice(priceOf(planOf(plan), billing), currency.value);

/** El plan elegido no admite el cuerpo técnico que ya tiene el equipo. */
const tooSmall = (plan: LicensePlan) => !!team.value && team.value.staffCount > planOf(plan).maxStaff;

/** Plan y facturación con los que seguirá el equipo en la próxima renovación. */
const upcoming = computed(() => (team.value?.plan ? { plan: team.value.nextPlan ?? team.value.plan, interval: team.value.nextInterval ?? team.value.interval! } : null));
const isUpcoming = (plan: LicensePlan) => upcoming.value?.plan === plan && upcoming.value.interval === interval.value;

// --- Contratar

const choosing = ref<LicensePlan | null>(null);
const busy = ref(false);
const chargeToday = computed(() => !!team.value && team.value.status === 'Expired');

async function checkout() {
  if (!team.value || !choosing.value) return;
  busy.value = true;
  error.value = null;
  try {
    const session = await api.licensing.beginCheckout(team.value.teamId, choosing.value, interval.value);
    choosing.value = null;
    if (/^https?:\/\//.test(session.url)) window.location.assign(session.url);
    else await router.push(session.url);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

// --- Cambiar el plan de una suscripción en marcha

async function change(plan: LicensePlan) {
  if (!team.value) return;
  const inTrial = team.value.status === 'Trial' || !team.value.paidUntil;
  const ok = await confirmDialog({
    title: `Pasar a ${licensePlanLabels[plan]} ${billingIntervalLabels[interval.value].toLowerCase()}`,
    message: inTrial
      ? `${team.value.teamName} pasará a ${licensePlanLabels[plan]} ya mismo. El primer cobro será de ${price(plan)} el ${formatDate(team.value.renewsOn!)}.`
      : `El cambio se aplica en la próxima renovación, el ${formatDate(team.value.renewsOn!)}: ese día se cobrarán ${price(plan)}. Hasta entonces sigues con tu plan actual.`,
    confirmLabel: 'Cambiar plan',
  });
  if (!ok) return;
  busy.value = true;
  error.value = null;
  try {
    const updated = await api.licensing.changeRenewal(team.value.teamId, plan, interval.value);
    teams.value = teams.value.map((t) => (t.teamId === updated.teamId ? updated : t));
    notice.value = inTrial ? `Listo: ${updated.teamName} ya está en ${licensePlanLabels[plan]}.` : `Listo: ${updated.teamName} pasará a ${licensePlanLabels[plan]} el ${formatDate(updated.renewsOn!)}.`;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

const comparison = computed(() => (plans.value.length === 2 ? comparisonRows(planOf('Basic'), planOf('Premium')) : []));

const faqs = computed(() => {
  const c = catalog.value;
  if (!c) return [];
  return [
    {
      q: '¿La licencia es por club o por equipo?',
      a: 'Por equipo. Cada equipo que vinculas al club tiene su propia licencia, con su plan y su facturación: puedes tener el primer equipo en Premium y el juvenil en Básica.',
    },
    {
      q: '¿Qué incluye la prueba?',
      a: `${c.trialDays} días con todo lo de Premium desde que vinculas el equipo, sin tarjeta. Si eliges plan durante la prueba no pierdes ni un día: el primer cobro llega cuando acaba.`,
    },
    {
      q: '¿Qué cuenta como técnico?',
      a: 'Cada persona del cuerpo técnico que nombras para la temporada (entrenador, segundo, delegado, fisio, analista…), tanto si ya ha canjeado su código como si está pendiente. Los jugadores no cuentan: la plantilla es ilimitada en los dos planes.',
    },
    {
      q: '¿Puedo cambiar de plan o de facturación?',
      a: 'Sí, cuando quieras. Durante la prueba el cambio es inmediato; con un periodo ya pagado se aplica en la siguiente renovación, sin cobros a mitad de periodo. Para pasar a Básica el equipo no puede tener más técnicos de los que admite.',
    },
    {
      q: '¿Hay permanencia? ¿Cómo cancelo?',
      a: 'No hay permanencia. Cancela la renovación desde tu club y mantienes el acceso hasta el final de lo pagado; después no se cobra nada más.',
    },
    {
      q: '¿Qué pasa si caduca la licencia?',
      a: 'No se borra nada. El cuerpo técnico y los jugadores dejan de ver los datos privados del equipo (actas internas, estadísticas, lesiones, vídeos) hasta que el club la renueve; los datos públicos de la federación siguen visibles.',
    },
    {
      q: '¿Qué pasa si falla un cobro?',
      a: `Se reintenta automáticamente y el equipo mantiene el acceso ${c.renewalGraceDays} días mientras tanto. Si no se consigue cobrar, la suscripción se cancela y la licencia caduca.`,
    },
    {
      q: '¿Cómo se paga?',
      a: 'Con tarjeta, en la pasarela segura de Stripe: Tercer Tiempo no ve ni guarda los datos de tu tarjeta. Los precios incluyen el IVA y recibes la factura de cada cobro.',
    },
  ];
});
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <!-- Cabecera -->
    <header class="text-center">
      <p class="eyebrow">Planes y precios</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Una licencia por equipo, sin letra pequeña</h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm text-slate-500 sm:text-base">
        Los dos planes incluyen la plantilla entera y todas las herramientas. Elige según el cuerpo técnico que trabaja con el equipo,
        y paga mes a mes o una vez al año.
      </p>
      <div v-if="catalog" class="mt-4 flex flex-wrap justify-center gap-2 text-xs font-medium text-slate-600">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1"><Icon icon="star" class="h-3 w-3 text-amber-400" />{{ catalog.trialDays }} días de prueba con Premium</span>
        <span class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1"><Icon icon="credit-card" class="h-3 w-3 text-brand-500" />Sin tarjeta para probar</span>
        <span class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1"><Icon icon="rotate-right" class="h-3 w-3 text-brand-500" />Sin permanencia</span>
        <span class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1"><Icon icon="shield-halved" class="h-3 w-3 text-brand-500" />IVA incluido</span>
      </div>
    </header>

    <Spinner v-if="loading && !catalog" class="my-12" />
    <Alert v-else-if="error && !catalog" kind="error" class="mt-8">{{ error }}</Alert>

    <template v-else-if="catalog">
      <Alert v-if="catalog.provider === 'mock'" kind="warning" class="mx-auto mt-6 max-w-4xl">
        <strong>Pagos simulados.</strong> La pasarela aún no está conectada: puedes recorrer todo el proceso, pero no se cobra nada.
      </Alert>

      <!-- Equipo del club cuya licencia se gestiona -->
      <section v-if="auth.isClub && team" class="card mx-auto mt-6 max-w-4xl">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="eyebrow">Licencia de</p>
            <div v-if="teams.length > 1" class="mt-1 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Equipo">
              <button
                v-for="t in teams"
                :key="t.teamId"
                type="button"
                role="radio"
                :aria-checked="t.teamId === teamId"
                class="rounded-lg border px-3 py-1.5 text-sm font-semibold transition"
                :class="t.teamId === teamId ? 'border-brand-500 bg-brand-500/10 text-slate-900' : 'border-line text-slate-600 hover:border-brand-400'"
                @click="teamId = t.teamId"
              ><TeamName :name="t.teamName" :team-id="t.teamId" /></button>
            </div>
            <h2 v-else class="text-lg font-bold text-slate-900"><TeamName :name="team.teamName" :team-id="team.teamId" size="sm" /></h2>
          </div>
          <Badge :tone="licenseStatusTone[team.status]">{{ licenseStatusLabels[team.status] }}</Badge>
        </div>

        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div class="rounded-lg bg-surface-2 px-3 py-2">
            <dt class="text-xs text-slate-500">Plan</dt>
            <dd class="font-semibold text-slate-900">
              <template v-if="team.plan">{{ licensePlanLabels[team.plan] }} · {{ billingIntervalLabels[team.interval!].toLowerCase() }}</template>
              <template v-else>Premium (prueba)</template>
            </dd>
          </div>
          <div class="rounded-lg bg-surface-2 px-3 py-2">
            <dt class="text-xs text-slate-500">
              <template v-if="team.status === 'Expired'">Caducó el</template>
              <template v-else-if="team.renewsOn">Próximo cobro</template>
              <template v-else-if="team.status === 'Trial'">Prueba hasta el</template>
              <template v-else>Acceso hasta el</template>
            </dt>
            <dd class="font-semibold text-slate-900">
              <template v-if="team.renewsOn && team.status !== 'Expired'">{{ formatPrice(team.renewalPriceCents ?? 0, currency) }} el {{ formatDate(team.renewsOn) }}</template>
              <template v-else>{{ formatDate(team.validUntil) }}</template>
            </dd>
          </div>
          <div class="rounded-lg bg-surface-2 px-3 py-2">
            <dt class="text-xs text-slate-500">Cuerpo técnico</dt>
            <dd class="font-semibold text-slate-900">{{ team.staffCount }} de {{ staffCountLabel(team.staffLimit) }}</dd>
          </div>
        </dl>
        <p v-if="team.nextPlan || team.nextInterval" class="mt-3 text-xs text-slate-500">
          <Icon icon="calendar-check" class="mr-1 h-3 w-3" />En la próxima renovación pasa a <strong class="text-slate-700">{{ licensePlanLabels[upcoming!.plan] }} {{ billingIntervalLabels[upcoming!.interval].toLowerCase() }}</strong>.
        </p>
      </section>

      <Alert v-if="notice" kind="success" class="mx-auto mt-4 max-w-4xl">{{ notice }}</Alert>
      <Alert v-if="error" kind="error" class="mx-auto mt-4 max-w-4xl">{{ error }}</Alert>

      <!-- Planes -->
      <PlanCards v-model:interval="interval" :catalog="catalog" :current="team?.plan ?? null" class="mt-8">
        <template #action="{ plan }">
          <!-- Sin cuenta: empezar la prueba -->
          <template v-if="!auth.isAuthenticated">
            <RouterLink to="/registro" class="w-full" :class="plan === 'Premium' ? 'btn-primary' : 'btn-secondary'">Empieza gratis {{ catalog.trialDays }} días</RouterLink>
          </template>
          <!-- Técnico o jugador: la contrata el club -->
          <p v-else-if="!auth.isClub" class="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-slate-500">La licencia la contrata el club de tu equipo.</p>
          <p v-else-if="!team" class="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-slate-500">Vincula un equipo a tu club para contratar su licencia.</p>
          <!-- Club: plan demasiado pequeño para su cuerpo técnico -->
          <div v-else-if="tooSmall(plan)">
            <button type="button" class="btn-secondary w-full" disabled>{{ licensePlanLabels[plan] }} no admite tu cuerpo técnico</button>
            <p class="mt-2 text-center text-xs text-slate-500">{{ team.teamName }} tiene {{ staffCountLabel(team.staffCount) }}; revoca nombramientos para elegirla.</p>
          </div>
          <!-- Club con suscripción en marcha: cambiar para la renovación -->
          <template v-else-if="subscribed">
            <button v-if="isUpcoming(plan)" type="button" class="btn-secondary w-full" disabled>
              <Icon icon="check" class="h-3.5 w-3.5" />{{ team.plan === plan && team.interval === interval ? 'Tu plan actual' : 'Elegido para la renovación' }}
            </button>
            <button v-else type="button" class="w-full" :class="plan === 'Premium' ? 'btn-primary' : 'btn-secondary'" v-busy="busy" :disabled="busy" @click="change(plan)">
              Cambiar a {{ licensePlanLabels[plan] }} {{ billingIntervalLabels[interval].toLowerCase() }}
            </button>
          </template>
          <!-- Club sin suscripción: contratar -->
          <button v-else type="button" class="w-full" :class="plan === 'Premium' ? 'btn-primary' : 'btn-secondary'" :disabled="busy" @click="choosing = plan">
            {{ team.status === 'Expired' ? 'Renovar con' : 'Elegir' }} {{ licensePlanLabels[plan] }}
          </button>
        </template>
      </PlanCards>

      <!-- Cómo funciona -->
      <section class="mt-14">
        <h2 class="text-center text-2xl font-bold text-slate-900">Cómo funciona</h2>
        <ol class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li class="card">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 font-figures text-sm font-bold text-brand-500">1</span>
            <h3 class="mt-3 font-semibold text-slate-900">Pruébalo gratis</h3>
            <p class="mt-1 text-sm text-slate-500">Al vincular un equipo empiezan {{ catalog.trialDays }} días con todo Premium. Sin tarjeta.</p>
          </li>
          <li class="card">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 font-figures text-sm font-bold text-brand-500">2</span>
            <h3 class="mt-3 font-semibold text-slate-900">Elige tu plan</h3>
            <p class="mt-1 text-sm text-slate-500">Básica o Premium, mensual o anual. Si lo haces durante la prueba, no se cobra nada hasta que acaba.</p>
          </li>
          <li class="card">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 font-figures text-sm font-bold text-brand-500">3</span>
            <h3 class="mt-3 font-semibold text-slate-900">Se renueva sola</h3>
            <p class="mt-1 text-sm text-slate-500">Cada mes o cada año, con aviso del próximo cobro en tu club. Cambia de plan cuando quieras.</p>
          </li>
          <li class="card">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 font-figures text-sm font-bold text-brand-500">4</span>
            <h3 class="mt-3 font-semibold text-slate-900">Cancela sin permanencia</h3>
            <p class="mt-1 text-sm text-slate-500">Mantienes el acceso hasta el final de lo pagado. Tus datos no se borran nunca.</p>
          </li>
        </ol>
      </section>

      <!-- Comparativa -->
      <section v-if="comparison.length" class="mt-14">
        <h2 class="text-center text-2xl font-bold text-slate-900">Comparativa</h2>
        <div class="card mx-auto mt-6 max-w-4xl overflow-x-auto p-0">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-line text-left">
                <th class="px-3 py-3 sm:px-5 font-medium text-slate-500" scope="col"></th>
                <th class="w-24 px-3 py-3 text-center font-bold text-slate-900 sm:w-44 sm:px-5" scope="col">Básica</th>
                <th class="w-24 px-3 py-3 text-center font-bold text-slate-900 sm:w-44 sm:px-5" scope="col">Premium</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-line">
              <tr>
                <th class="px-3 py-3 sm:px-5 text-left font-medium text-slate-700" scope="row">Pago mensual</th>
                <td class="px-3 py-3 sm:px-5 text-center font-figures font-semibold text-slate-900">{{ price('Basic', 'Monthly') }}{{ billingIntervalSuffix.Monthly }}</td>
                <td class="px-3 py-3 sm:px-5 text-center font-figures font-semibold text-slate-900">{{ price('Premium', 'Monthly') }}{{ billingIntervalSuffix.Monthly }}</td>
              </tr>
              <tr>
                <th class="px-3 py-3 sm:px-5 text-left font-medium text-slate-700" scope="row">Pago anual</th>
                <td class="px-3 py-3 sm:px-5 text-center font-figures font-semibold text-slate-900">{{ price('Basic', 'Yearly') }}{{ billingIntervalSuffix.Yearly }}</td>
                <td class="px-3 py-3 sm:px-5 text-center font-figures font-semibold text-slate-900">{{ price('Premium', 'Yearly') }}{{ billingIntervalSuffix.Yearly }}</td>
              </tr>
              <tr v-for="[label, basic, premium] in comparison" :key="label">
                <th class="px-3 py-3 sm:px-5 text-left font-medium text-slate-700" scope="row">{{ label }}</th>
                <td v-for="(value, i) in [basic, premium]" :key="i" class="px-3 py-3 sm:px-5 text-center text-slate-900">
                  <Icon v-if="value === true" icon="check" class="h-4 w-4 text-emerald-600" aria-label="Incluido" />
                  <span v-else-if="value === false" class="text-slate-400" aria-label="No incluido">—</span>
                  <span v-else class="font-semibold">{{ value }}</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- Preguntas -->
      <section class="mx-auto mt-14 max-w-3xl">
        <h2 class="text-center text-2xl font-bold text-slate-900">Preguntas frecuentes</h2>
        <div class="mt-6 divide-y divide-line rounded-xl border border-line bg-surface">
          <details v-for="item in faqs" :key="item.q" class="group px-5 py-4">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900">
              {{ item.q }}
              <Icon icon="chevron-down" class="h-3.5 w-3.5 shrink-0 text-slate-400 transition group-open:rotate-180" />
            </summary>
            <p class="mt-2 text-sm leading-relaxed text-slate-600">{{ item.a }}</p>
          </details>
        </div>
      </section>
    </template>

    <!-- Resumen antes de ir a la pasarela -->
    <Modal :open="choosing !== null && team !== null" size="md" :title="choosing ? `Licencia ${licensePlanLabels[choosing]}` : ''" @close="choosing = null">
      <template v-if="choosing && team">
        <p class="text-sm text-slate-500">Para <strong class="text-slate-800"><TeamName :name="team.teamName" :team-id="team.teamId" /></strong> · {{ planOf(choosing).maxStaff === 1 ? '1 técnico' : `hasta ${planOf(choosing).maxStaff} técnicos` }} y la plantilla entera.</p>

        <div class="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Facturación">
          <button
            v-for="option in (['Monthly', 'Yearly'] as const)"
            :key="option"
            type="button"
            role="radio"
            :aria-checked="interval === option"
            class="rounded-xl border p-3 text-left transition"
            :class="interval === option ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/30' : 'border-line hover:border-brand-400'"
            @click="interval = option"
          >
            <span class="block text-xs font-semibold uppercase tracking-wide text-slate-500">{{ billingIntervalLabels[option] }}</span>
            <span class="mt-1 block font-figures text-xl font-extrabold text-slate-900">{{ price(choosing, option) }}<span class="text-sm font-medium text-slate-500">{{ billingIntervalSuffix[option] }}</span></span>
          </button>
        </div>

        <dl class="mt-5 divide-y divide-line rounded-xl border border-line bg-surface-2 text-sm">
          <div class="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt class="text-slate-500">Hoy pagas</dt>
            <dd class="font-figures text-lg font-extrabold text-slate-900">{{ chargeToday ? price(choosing) : formatPrice(0, currency) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt class="text-slate-500">{{ chargeToday ? 'Siguiente cobro' : 'Primer cobro' }}</dt>
            <dd class="text-right text-slate-800">
              <template v-if="chargeToday">{{ price(choosing) }} {{ interval === 'Yearly' ? 'dentro de un año' : 'dentro de un mes' }}</template>
              <template v-else>{{ price(choosing) }} el {{ formatDate(firstChargeOn(team)) }}</template>
            </dd>
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt class="text-slate-500">Renovación</dt>
            <dd class="text-right text-slate-800">Automática, {{ interval === 'Yearly' ? 'cada año' : 'cada mes' }}</dd>
          </div>
        </dl>

        <p class="mt-4 flex gap-2 text-xs leading-relaxed text-slate-500">
          <Icon icon="circle-info" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
          <span>
            <template v-if="!chargeToday">No pierdes días: lo que te queda de {{ team.status === 'Trial' ? 'prueba' : 'licencia' }} se mantiene y el cobro empieza al acabar. </template>
            Sin permanencia: cancela la renovación cuando quieras y conservas el acceso hasta el final de lo pagado. IVA incluido.
          </span>
        </p>
      </template>
      <template #footer>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <button type="button" class="btn-ghost" @click="choosing = null">Cancelar</button>
          <button type="button" class="btn-primary" v-busy="busy" :disabled="busy" @click="checkout">
            <Icon icon="lock" class="h-3.5 w-3.5" />Continuar al pago
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>
