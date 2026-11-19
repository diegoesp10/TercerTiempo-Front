<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StatCard from '@/components/ui/StatCard.vue';
import { useSort } from '@/composables/useSort';
import type { ClubEarningsRowDto, PlatformPassEarningsDto } from '@/types/api';
import { formatMoney } from '@/utils/format';

const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const data = ref<PlatformPassEarningsDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const clubs = computed(() => data.value?.clubs ?? []);
type SortKey = 'club' | 'sales' | 'gross' | 'clubShare' | 'platform';
const { sorted, sortBy, state } = useSort<ClubEarningsRowDto, SortKey>(
  clubs,
  {
    club: (r) => r.clubName,
    sales: (r) => r.salesCount,
    gross: (r) => r.grossCents,
    clubShare: (r) => r.clubShareCents,
    platform: (r) => r.platformShareCents,
  },
  'platform',
  { ascendingFirst: ['club'] },
);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await adminApi.passEarnings(props.token);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) emit('unauthorized');
    else error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(load);
defineExpose({ load });
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900">Pases vendidos</h2>
        <p class="text-xs text-slate-500">Acceso a actas internas y vídeos que venden los clubes. Cada venta guarda su reparto: lo del club y lo de la plataforma.</p>
      </div>
      <button type="button" class="btn-ghost px-3 py-1 text-xs" :disabled="loading" @click="load"><Icon icon="rotate-right" class="mr-1.5 h-3 w-3" />Actualizar</button>
    </div>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>
    <Spinner v-if="loading && !data" />

    <template v-else-if="data">
      <div class="mt-4 grid gap-3 sm:grid-cols-4">
        <StatCard label="Pases vendidos" :value="data.salesCount" />
        <StatCard label="Total cobrado" :value="formatMoney(data.grossCents, data.currency)" />
        <StatCard label="Para los clubes" :value="formatMoney(data.clubShareCents, data.currency)" />
        <StatCard label="Para la plataforma" :value="formatMoney(data.platformShareCents, data.currency)" accent />
      </div>

      <p v-if="data.clubs.length === 0" class="mt-4 text-sm text-slate-500">Ningún club ha vendido pases todavía.</p>
      <div v-else class="mt-4 overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortHeader class="py-2 pr-3 text-left" label="Club" v-bind="state('club')" @sort="sortBy('club')" />
              <SortHeader class="px-2 py-2 text-right" label="Ventas" v-bind="state('sales')" @sort="sortBy('sales')" />
              <SortHeader class="px-2 py-2 text-right" label="Total" v-bind="state('gross')" @sort="sortBy('gross')" />
              <SortHeader class="px-2 py-2 text-right" label="Club" title="Parte del club" v-bind="state('clubShare')" @sort="sortBy('clubShare')" />
              <SortHeader class="py-2 pl-2 text-right" label="Plataforma" title="Parte de la plataforma" v-bind="state('platform')" @sort="sortBy('platform')" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in sorted" :key="row.clubId">
              <td class="py-2 pr-3 text-slate-900">{{ row.clubName }}</td>
              <td class="px-2 py-2 text-right tabular-nums">{{ row.salesCount }}</td>
              <td class="px-2 py-2 text-right tabular-nums">{{ formatMoney(row.grossCents, data.currency) }}</td>
              <td class="px-2 py-2 text-right tabular-nums text-slate-600">{{ formatMoney(row.clubShareCents, data.currency) }}</td>
              <td class="py-2 pl-2 text-right tabular-nums font-semibold text-slate-900">{{ formatMoney(row.platformShareCents, data.currency) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </section>
</template>
