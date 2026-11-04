<script setup lang="ts">
import { ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAsync } from '@/composables/useAsync';
import type { MatchDto, MatchPassRequestStatus, MyPassRequestDto } from '@/types/api';
import { formatKickoff, passContents, passPrice, passRequestStatusLabels } from '@/utils/format';

const { data, loading, error, run } = useAsync(() => api.passes.mine(), { redirectOnError: false });

const fixture = (match: MatchDto) => `${match.homeTeam.name} - ${match.awayTeam.name}`;

const requestTone: Record<MatchPassRequestStatus, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  Pending: 'amber',
  Approved: 'green',
  Rejected: 'red',
  Cancelled: 'slate',
};

const busy = ref<string | null>(null);
const actionError = ref<string | null>(null);

async function cancel(request: MyPassRequestDto) {
  if (!(await confirmDialog({ title: 'Retirar la solicitud', message: `El club de ${request.teamName} dejará de verla.`, confirmLabel: 'Retirar', danger: true }))) return;
  busy.value = request.id;
  actionError.value = null;
  try {
    await api.passes.cancelRequest(request.id);
    await run();
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <PageHeader title="Mis pases" subtitle="Los partidos de otros equipos cuyo acta interna o vídeo puedes ver, y tus solicitudes de acceso." />

    <div class="mb-4 flex justify-end">
      <RouterLink :to="{ name: 'pass' }" class="btn-secondary"><Icon icon="ticket" class="mr-1.5 h-3.5 w-3.5" />Canjear un código</RouterLink>
    </div>

    <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>
    <Alert v-if="actionError" kind="error" class="mb-4">{{ actionError }}</Alert>
    <Spinner v-if="loading && !data" />

    <template v-else-if="data">
      <section class="card">
        <h2 class="font-semibold text-slate-900">Pases canjeados</h2>
        <p v-if="data.passes.length === 0" class="mt-1 text-sm text-slate-500">
          Todavía no tienes ninguno. Desde la página de un partido de una plantilla abierta a solicitudes puedes pedirle acceso a su club.
        </p>
        <ul v-else class="mt-2 divide-y divide-slate-100">
          <li v-for="pass in data.passes" :key="pass.id" class="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <div class="min-w-0">
              <p class="font-medium text-slate-900">{{ fixture(pass.match) }}</p>
              <p class="text-xs text-slate-500">
                {{ passContents(pass.includesSheet, pass.includesVideo, pass.allowsDownload) }} de {{ pass.teamName }} · {{ passPrice(pass.priceCents, pass.currency) }} · canjeado el {{ formatKickoff(pass.redeemedAt) }}
              </p>
            </div>
            <RouterLink :to="{ name: 'match', params: { matchId: pass.match.id }, query: { vista: 'visitante' } }" class="btn-primary px-3 py-1 text-xs">Ver el partido</RouterLink>
          </li>
        </ul>
      </section>

      <section class="card mt-6">
        <h2 class="font-semibold text-slate-900">Solicitudes</h2>
        <p v-if="data.requests.length === 0" class="mt-1 text-sm text-slate-500">No has pedido acceso a ningún partido.</p>
        <ul v-else class="mt-2 divide-y divide-slate-100">
          <li v-for="request in data.requests" :key="request.id" class="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
            <div class="min-w-0">
              <p class="font-medium text-slate-900">
                {{ fixture(request.match) }}
                <Badge :tone="requestTone[request.status]" class="ml-2">{{ passRequestStatusLabels[request.status] }}</Badge>
              </p>
              <p class="text-xs text-slate-500">
                {{ passContents(request.wantsSheet, request.wantsVideo) }} de {{ request.teamName }} · pedida el {{ formatKickoff(request.createdAt) }}
                <template v-if="request.status === 'Approved' && request.passPriceCents !== null">
                  · el club te da {{ passContents(request.passIncludesSheet, request.passIncludesVideo).toLowerCase() }} por {{ passPrice(request.passPriceCents) }}
                </template>
              </p>
            </div>
            <div class="flex gap-2">
              <button v-if="request.status === 'Pending'" type="button" class="btn-ghost px-3 py-1 text-xs text-red-600 hover:bg-red-50" v-busy="busy === request.id" :disabled="busy === request.id" @click="cancel(request)">Retirar</button>
              <RouterLink v-else-if="request.passCode && !request.passRedeemed" :to="{ name: 'pass', params: { code: request.passCode } }" class="btn-primary px-3 py-1 text-xs">
                <Icon icon="ticket" class="mr-1.5 h-3 w-3" />Canjear
              </RouterLink>
              <RouterLink v-else-if="request.passRedeemed" :to="{ name: 'match', params: { matchId: request.match.id }, query: { vista: 'visitante' } }" class="btn-ghost px-3 py-1 text-xs">Ver el partido</RouterLink>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
