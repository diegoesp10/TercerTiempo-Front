<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { MatchPassDto, MatchPassesDto, MatchPassStatus } from '@/types/api';
import { formatKickoff, passContents, passPrice, passStatusLabels } from '@/utils/format';
import { centsToEuros, eurosToCents, passLink } from '@/components/passes/passes';

const props = defineProps<{ squadId: string; matchId: string }>();

const data = shallowRef<MatchPassesDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await api.passes.forMatch(props.squadId, props.matchId);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(() => [props.squadId, props.matchId], () => void load(), { immediate: true });

// --- Nuevo pase ---
const includesSheet = ref(true);
const includesVideo = ref(false);
const allowsDownload = ref(false);
const recipient = ref('');
const price = ref('');
const priceTouched = ref(false);
const busy = ref(false);
const created = ref<MatchPassDto | null>(null);
const copied = ref<string | null>(null);

// Precio por defecto: el del club para este partido según lo que incluya; se puede cambiar para este pase.
const suggested = computed(() =>
  data.value ? (includesSheet.value ? data.value.sheetPriceCents : 0) + (includesVideo.value ? data.value.videoPriceCents : 0) : 0,
);
watch(suggested, (cents) => { if (!priceTouched.value) price.value = centsToEuros(cents); }, { immediate: true });
watch(includesVideo, (video) => { if (!video) allowsDownload.value = false; });

const priceCents = computed(() => eurosToCents(price.value));
const priceInvalid = computed(() => priceCents.value === null);

async function create() {
  if (!includesSheet.value && !includesVideo.value) return;
  if (priceCents.value === null) return;
  busy.value = true;
  error.value = null;
  try {
    created.value = await api.passes.create(props.squadId, props.matchId, {
      includesSheet: includesSheet.value,
      includesVideo: includesVideo.value,
      allowsDownload: allowsDownload.value,
      priceCents: priceCents.value,
      recipient: recipient.value.trim() || null,
    });
    recipient.value = '';
    priceTouched.value = false;
    price.value = centsToEuros(suggested.value);
    await load();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function copy(text: string, key: string) {
  try {
    await navigator.clipboard.writeText(text);
    copied.value = key;
    setTimeout(() => { if (copied.value === key) copied.value = null; }, 2500);
  } catch { /* sin portapapeles: el texto queda visible para copiarlo a mano */ }
}

async function revoke(pass: MatchPassDto) {
  const redeemed = pass.status === 'Redeemed';
  if (!(await confirmDialog({
    title: 'Revocar el pase',
    message: redeemed ? `${pass.redeemedBy ?? 'Quien lo canjeó'} dejará de ver lo que incluye.` : 'El código dejará de valer.',
    confirmLabel: 'Revocar',
    danger: true,
  }))) return;
  busy.value = true;
  error.value = null;
  try {
    data.value = await api.passes.revoke(props.squadId, props.matchId, pass.id);
    if (created.value?.id === pass.id) created.value = null;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

const statusTone: Record<MatchPassStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  Pending: 'blue',
  Redeemed: 'green',
  Revoked: 'slate',
  Expired: 'slate',
};
</script>

<template>
  <section class="card">
    <h2 class="font-semibold text-slate-900">Pases de este partido</h2>
    <p class="mt-1 text-xs text-slate-500">
      Lo interno (acta interna y vídeo) solo lo ve tu plantilla. Para que lo vea alguien de fuera, genera un pase: es un
      código de un solo uso que se canjea dentro de Tercer Tiempo y queda ligado a la cuenta que lo canjea. Si tiene precio,
      lo paga al canjearlo.
    </p>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>
    <Spinner v-if="loading && !data" />

    <template v-else-if="data">
      <p class="mt-3 text-xs text-slate-500">
        Precios de este partido: acta interna {{ passPrice(data.sheetPriceCents, data.currency) }} · vídeo {{ passPrice(data.videoPriceCents, data.currency) }}.
        Se cambian en <RouterLink to="/club/pases" class="text-accent-400 hover:underline">Pases del club</RouterLink>.
        <template v-if="data.openToRequests"> La plantilla está abierta a solicitudes: las que lleguen las aprueba el club.</template>
        <template v-else> La plantilla es privada: nadie puede pedir acceso, solo lo tendrá quien reciba un pase.</template>
      </p>

      <form class="mt-4 space-y-3 rounded-lg border border-line bg-surface-2 p-3" @submit.prevent="create">
        <div class="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-800">
          <label class="flex items-center gap-2" :class="data.hasSheet ? '' : 'text-slate-400'" :title="data.hasSheet ? undefined : 'Todavía no hay acta interna registrada'">
            <input v-model="includesSheet" type="checkbox" class="h-4 w-4 accent-brand-500" />Acta interna
          </label>
          <label class="flex items-center gap-2" :class="data.hasVideo ? '' : 'text-slate-400'" :title="data.hasVideo ? undefined : 'Sube antes el vídeo del partido'">
            <input v-model="includesVideo" type="checkbox" class="h-4 w-4 accent-brand-500" :disabled="!data.hasVideo" />Vídeo
          </label>
          <label class="flex items-center gap-2" :class="includesVideo ? '' : 'text-slate-400'">
            <input v-model="allowsDownload" type="checkbox" class="h-4 w-4 accent-brand-500" :disabled="!includesVideo" />Permitir descargar el vídeo
          </label>
        </div>
        <div class="flex flex-wrap items-end gap-3">
          <div class="w-32">
            <label class="label" for="pass-price">Precio (€)</label>
            <input id="pass-price" v-model="price" type="text" inputmode="decimal" class="input tabular-nums" :class="priceInvalid ? 'border-red-400' : ''" @input="priceTouched = true" />
          </div>
          <div class="min-w-48 flex-1">
            <label class="label" for="pass-recipient">Para quién (nota tuya, opcional)</label>
            <input id="pass-recipient" v-model="recipient" type="text" maxlength="100" class="input" placeholder="Ej.: analista del rival, ojeador…" />
          </div>
          <button type="submit" class="btn-primary" v-busy="busy" :disabled="busy || priceInvalid || (!includesSheet && !includesVideo)">
            <Icon icon="ticket" class="mr-1.5 h-3.5 w-3.5" />Generar pase
          </button>
        </div>
        <p class="text-xs text-slate-500">0 = gratis. De lo que se cobre, tu club se queda el {{ data.clubSharePercent }} % y la plataforma el {{ 100 - data.clubSharePercent }} %.</p>
      </form>

      <div v-if="created" class="mt-4 rounded-lg border border-emerald-300/40 bg-emerald-100 p-3 text-sm text-emerald-800">
        <p class="font-semibold">Pase listo: {{ passContents(created.includesSheet, created.includesVideo, created.allowsDownload) }} · {{ passPrice(created.priceCents, created.currency) }}</p>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <code class="rounded bg-surface px-2 py-1 font-figures text-base tracking-widest text-slate-900">{{ created.code }}</code>
          <button type="button" class="btn-secondary px-3 py-1 text-xs" @click="copy(created.code, 'code')"><Icon icon="copy" class="mr-1.5 h-3 w-3" />{{ copied === 'code' ? 'Copiado ✓' : 'Copiar código' }}</button>
          <button type="button" class="btn-secondary px-3 py-1 text-xs" @click="copy(passLink(created.code), 'link')"><Icon icon="link" class="mr-1.5 h-3 w-3" />{{ copied === 'link' ? 'Copiado ✓' : 'Copiar enlace' }}</button>
        </div>
        <p class="mt-1 text-xs">Envíaselo a quien quieras. Se canjea una sola vez, con su cuenta, antes del {{ formatKickoff(created.expiresAt) }}.</p>
      </div>

      <h3 class="mt-5 text-sm font-semibold text-slate-900">Generados</h3>
      <p v-if="data.passes.length === 0" class="mt-1 text-sm text-slate-500">Todavía no has dado ningún pase de este partido.</p>
      <ul v-else class="mt-2 divide-y divide-slate-100">
        <li v-for="pass in data.passes" :key="pass.id" class="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
          <div class="min-w-0">
            <p class="text-slate-900">
              <code class="mr-2 font-figures tracking-widest">{{ pass.code }}</code>
              <Badge :tone="statusTone[pass.status]">{{ passStatusLabels[pass.status] }}</Badge>
              <Badge v-if="pass.fromRequest" tone="slate" class="ml-1">Solicitud</Badge>
            </p>
            <p class="text-xs text-slate-500">
              {{ passContents(pass.includesSheet, pass.includesVideo, pass.allowsDownload) }} · {{ passPrice(pass.priceCents, pass.currency) }}
              <template v-if="pass.recipient"> · para {{ pass.recipient }}</template>
              <template v-if="pass.redeemedBy && pass.redeemedAt"> · canjeado por {{ pass.redeemedBy }} el {{ formatKickoff(pass.redeemedAt) }}</template>
              <template v-else-if="pass.status === 'Pending'"> · canjeable hasta el {{ formatKickoff(pass.expiresAt) }}</template>
            </p>
          </div>
          <div class="flex gap-2">
            <button v-if="pass.status === 'Pending'" type="button" class="btn-ghost px-3 py-1 text-xs" @click="copy(passLink(pass.code), pass.id)">
              <Icon icon="link" class="mr-1.5 h-3 w-3" />{{ copied === pass.id ? 'Copiado ✓' : 'Enlace' }}
            </button>
            <button v-if="pass.canRevoke" type="button" class="btn-ghost px-3 py-1 text-xs text-red-600 hover:bg-red-50" :disabled="busy" @click="revoke(pass)">Revocar</button>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>
