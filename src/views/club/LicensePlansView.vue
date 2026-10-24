<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
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
import type { BillingInterval, ClubLicenseDto, LicensePlan, LicensingCatalogDto } from '@/types/api';
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
 * renovación; para un club, además, contrata o cambia su licencia: una por club, que cubre el primer equipo y sus
 * filiales, con el cupo de técnicos del plan en cada equipo.
 */
const auth = useAuthStore();
const router = useRouter();

const catalog = shallowRef<LicensingCatalogDto | null>(null);
const license = ref<ClubLicenseDto | null>(null);
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
      license.value = status.licenses[0] ?? null;
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

const subscribed = computed(() => (license.value ? isSubscribed(license.value) : false));

// El selector arranca en la facturación que ya tiene la licencia.
watch(license, (l) => { if (l?.interval) interval.value = l.nextInterval ?? l.interval; }, { immediate: true });

const plans = computed(() => catalog.value?.plans ?? []);
const planOf = (plan: LicensePlan) => plans.value.find((p) => p.plan === plan)!;
const currency = computed(() => catalog.value?.currency ?? 'EUR');
const price = (plan: LicensePlan, billing: BillingInterval = interval.value) => formatPrice(priceOf(planOf(plan), billing), currency.value);

/** Primer equipo del club cuyo cuerpo técnico no cabe en el plan (cada equipo tiene su propio cupo). */
const overflowing = (plan: LicensePlan) => license.value?.teams.find((t) => t.staffCount > planOf(plan).maxStaff) ?? null;

/** Plan y facturación con los que seguirá el club en la próxima renovación. */
const upcoming = computed(() => (license.value?.plan ? { plan: license.value.nextPlan ?? license.value.plan, interval: license.value.nextInterval ?? license.value.interval! } : null));
const isUpcoming = (plan: LicensePlan) => upcoming.value?.plan === plan && upcoming.value.interval === interval.value;

// --- Contratar

const choosing = ref<LicensePlan | null>(null);
const busy = ref(false);
const chargeToday = computed(() => !!license.value && license.value.status === 'Expired');

async function checkout() {
  if (!license.value || !choosing.value) return;
  busy.value = true;
  error.value = null;
  try {
    const session = await api.licensing.beginCheckout(choosing.value, interval.value);
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
  if (!license.value) return;
  const inTrial = license.value.status === 'Trial' || !license.value.paidUntil;
  const ok = await confirmDialog({
    title: `Pasar a ${licensePlanLabels[plan]} ${billingIntervalLabels[interval.value].toLowerCase()}`,
    message: inTrial
      ? `${license.value.clubName} pasará a ${licensePlanLabels[plan]} ya mismo, con todos sus equipos. El primer cobro será de ${price(plan)} el ${formatDate(license.value.renewsOn!)}.`
      : `El cambio se aplica en la próxima renovación, el ${formatDate(license.value.renewsOn!)}: ese día se cobrarán ${price(plan)}. Hasta entonces sigues con tu plan actual.`,
    confirmLabel: 'Cambiar plan',
  });
  if (!ok) return;
  busy.value = true;
  error.value = null;
  try {
    const updated = await api.licensing.changeRenewal(plan, interval.value);
    license.value = updated;
    notice.value = inTrial ? `Listo: ${updated.clubName} ya está en ${licensePlanLabels[plan]}.` : `Listo: ${updated.clubName} pasará a ${licensePlanLabels[plan]} el ${formatDate(updated.renewsOn!)}.`;
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
      a: 'Por club. Una sola licencia, al precio del plan, cubre el primer equipo y todos sus filiales (el B, el juvenil…). Cada equipo tiene su propio cupo de técnicos según el plan. Solo se pueden añadir filiales del propio club, no equipos de otros clubes.',
    },
    {
      q: '¿Qué incluye la prueba?',
      a: `${c.trialDays} días con todo lo de Premium desde que das de alta el club, sin tarjeta. Si eliges plan durante la prueba no pierdes ni un día: el primer cobro llega cuando acaba.`,
    },
    {
      q: '¿Qué cuenta como técnico?',
      a: 'Cada persona del cuerpo técnico que nombras para la temporada en un equipo (entrenador, segundo, delegado, fisio, analista…), tanto si ya ha canjeado su código como si está pendiente. El cupo es por equipo: el primer equipo y cada filial tienen el suyo. Los jugadores no cuentan: la plantilla es ilimitada en los dos planes.',
    },
    {
      q: '¿Puedo cambiar de plan o de facturación?',
      a: 'Sí, cuando quieras. Durante la prueba el cambio es inmediato; con un periodo ya pagado se aplica en la siguiente renovación, sin cobros a mitad de periodo. Para pasar a Básica ningún equipo del club puede tener más técnicos de los que admite.',
    },
    {
      q: '¿Hay permanencia? ¿Cómo cancelo?',
      a: 'No hay permanencia. Cancela la renovación desde tu club y mantienes el acceso hasta el final de lo pagado; después no se cobra nada más.',
    },
    {
      q: '¿Qué pasa si caduca la licencia?',
      a: 'No se borra nada. El cuerpo técnico y los jugadores de todos los equipos del club dejan de ver sus datos privados (actas internas, estadísticas, lesiones, vídeos) hasta que el club la renueve; los datos públicos de la federación siguen visibles.',
    },
    {
      q: '¿Qué pasa si falla un cobro?',
      a: `Se reintenta automáticamente y el club mantiene el acceso ${c.renewalGraceDays} días mientras tanto. Si no se consigue cobrar, la suscripción se cancela y la licencia caduca.`,
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
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Una licencia por club, sin letra pequeña</h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm text-slate-500 sm:text-base">
        Un solo precio para el primer equipo y todos sus filiales, con la plantilla entera y todas las herramientas. Elige según el
        cuerpo técnico que trabaja con cada equipo, y paga mes a mes o una vez al año.
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

      <!-- Licencia del club: primer equipo y filiales -->
      <section v-if="auth.isClub && license" class="card mx-auto mt-6 max-w-4xl">
        <div class="flex flex-wrap items-center gap-3">
          <div class="min-w-0 flex-1">
            <p class="eyebrow">Licencia del club</p>
            <h2 class="truncate text-lg font-bold text-slate-900">{{ license.clubName }}</h2>
          </div>
          <Badge :tone="licenseStatusTone[license.status]">{{ licenseStatusLabels[license.status] }}</Badge>
        </div>

        <dl class="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <div class="rounded-lg bg-surface-2 px-3 py-2">
            <dt class="text-xs text-slate-500">Plan</dt>
            <dd class="font-semibold text-slate-900">
              <template v-if="license.plan">{{ licensePlanLabels[license.plan] }} · {{ billingIntervalLabels[license.interval!].toLowerCase() }}</template>
              <template v-else>Premium (prueba)</template>
            </dd>
          </div>
          <div class="rounded-lg bg-surface-2 px-3 py-2">
            <dt class="text-xs text-slate-500">
              <template v-if="license.status === 'Expired'">Caducó el</template>
              <template v-else-if="license.renewsOn">Próximo cobro</template>
              <template v-else-if="license.status === 'Trial'">Prueba hasta el</template>
              <template v-else>Acceso hasta el</template>
            </dt>
            <dd class="font-semibold text-slate-900">
              <template v-if="license.renewsOn && license.status !== 'Expired'">{{ formatPrice(license.renewalPriceCents ?? 0, currency) }} el {{ formatDate(license.renewsOn) }}</template>
              <template v-else>{{ formatDate(license.validUntil) }}</template>
            </dd>
          </div>
          <div class="rounded-lg bg-surface-2 px-3 py-2">
            <dt class="text-xs text-slate-500">Técnicos por equipo</dt>
            <dd class="font-semibold text-slate-900">{{ staffCountLabel(license.staffLimit) }}</dd>
          </div>
        </dl>

        <div class="mt-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipos que cubre · cuerpo técnico de cada uno</p>
          <ul class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <li v-for="t in license.teams" :key="t.teamId" class="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
              <TeamName :name="t.teamName" :crest-url="t.teamCrestUrl" :team-id="t.teamId" size="sm" class="min-w-0" />
              <span class="shrink-0 text-xs font-semibold" :class="t.staffCount >= license.staffLimit ? 'text-amber-500' : 'text-slate-600'">
                {{ t.staffCount }} de {{ license.staffLimit }}
              </span>
            </li>
          </ul>
        </div>
        <p v-if="license.nextPlan || license.nextInterval" class="mt-3 text-xs text-slate-500">
          <Icon icon="calendar-check" class="mr-1 h-3 w-3" />En la próxima renovación pasa a <strong class="text-slate-700">{{ licensePlanLabels[upcoming!.plan] }} {{ billingIntervalLabels[upcoming!.interval].toLowerCase() }}</strong>.
        </p>
      </section>

      <Alert v-if="notice" kind="success" class="mx-auto mt-4 max-w-4xl">{{ notice }}</Alert>
      <Alert v-if="error" kind="error" class="mx-auto mt-4 max-w-4xl">{{ error }}</Alert>

      <!-- Planes -->
      <PlanCards v-model:interval="interval" :catalog="catalog" :current="license?.plan ?? null" class="mt-8">
        <template #action="{ plan }">
          <!-- Sin cuenta: empezar la prueba -->
          <template v-if="!auth.isAuthenticated">
            <RouterLink to="/registro" class="w-full" :class="plan === 'Premium' ? 'btn-primary' : 'btn-secondary'">Empieza gratis {{ catalog.trialDays }} días</RouterLink>
          </template>
          <!-- Técnico o jugador: la contrata el club -->
          <p v-else-if="!auth.isClub" class="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-slate-500">La licencia la contrata el club de tu equipo.</p>
          <p v-else-if="!license" class="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-slate-500">Tu club aún no tiene equipos: no hay licencia que contratar.</p>
          <!-- Club: plan demasiado pequeño para el cuerpo técnico de algún equipo -->
          <div v-else-if="overflowing(plan)">
            <button type="button" class="btn-secondary w-full" disabled>{{ licensePlanLabels[plan] }} no admite tu cuerpo técnico</button>
            <p class="mt-2 text-center text-xs text-slate-500">{{ overflowing(plan)!.teamName }} tiene {{ staffCountLabel(overflowing(plan)!.staffCount) }}; revoca nombramientos para elegirla.</p>
          </div>
          <!-- Club con suscripción en marcha: cambiar para la renovación -->
          <template v-else-if="subscribed">
            <button v-if="isUpcoming(plan)" type="button" class="btn-secondary w-full" disabled>
              <Icon icon="check" class="h-3.5 w-3.5" />{{ license.plan === plan && license.interval === interval ? 'Tu plan actual' : 'Elegido para la renovación' }}
            </button>
            <button v-else type="button" class="w-full" :class="plan === 'Premium' ? 'btn-primary' : 'btn-secondary'" v-busy="busy" :disabled="busy" @click="change(plan)">
              Cambiar a {{ licensePlanLabels[plan] }} {{ billingIntervalLabels[interval].toLowerCase() }}
            </button>
          </template>
          <!-- Club sin suscripción: contratar -->
          <button v-else type="button" class="w-full" :class="plan === 'Premium' ? 'btn-primary' : 'btn-secondary'" :disabled="busy" @click="choosing = plan">
            {{ license.status === 'Expired' ? 'Renovar con' : 'Elegir' }} {{ licensePlanLabels[plan] }}
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
            <p class="mt-1 text-sm text-slate-500">Al dar de alta el club empiezan {{ catalog.trialDays }} días con todo Premium para todos sus equipos. Sin tarjeta.</p>
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
    <Modal :open="choosing !== null && license !== null" size="md" :title="choosing ? `Licencia ${licensePlanLabels[choosing]}` : ''" @close="choosing = null">
      <template v-if="choosing && license">
        <p class="text-sm text-slate-500">
          Para <strong class="text-slate-800">{{ license.clubName }}</strong> y {{ license.teams.length === 1 ? 'su equipo' : `sus ${license.teams.length} equipos` }}
          · {{ planOf(choosing).maxStaff === 1 ? '1 técnico' : `hasta ${planOf(choosing).maxStaff} técnicos` }} en cada uno y la plantilla entera.
        </p>

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
              <template v-else>{{ price(choosing) }} el {{ formatDate(firstChargeOn(license)) }}</template>
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
            <template v-if="!chargeToday">No pierdes días: lo que te queda de {{ license.status === 'Trial' ? 'prueba' : 'licencia' }} se mantiene y el cobro empieza al acabar. </template>
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
