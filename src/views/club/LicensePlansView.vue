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
import StaffSeatsStepper from '@/components/licensing/StaffSeatsStepper.vue';
import { firstChargeOn, isSubscribed, priceOf, staffSeatsProration, subscriptionLabel, subscriptionPrice } from '@/components/licensing/plans';
import { confirmResumeRenewal } from '@/components/licensing/resumeRenewal';
import { useAlertsStore } from '@/stores/alerts';
import { confirmDialog } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import type { BillingInterval, ClubLicenseDto, LicensingCatalogDto } from '@/types/api';
import { billingIntervalLabels, billingIntervalSuffix, formatDate, formatPrice, licenseStatusLabels, licenseStatusTone, staffCountLabel } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';

/**
 * Precios. Para cualquiera explica la licencia de club y las licencias de técnico, cuánto cuestan y cómo funcionan la
 * prueba y la renovación; para un club, además, contrata la licencia y compra o quita técnicos una vez contratada.
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
// Contratada pero con la renovación cancelada y aún vigente: se reactiva en vez de contratar otra vez.
const resumable = computed(() => !!license.value && license.value.contracted && !license.value.autoRenew && license.value.status !== 'Expired');
const alerts = useAlertsStore();

async function resumeRenewal() {
  if (!license.value || !catalog.value || !(await confirmResumeRenewal(license.value, catalog.value))) return;
  busy.value = true;
  error.value = null;
  try {
    license.value = await api.licensing.resumeRenewal();
    notice.value = `Listo: la licencia de ${license.value.clubName} vuelve a renovarse sola.`;
    void alerts.load();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

// El selector arranca en la facturación que ya tiene la licencia.
watch(license, (l) => { if (l?.interval) interval.value = l.nextInterval ?? l.interval; }, { immediate: true });

const currency = computed(() => catalog.value?.currency ?? 'EUR');
const money = (cents: number) => formatPrice(cents, currency.value);
const total = (staffSeats: number, billing: BillingInterval = interval.value) => (catalog.value ? subscriptionPrice(catalog.value, billing, staffSeats) : 0);
const seatPrice = (billing: BillingInterval = interval.value) => (catalog.value ? priceOf(catalog.value.staffSeat, billing) : 0);
const inTrial = computed(() => !!license.value && (license.value.status === 'Trial' || !license.value.paidUntil));

// --- Contratar la licencia de club (con los técnicos que se quieran ya)

const checkingOut = ref(false);
const checkoutSeats = ref(0);
const busy = ref(false);
const chargeToday = computed(() => !!license.value && license.value.status === 'Expired');

function openCheckout() {
  checkoutSeats.value = license.value?.staffInUse ?? 0;
  checkingOut.value = true;
}

async function checkout() {
  if (!license.value) return;
  busy.value = true;
  error.value = null;
  try {
    const session = await api.licensing.beginCheckout(interval.value, checkoutSeats.value);
    checkingOut.value = false;
    if (/^https?:\/\//.test(session.url)) window.location.assign(session.url);
    else await router.push(session.url);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

// --- Técnicos de una licencia ya contratada

const seats = ref(0);
watch(license, (l) => { if (l) seats.value = l.nextStaffSeats ?? l.staffSeats; }, { immediate: true });
const seatsTarget = computed(() => (license.value ? license.value.nextStaffSeats ?? license.value.staffSeats : 0));
// Añadir sube de los que hay ya; quitar baja de los de la renovación; entre medias, solo cambia una reducción ya pedida.
const seatsAction = computed(() =>
  license.value && seats.value > license.value.staffSeats ? 'Añadir' : seats.value < seatsTarget.value ? 'Quitar' : 'Cambiar',
);

async function saveSeats() {
  const l = license.value;
  if (!l || seats.value === seatsTarget.value) return;
  const added = seats.value - l.staffSeats;
  const renewal = l.renewsOn ? formatDate(l.renewsOn) : '';
  const next = `${money(total(seats.value, l.nextInterval ?? l.interval!))}${billingIntervalSuffix[l.nextInterval ?? l.interval!]}`;
  let message: string;
  if (added > 0 && !inTrial.value) {
    const now = staffSeatsProration(l, added, seatPrice(l.interval!));
    message = `${staffCountLabel(added)} más desde ya. Hoy se cobran unos ${money(now)}, la parte de lo que queda hasta el ${renewal}; desde la renovación pagarás ${next}.`;
  } else if (added > 0) {
    message = `${staffCountLabel(added)} más desde ya, sin cobro hasta que acabe la prueba: el primer cobro, el ${renewal}, será de ${next}.`;
  } else if (inTrial.value) {
    message = `Te quedas con ${staffCountLabel(seats.value)} desde ya. El primer cobro, el ${renewal}, será de ${next}.`;
  } else {
    message = `Mantienes ${staffCountLabel(l.staffSeats)} hasta la renovación del ${renewal}; desde entonces serán ${staffCountLabel(seats.value)} y pagarás ${next}.`;
  }
  const action = seatsAction.value;
  const title = action === 'Añadir' ? 'Añadir técnicos' : action === 'Quitar' ? 'Quitar técnicos' : 'Cambiar los técnicos de la renovación';
  if (!(await confirmDialog({ title, message, confirmLabel: action }))) return;

  busy.value = true;
  error.value = null;
  try {
    license.value = await api.licensing.changeStaffSeats(seats.value);
    notice.value = `Listo: ${license.value.clubName} tiene ${staffCountLabel(license.value.staffSeats)}${license.value.nextStaffSeats !== null ? ` hasta la renovación y ${license.value.nextStaffSeats} después` : ''}.`;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

// --- Facturación de una licencia ya contratada

const upcomingInterval = computed(() => license.value?.nextInterval ?? license.value?.interval ?? null);

async function changeInterval() {
  const l = license.value;
  if (!l || !upcomingInterval.value || interval.value === upcomingInterval.value) return;
  const ok = await confirmDialog({
    title: `Pasar a facturación ${billingIntervalLabels[interval.value].toLowerCase()}`,
    message: inTrial.value
      ? `El cambio es inmediato: el primer cobro, el ${formatDate(l.renewsOn!)}, será de ${money(total(l.nextStaffSeats ?? l.staffSeats))}.`
      : `Se aplica en la próxima renovación, el ${formatDate(l.renewsOn!)}: ese día se cobrarán ${money(total(l.nextStaffSeats ?? l.staffSeats))}.`,
    confirmLabel: 'Cambiar facturación',
  });
  if (!ok) return;
  busy.value = true;
  error.value = null;
  try {
    license.value = await api.licensing.changeRenewal(interval.value);
    notice.value = `Listo: la facturación pasa a ${billingIntervalLabels[interval.value].toLowerCase()}.`;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

// --- Calculadora

const calcSeats = ref(2);

const faqs = computed(() => {
  const c = catalog.value;
  if (!c) return [];
  return [
    {
      q: '¿Qué incluye la licencia de club?',
      a: 'Todo, para el club: el primer equipo y todos sus filiales (el B, el juvenil…), con actas internas, datos del equipo, lesiones, vídeos, previas y comparador. El club trabaja directamente como su cuerpo técnico, sin necesidad de técnicos con cuenta.',
    },
    {
      q: '¿Para qué sirven las licencias de técnico?',
      a: `Cada una es una cuenta para alguien del cuerpo técnico (entrenador, segundo, delegado, fisio, analista…) en cualquiera de los equipos del club: es una bolsa que repartes como quieras. Se compran una vez contratada la licencia de club, hasta ${c.maxStaffSeats} por club. Los jugadores no cuentan: la plantilla es ilimitada.`,
    },
    {
      q: '¿Qué incluye la prueba?',
      a: `${c.trialDays} días con la licencia de club y ${staffCountLabel(c.trialStaffSeats)} desde que das de alta el club, sin tarjeta. Si contratas durante la prueba no pierdes ni un día: el primer cobro llega cuando acaba.`,
    },
    {
      q: '¿Puedo añadir o quitar técnicos después?',
      a: 'Sí, cuando quieras. Los que añades valen ya y se cobra al momento la parte que queda hasta la renovación (durante la prueba, nada). Los que quitas siguen hasta la renovación y desde entonces ya no se pagan; nunca por debajo de los técnicos que tienes nombrados.',
    },
    {
      q: '¿Puedo cambiar de facturación?',
      a: 'Sí, de mensual a anual o al revés. Durante la prueba es inmediato; con un periodo ya pagado se aplica en la siguiente renovación.',
    },
    {
      q: '¿Hay permanencia? ¿Cómo cancelo?',
      a: 'No hay permanencia. Cancela la renovación desde tu club y mantienes el acceso hasta el final de lo pagado; después no se cobra nada más.',
    },
    {
      q: '¿Qué pasa si caduca la licencia?',
      a: 'No se borra nada. El club, el cuerpo técnico y los jugadores de todos sus equipos dejan de ver sus datos privados (actas internas, estadísticas, lesiones, vídeos) hasta que el club la renueve; los datos públicos de la federación siguen visibles.',
    },
    {
      q: '¿Qué pasa si falla un cobro?',
      a: `Se reintenta automáticamente y el club mantiene el acceso ${c.renewalGraceDays} días mientras tanto. Si no se consigue cobrar, la suscripción se cancela y la licencia caduca.`,
    },
    {
      q: '¿Cómo se paga?',
      a: c.provider === 'mock'
        ? 'Ahora mismo los pagos están en modo de prueba: puedes recorrer todo el proceso, pero no se cobra nada. Cuando se conecte la pasarela se pagará con tarjeta en Stripe, con el IVA incluido y la factura de cada cobro.'
        : 'Con tarjeta, en la pasarela segura de Stripe: Tercer Tiempo no ve ni guarda los datos de tu tarjeta. Los precios incluyen el IVA y recibes la factura de cada cobro.',
    },
  ];
});
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <!-- Cabecera -->
    <header class="text-center">
      <p class="eyebrow">Precios</p>
      <h1 class="mt-2 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Paga por el club y añade técnicos cuando los necesites</h1>
      <p class="mx-auto mt-3 max-w-2xl text-sm text-slate-500 sm:text-base">
        La licencia de club cubre el primer equipo y todos sus filiales con todas las herramientas, y el club puede hacerlo todo
        él solo. Si quieres que tu cuerpo técnico tenga su propia cuenta, añade licencias de técnico: mes a mes o una vez al año.
      </p>
      <div v-if="catalog" class="mt-4 flex flex-wrap justify-center gap-2 text-xs font-medium text-slate-600">
        <span class="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1"><Icon icon="star" class="h-3 w-3 text-amber-400" />{{ catalog.trialDays }} días de prueba con {{ staffCountLabel(catalog.trialStaffSeats) }}</span>
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
            <dt class="text-xs text-slate-500">Licencia</dt>
            <dd class="font-semibold text-slate-900">
              <template v-if="license.contracted">{{ subscriptionLabel(license.staffSeats) }} · {{ billingIntervalLabels[license.interval!].toLowerCase() }}</template>
              <template v-else>Prueba con {{ staffCountLabel(license.staffLimit) }}</template>
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
              <template v-if="license.renewsOn && license.status !== 'Expired'">{{ money(license.renewalPriceCents ?? 0) }} el {{ formatDate(license.renewsOn) }}</template>
              <template v-else>{{ formatDate(license.validUntil) }}</template>
            </dd>
          </div>
          <div class="rounded-lg bg-surface-2 px-3 py-2">
            <dt class="text-xs text-slate-500">Técnicos nombrados</dt>
            <dd class="font-semibold" :class="license.staffInUse >= license.staffLimit && license.staffLimit > 0 ? 'text-amber-500' : 'text-slate-900'">{{ license.staffInUse }} de {{ license.staffLimit }}</dd>
          </div>
        </dl>

        <div class="mt-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipos que cubre · técnicos de cada uno</p>
          <ul class="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <li v-for="t in license.teams" :key="t.teamId" class="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm">
              <TeamName :name="t.teamName" :crest-url="t.teamCrestUrl" :team-id="t.teamId" size="sm" class="min-w-0" />
              <span class="shrink-0 text-xs font-semibold text-slate-600">{{ staffCountLabel(t.staffCount) }}</span>
            </li>
          </ul>
        </div>
        <p v-if="license.nextStaffSeats !== null || license.nextInterval" class="mt-3 text-xs text-slate-500">
          <Icon icon="calendar-check" class="mr-1 h-3 w-3" />En la próxima renovación pasa a
          <strong class="text-slate-700">{{ subscriptionLabel(license.nextStaffSeats ?? license.staffSeats) }} {{ billingIntervalLabels[license.nextInterval ?? license.interval!].toLowerCase() }}</strong>.
        </p>
      </section>

      <Alert v-if="notice" kind="success" class="mx-auto mt-4 max-w-4xl">{{ notice }}</Alert>
      <Alert v-if="error" kind="error" class="mx-auto mt-4 max-w-4xl">{{ error }}</Alert>

      <!-- Licencia de club y licencias de técnico -->
      <PlanCards v-model:interval="interval" :catalog="catalog" class="mt-8">
        <template #action="{ item }">
          <!-- Sin cuenta: empezar la prueba -->
          <template v-if="!auth.isAuthenticated">
            <RouterLink to="/registro" class="w-full" :class="item === 'Club' ? 'btn-primary' : 'btn-secondary'">
              {{ item === 'Club' ? `Empieza gratis ${catalog.trialDays} días` : `La prueba incluye ${staffCountLabel(catalog.trialStaffSeats)}` }}
            </RouterLink>
          </template>
          <!-- Técnico o jugador: la contrata el club -->
          <p v-else-if="!auth.isClub" class="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-slate-500">La licencia la contrata el club de tu equipo.</p>
          <p v-else-if="!license" class="rounded-lg bg-surface-2 px-3 py-2 text-center text-xs text-slate-500">Tu club aún no tiene equipos: no hay licencia que contratar.</p>

          <!-- Licencia de club -->
          <template v-else-if="item === 'Club'">
            <template v-if="subscribed">
              <button v-if="interval === upcomingInterval" type="button" class="btn-secondary w-full" disabled>
                <Icon icon="check" class="h-3.5 w-3.5" />Contratada · {{ billingIntervalLabels[interval].toLowerCase() }}
              </button>
              <button v-else type="button" class="btn-primary w-full" v-busy="busy" :disabled="busy" @click="changeInterval">
                Pasar a facturación {{ billingIntervalLabels[interval].toLowerCase() }}
              </button>
            </template>
            <button v-else-if="resumable" type="button" class="btn-primary w-full" v-busy="busy" :disabled="busy" @click="resumeRenewal">
              <Icon icon="rotate-right" class="h-3.5 w-3.5" />Reactivar la renovación
            </button>
            <button v-else type="button" class="btn-primary w-full" :disabled="busy" @click="openCheckout">
              {{ license.status === 'Expired' ? 'Renovar la licencia de club' : 'Contratar la licencia de club' }}
            </button>
          </template>

          <!-- Licencias de técnico: solo con la de club contratada -->
          <div v-else-if="subscribed" class="space-y-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <StaffSeatsStepper v-model="seats" :min="license.staffInUse" :max="catalog.maxStaffSeats" :disabled="busy" />
              <button type="button" class="btn-primary" v-busy="busy" :disabled="busy || seats === seatsTarget" @click="saveSeats">
                {{ seats === seatsTarget ? 'Guardar' : seatsAction }}
              </button>
            </div>
            <p class="text-xs text-slate-500">
              Tienes {{ staffCountLabel(license.staffSeats) }}<template v-if="license.nextStaffSeats !== null"> ({{ license.nextStaffSeats }} desde la renovación)</template>
              y {{ license.staffInUse }} {{ license.staffInUse === 1 ? 'nombrado' : 'nombrados' }}: no puedes bajar de ahí.
            </p>
          </div>
          <div v-else-if="resumable">
            <button type="button" class="btn-secondary w-full" disabled>Reactiva la renovación</button>
            <p class="mt-2 text-center text-xs text-slate-500">Con la renovación cancelada no se pueden cambiar los técnicos ({{ staffCountLabel(license.staffSeats) }} hasta el {{ formatDate(license.validUntil) }}).</p>
          </div>
          <div v-else>
            <button type="button" class="btn-secondary w-full" disabled>Primero, la licencia de club</button>
            <p class="mt-2 text-center text-xs text-slate-500">Al contratarla puedes añadir técnicos o hacerlo más adelante.</p>
          </div>
        </template>
      </PlanCards>

      <!-- Calculadora -->
      <section class="card mx-auto mt-10 max-w-4xl">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-lg font-bold text-slate-900">Calcula tu precio</h2>
            <p class="text-sm text-slate-500">La licencia de club más los técnicos con cuenta que quieras.</p>
          </div>
          <StaffSeatsStepper v-model="calcSeats" :max="catalog.maxStaffSeats" label="Técnicos de la calculadora" />
        </div>
        <dl class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div v-for="billing in (['Monthly', 'Yearly'] as const)" :key="billing" class="rounded-xl border border-line bg-surface-2 px-4 py-3">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ billingIntervalLabels[billing] }} · {{ subscriptionLabel(calcSeats) }}</dt>
            <dd class="mt-1 font-figures text-2xl font-extrabold text-slate-900">{{ money(total(calcSeats, billing)) }}<span class="text-sm font-medium text-slate-500">{{ billingIntervalSuffix[billing] }}</span></dd>
            <dd class="text-xs text-slate-500">
              {{ money(priceOf(catalog.club, billing)) }} del club<template v-if="calcSeats > 0"> + {{ calcSeats }} × {{ money(seatPrice(billing)) }}</template>
            </dd>
          </div>
        </dl>
      </section>

      <!-- Cómo funciona -->
      <section class="mt-14">
        <h2 class="text-center text-2xl font-bold text-slate-900">Cómo funciona</h2>
        <ol class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <li class="card">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 font-figures text-sm font-bold text-brand-500">1</span>
            <h3 class="mt-3 font-semibold text-slate-900">Pruébalo gratis</h3>
            <p class="mt-1 text-sm text-slate-500">Al dar de alta el club empiezan {{ catalog.trialDays }} días con todo y {{ staffCountLabel(catalog.trialStaffSeats) }}. Sin tarjeta.</p>
          </li>
          <li class="card">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 font-figures text-sm font-bold text-brand-500">2</span>
            <h3 class="mt-3 font-semibold text-slate-900">Contrata la licencia de club</h3>
            <p class="mt-1 text-sm text-slate-500">Mensual o anual. Si lo haces durante la prueba, no se cobra nada hasta que acaba.</p>
          </li>
          <li class="card">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 font-figures text-sm font-bold text-brand-500">3</span>
            <h3 class="mt-3 font-semibold text-slate-900">Añade técnicos</h3>
            <p class="mt-1 text-sm text-slate-500">Cuando los necesites, para cualquier equipo del club. Se cobra solo la parte que queda del periodo.</p>
          </li>
          <li class="card">
            <span class="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/15 font-figures text-sm font-bold text-brand-500">4</span>
            <h3 class="mt-3 font-semibold text-slate-900">Cancela sin permanencia</h3>
            <p class="mt-1 text-sm text-slate-500">Mantienes el acceso hasta el final de lo pagado. Tus datos no se borran nunca.</p>
          </li>
        </ol>
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
    <Modal :open="checkingOut && license !== null && catalog !== null" size="md" title="Contratar la licencia de club" @close="checkingOut = false">
      <template v-if="license && catalog">
        <p class="text-sm text-slate-500">
          Para <strong class="text-slate-800">{{ license.clubName }}</strong> y {{ license.teams.length === 1 ? 'su equipo' : `sus ${license.teams.length} equipos` }}, con
          todas las herramientas para el club.
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
            <span class="mt-1 block font-figures text-xl font-extrabold text-slate-900">{{ money(total(checkoutSeats, option)) }}<span class="text-sm font-medium text-slate-500">{{ billingIntervalSuffix[option] }}</span></span>
          </button>
        </div>

        <div class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
          <div class="min-w-0">
            <p class="font-semibold text-slate-900">Licencias de técnico</p>
            <p class="text-xs text-slate-500">
              {{ money(seatPrice()) }}{{ billingIntervalSuffix[interval] }} cada una.
              <template v-if="license.staffInUse > 0">Tienes {{ staffCountLabel(license.staffInUse) }} {{ license.staffInUse === 1 ? 'nombrado' : 'nombrados' }}: no puedes bajar de ahí.</template>
              <template v-else>Puedes contratar solo el club y añadirlas después.</template>
            </p>
          </div>
          <StaffSeatsStepper v-model="checkoutSeats" :min="license.staffInUse" :max="catalog.maxStaffSeats" />
        </div>

        <dl class="mt-5 divide-y divide-line rounded-xl border border-line bg-surface-2 text-sm">
          <div class="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt class="text-slate-500">Hoy pagas</dt>
            <dd class="font-figures text-lg font-extrabold text-slate-900">{{ chargeToday ? money(total(checkoutSeats)) : money(0) }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-2.5">
            <dt class="text-slate-500">{{ chargeToday ? 'Siguiente cobro' : 'Primer cobro' }}</dt>
            <dd class="text-right text-slate-800">
              <template v-if="chargeToday">{{ money(total(checkoutSeats)) }} {{ interval === 'Yearly' ? 'dentro de un año' : 'dentro de un mes' }}</template>
              <template v-else>{{ money(total(checkoutSeats)) }} el {{ formatDate(firstChargeOn(license)) }}</template>
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
          <button type="button" class="btn-ghost" @click="checkingOut = false">Cancelar</button>
          <button type="button" class="btn-primary" v-busy="busy" :disabled="busy" @click="checkout">
            <Icon icon="lock" class="h-3.5 w-3.5" />Continuar al pago
          </button>
        </div>
      </template>
    </Modal>
  </div>
</template>
