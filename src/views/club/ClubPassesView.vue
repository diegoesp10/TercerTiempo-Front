<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StatCard from '@/components/ui/StatCard.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import type { ClubPassPricesDto, ClubPassRequestDto, MatchDto, MatchPassPriceDto, MatchPassRequestStatus, PassEarningsDto } from '@/types/api';
import { formatKickoff, formatMoney, passContents, passPrice, passRequestStatusLabels } from '@/utils/format';
import { centsToEuros, eurosToCents } from '@/components/passes/passes';

const auth = useAuthStore();
const route = useRoute();
const router = useRouter();

type Tab = 'solicitudes' | 'precios' | 'ventas';
const tabs: { id: Tab; label: string }[] = [
  { id: 'solicitudes', label: 'Solicitudes' },
  { id: 'precios', label: 'Precios' },
  { id: 'ventas', label: 'Ventas' },
];
const tab = computed<Tab>(() => tabs.find((t) => t.id === route.query.tab)?.id ?? 'solicitudes');
const selectTab = (id: Tab) => void router.replace({ query: { ...route.query, tab: id === 'solicitudes' ? undefined : id } });

const fixture = (match: MatchDto) => `${match.homeTeam.name} - ${match.awayTeam.name}`;
const error = ref<string | null>(null);
const loading = ref(false);

// --- Solicitudes ---
const requests = shallowRef<ClubPassRequestDto[]>([]);
const pending = computed(() => requests.value.filter((r) => r.status === 'Pending'));
const decided = computed(() => requests.value.filter((r) => r.status !== 'Pending'));
const requestTone: Record<MatchPassRequestStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  Pending: 'amber',
  Approved: 'green',
  Rejected: 'red',
  Cancelled: 'slate',
};

interface ApproveForm { sheet: boolean; video: boolean; download: boolean; price: string; touched: boolean }
const approving = ref<string | null>(null);
const form = reactive<ApproveForm>({ sheet: true, video: false, download: false, price: '0', touched: false });
const busy = ref<string | null>(null);

const suggestedFor = (r: ClubPassRequestDto, sheet: boolean, video: boolean) =>
  (sheet ? r.sheetPriceCents : 0) + (video ? r.videoPriceCents : 0);

function startApprove(r: ClubPassRequestDto) {
  approving.value = r.id;
  form.sheet = r.wantsSheet;
  form.video = r.wantsVideo && r.hasVideo;
  form.download = false;
  form.touched = false;
  form.price = centsToEuros(suggestedFor(r, form.sheet, form.video));
}

watch(() => [form.sheet, form.video], () => {
  if (!form.video) form.download = false;
  const r = requests.value.find((x) => x.id === approving.value);
  if (r && !form.touched) form.price = centsToEuros(suggestedFor(r, form.sheet, form.video));
});

const formCents = computed(() => eurosToCents(form.price));

async function approve(r: ClubPassRequestDto) {
  if (formCents.value === null || (!form.sheet && !form.video)) return;
  busy.value = r.id;
  error.value = null;
  try {
    await api.passes.approve(r.id, { includesSheet: form.sheet, includesVideo: form.video, allowsDownload: form.download, priceCents: formCents.value });
    approving.value = null;
    await loadRequests();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

async function reject(r: ClubPassRequestDto) {
  if (!(await confirmDialog({ title: 'Rechazar la solicitud', message: `${r.requesterName} verá que la has rechazado y podrá volver a pedirlo.`, confirmLabel: 'Rechazar', danger: true }))) return;
  busy.value = r.id;
  error.value = null;
  try {
    await api.passes.reject(r.id);
    await loadRequests();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

async function loadRequests() {
  requests.value = await api.passes.clubRequests();
}

// --- Precios ---
const prices = shallowRef<ClubPassPricesDto | null>(null);
const defaults = reactive({ sheet: '0', video: '0' });
const onlyWithContent = ref(true);
const rowDrafts = reactive<Record<string, { sheet: string; video: string }>>({});
const rowKey = (m: MatchPassPriceDto) => `${m.squadId}:${m.matchId}`;

function fillPrices(data: ClubPassPricesDto) {
  prices.value = data;
  defaults.sheet = centsToEuros(data.sheetPriceCents);
  defaults.video = centsToEuros(data.videoPriceCents);
  for (const m of data.matches) {
    rowDrafts[rowKey(m)] = {
      sheet: m.sheetPriceCents === null ? '' : centsToEuros(m.sheetPriceCents),
      video: m.videoPriceCents === null ? '' : centsToEuros(m.videoPriceCents),
    };
  }
}

const matchRows = computed(() =>
  [...(prices.value?.matches ?? [])]
    .filter((m) => !onlyWithContent.value || m.hasSheet || m.hasVideo)
    .sort((a, b) => b.match.kickoffAt.localeCompare(a.match.kickoffAt)),
);

// Vacío = el precio general del club.
const optionalCents = (text: string) => (text.trim() === '' ? null : eurosToCents(text));
const rowInvalid = (m: MatchPassPriceDto) => {
  const d = rowDrafts[rowKey(m)];
  return !d || (d.sheet.trim() !== '' && eurosToCents(d.sheet) === null) || (d.video.trim() !== '' && eurosToCents(d.video) === null);
};
const rowChanged = (m: MatchPassPriceDto) => {
  const d = rowDrafts[rowKey(m)];
  return !!d && (optionalCents(d.sheet) !== m.sheetPriceCents || optionalCents(d.video) !== m.videoPriceCents);
};

const defaultsInvalid = computed(() => eurosToCents(defaults.sheet) === null || eurosToCents(defaults.video) === null);
const saved = ref<string | null>(null);

async function saveDefaults() {
  const sheet = eurosToCents(defaults.sheet);
  const video = eurosToCents(defaults.video);
  if (sheet === null || video === null) return;
  busy.value = 'defaults';
  error.value = null;
  try {
    fillPrices(await api.passes.setPrices(sheet, video));
    saved.value = 'defaults';
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

async function saveRow(m: MatchPassPriceDto) {
  const d = rowDrafts[rowKey(m)];
  if (!d || rowInvalid(m)) return;
  busy.value = rowKey(m);
  error.value = null;
  try {
    await api.passes.setMatchPrice(m.squadId, m.matchId, optionalCents(d.sheet), optionalCents(d.video));
    fillPrices(await api.passes.prices());
    saved.value = rowKey(m);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

// --- Ventas ---
const earnings = shallowRef<PassEarningsDto | null>(null);

async function load() {
  if (!auth.isClub) return;
  loading.value = true;
  error.value = null;
  try {
    if (tab.value === 'solicitudes') await loadRequests();
    else if (tab.value === 'precios') fillPrices(await api.passes.prices());
    else earnings.value = await api.passes.earnings();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(tab, () => { saved.value = null; void load(); }, { immediate: true });
</script>

<template>
  <div>
    <PageHeader title="Pases del club" subtitle="Quién ve el acta interna y el vídeo de vuestros partidos sin ser de la plantilla, a qué precio y lo que habéis vendido." />
    <div class="-mt-2 mb-4 flex justify-end">
      <RouterLink :to="{ name: 'my-passes' }" class="btn-ghost px-3 py-1 text-xs"><Icon icon="ticket" class="mr-1.5 h-3 w-3" />Pases que habéis canjeado de otros clubes</RouterLink>
    </div>

    <Alert v-if="!auth.isClub" kind="warning">Solo las cuentas de club gestionan los pases y sus precios.</Alert>

    <template v-else>
      <nav class="mb-4 flex gap-1 border-b border-slate-200" role="tablist">
        <button
          v-for="item in tabs"
          :key="item.id"
          type="button"
          role="tab"
          :aria-selected="tab === item.id"
          class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition"
          :class="tab === item.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'"
          @click="selectTab(item.id)"
        >
          {{ item.label }}<template v-if="item.id === 'solicitudes' && pending.length"> ({{ pending.length }})</template>
        </button>
      </nav>

      <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>
      <Spinner v-if="loading" />

      <!-- Solicitudes -->
      <template v-else-if="tab === 'solicitudes'">
        <section class="card">
          <h2 class="font-semibold text-slate-900">Pendientes</h2>
          <p class="mt-1 text-xs text-slate-500">
            Llegan de partidos jugados de vuestras plantillas abiertas a solicitudes. Al aprobar una se genera un pase que
            solo puede canjear quien la pidió; tú decides qué incluye y a qué precio.
          </p>
          <p v-if="pending.length === 0" class="mt-3 text-sm text-slate-500">No hay solicitudes pendientes.</p>
          <ul v-else class="mt-3 divide-y divide-slate-100">
            <li v-for="r in pending" :key="r.id" class="py-3 text-sm">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="font-medium text-slate-900">{{ r.requesterName }} pide {{ passContents(r.wantsSheet, r.wantsVideo).toLowerCase() }}</p>
                  <p class="text-xs text-slate-500">{{ fixture(r.match) }} · {{ r.teamName }} · {{ formatKickoff(r.createdAt) }}</p>
                  <p v-if="r.message" class="mt-1 rounded bg-surface-2 px-2 py-1 text-xs text-slate-700">«{{ r.message }}»</p>
                </div>
                <div v-if="approving !== r.id" class="flex gap-2">
                  <button type="button" class="btn-primary px-3 py-1 text-xs" @click="startApprove(r)">Aprobar…</button>
                  <button type="button" class="btn-ghost px-3 py-1 text-xs text-red-600 hover:bg-red-50" v-busy="busy === r.id" :disabled="busy === r.id" @click="reject(r)">Rechazar</button>
                </div>
              </div>

              <form v-if="approving === r.id" class="mt-3 space-y-3 rounded-lg border border-line bg-surface-2 p-3" @submit.prevent="approve(r)">
                <div class="flex flex-wrap gap-x-5 gap-y-2 text-slate-800">
                  <label class="flex items-center gap-2"><input v-model="form.sheet" type="checkbox" class="h-4 w-4 accent-brand-500" />Acta interna</label>
                  <label class="flex items-center gap-2" :class="r.hasVideo ? '' : 'text-slate-400'" :title="r.hasVideo ? undefined : 'Todavía no hay vídeo de este partido'">
                    <input v-model="form.video" type="checkbox" class="h-4 w-4 accent-brand-500" :disabled="!r.hasVideo" />Vídeo
                  </label>
                  <label class="flex items-center gap-2" :class="form.video ? '' : 'text-slate-400'">
                    <input v-model="form.download" type="checkbox" class="h-4 w-4 accent-brand-500" :disabled="!form.video" />Permitir descargar el vídeo
                  </label>
                </div>
                <div class="flex flex-wrap items-end gap-3">
                  <div class="w-32">
                    <label class="label" :for="`approve-price-${r.id}`">Precio (€)</label>
                    <input :id="`approve-price-${r.id}`" v-model="form.price" type="text" inputmode="decimal" class="input tabular-nums" :class="formCents === null ? 'border-red-400' : ''" @input="form.touched = true" />
                  </div>
                  <button type="submit" class="btn-primary" v-busy="busy === r.id" :disabled="busy === r.id || formCents === null || (!form.sheet && !form.video)">Aprobar y generar el pase</button>
                  <button type="button" class="btn-ghost" @click="approving = null">Cancelar</button>
                </div>
                <p class="text-xs text-slate-500">0 = gratis. Lo paga al canjear el código, que verá en su página de pases.</p>
              </form>
            </li>
          </ul>
        </section>

        <section class="card mt-6">
          <h2 class="font-semibold text-slate-900">Decididas</h2>
          <p v-if="decided.length === 0" class="mt-1 text-sm text-slate-500">Todavía ninguna.</p>
          <ul v-else class="mt-2 divide-y divide-slate-100">
            <li v-for="r in decided" :key="r.id" class="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
              <div class="min-w-0">
                <p class="text-slate-900">{{ r.requesterName }} · {{ passContents(r.wantsSheet, r.wantsVideo).toLowerCase() }}</p>
                <p class="text-xs text-slate-500">
                  {{ fixture(r.match) }} · {{ r.teamName }}<template v-if="r.decidedAt"> · {{ formatKickoff(r.decidedAt) }}</template>
                  <template v-if="r.passCode"> · pase <code class="font-figures tracking-widest">{{ r.passCode }}</code> {{ r.passRedeemed ? 'canjeado' : 'sin canjear' }}</template>
                </p>
              </div>
              <Badge :tone="requestTone[r.status]">{{ passRequestStatusLabels[r.status] }}</Badge>
            </li>
          </ul>
        </section>
      </template>

      <!-- Precios -->
      <template v-else-if="tab === 'precios' && prices">
        <section class="card">
          <h2 class="font-semibold text-slate-900">Precios por defecto</h2>
          <p class="mt-1 text-xs text-slate-500">
            Lo que cuesta el acceso a un partido si no le pones uno propio. 0 = gratis. De cada venta, el club se queda el
            {{ prices.clubSharePercent }} % y la plataforma el {{ 100 - prices.clubSharePercent }} % por la gestión.
          </p>
          <form class="mt-3 flex flex-wrap items-end gap-3" @submit.prevent="saveDefaults">
            <div class="w-36">
              <label class="label" for="default-sheet">Acta interna (€)</label>
              <input id="default-sheet" v-model="defaults.sheet" type="text" inputmode="decimal" class="input tabular-nums" />
            </div>
            <div class="w-36">
              <label class="label" for="default-video">Vídeo (€)</label>
              <input id="default-video" v-model="defaults.video" type="text" inputmode="decimal" class="input tabular-nums" />
            </div>
            <button type="submit" class="btn-primary" v-busy="busy === 'defaults'" :disabled="busy === 'defaults' || defaultsInvalid">Guardar</button>
            <span v-if="saved === 'defaults'" class="text-xs text-emerald-600"><Icon icon="check" class="mr-1 h-3 w-3" />Guardado</span>
          </form>
        </section>

        <section class="card mt-6">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-semibold text-slate-900">Precio de cada partido</h2>
            <label class="flex items-center gap-2 text-xs text-slate-600">
              <input v-model="onlyWithContent" type="checkbox" class="h-4 w-4 accent-brand-500" />Solo partidos con acta interna o vídeo
            </label>
          </div>
          <p class="mt-1 text-xs text-slate-500">Deja un precio vacío para usar el general.</p>
          <p v-if="matchRows.length === 0" class="mt-3 text-sm text-slate-500">No hay partidos jugados que mostrar.</p>
          <div v-else class="mt-3 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="py-2 pr-3 text-left">Partido</th>
                  <th class="px-2 py-2 text-left">Acta interna (€)</th>
                  <th class="px-2 py-2 text-left">Vídeo (€)</th>
                  <th class="py-2 pl-2" />
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="m in matchRows" :key="rowKey(m)">
                  <td class="py-2 pr-3">
                    <p class="text-slate-900">{{ fixture(m.match) }}</p>
                    <p class="text-xs text-slate-500">
                      {{ m.teamName }} · {{ formatKickoff(m.match.kickoffAt) }}
                      <Badge v-if="!m.openToRequests" tone="slate" class="ml-1">Privada</Badge>
                    </p>
                  </td>
                  <td class="px-2 py-2">
                    <input v-model="rowDrafts[rowKey(m)].sheet" type="text" inputmode="decimal" class="input w-24 tabular-nums" :placeholder="centsToEuros(prices.sheetPriceCents)" :disabled="!m.hasSheet" :title="m.hasSheet ? undefined : 'Sin acta interna registrada'" />
                  </td>
                  <td class="px-2 py-2">
                    <input v-model="rowDrafts[rowKey(m)].video" type="text" inputmode="decimal" class="input w-24 tabular-nums" :placeholder="centsToEuros(prices.videoPriceCents)" :disabled="!m.hasVideo" :title="m.hasVideo ? undefined : 'Sin vídeo subido'" />
                  </td>
                  <td class="py-2 pl-2 text-right whitespace-nowrap">
                    <button v-if="rowChanged(m)" type="button" class="btn-secondary px-3 py-1 text-xs" v-busy="busy === rowKey(m)" :disabled="busy === rowKey(m) || rowInvalid(m)" @click="saveRow(m)">Guardar</button>
                    <span v-else-if="saved === rowKey(m)" class="text-xs text-emerald-600"><Icon icon="check" class="mr-1 h-3 w-3" />Guardado</span>
                    <span v-else class="text-xs text-slate-400">{{ passPrice(m.effectiveSheetPriceCents) }} / {{ passPrice(m.effectiveVideoPriceCents) }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>

      <!-- Ventas -->
      <template v-else-if="tab === 'ventas' && earnings">
        <div class="grid gap-3 sm:grid-cols-4">
          <StatCard label="Pases vendidos" :value="earnings.salesCount" />
          <StatCard label="Total cobrado" :value="formatMoney(earnings.grossCents, earnings.currency)" />
          <StatCard :label="`Para el club (${earnings.clubSharePercent} %)`" :value="formatMoney(earnings.clubShareCents, earnings.currency)" />
          <StatCard label="Gestión de la plataforma" :value="formatMoney(earnings.platformShareCents, earnings.currency)" />
        </div>

        <section class="card mt-6">
          <h2 class="font-semibold text-slate-900">Últimas ventas</h2>
          <p v-if="earnings.recent.length === 0" class="mt-1 text-sm text-slate-500">Todavía no habéis vendido ningún pase.</p>
          <div v-else class="mt-2 overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="py-2 pr-3 text-left">Fecha</th>
                  <th class="px-2 py-2 text-left">Partido</th>
                  <th class="px-2 py-2 text-left">Comprador</th>
                  <th class="px-2 py-2 text-right">Importe</th>
                  <th class="px-2 py-2 text-right">Club</th>
                  <th class="py-2 pl-2 text-right">Plataforma</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="sale in earnings.recent" :key="sale.id">
                  <td class="py-2 pr-3 whitespace-nowrap text-slate-600">{{ formatKickoff(sale.paidAt) }}</td>
                  <td class="px-2 py-2">
                    <p class="text-slate-900">{{ sale.match ? fixture(sale.match) : 'Partido' }}</p>
                    <p class="text-xs text-slate-500">{{ passContents(sale.includesSheet, sale.includesVideo) }} · {{ sale.teamName }}</p>
                  </td>
                  <td class="px-2 py-2 text-slate-700">{{ sale.buyer ?? '—' }}</td>
                  <td class="px-2 py-2 text-right tabular-nums">{{ formatMoney(sale.amountCents, sale.currency) }}</td>
                  <td class="px-2 py-2 text-right tabular-nums text-emerald-600">{{ formatMoney(sale.clubShareCents, sale.currency) }}</td>
                  <td class="py-2 pl-2 text-right tabular-nums text-slate-500">{{ formatMoney(sale.platformShareCents, sale.currency) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
