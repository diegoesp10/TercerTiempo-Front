<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StatCard from '@/components/ui/StatCard.vue';
import type { PlatformPassEarningsDto } from '@/types/api';
import { formatMoney } from '@/utils/format';

const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const data = ref<PlatformPassEarningsDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

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
              <th class="py-2 pr-3 text-left">Club</th>
              <th class="px-2 py-2 text-right">Ventas</th>
              <th class="px-2 py-2 text-right">Total</th>
              <th class="px-2 py-2 text-right">Club</th>
              <th class="py-2 pl-2 text-right">Plataforma</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in data.clubs" :key="row.clubId">
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
