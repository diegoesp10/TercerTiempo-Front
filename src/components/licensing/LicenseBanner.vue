<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { useAuthStore } from '@/stores/auth';
import type { ClubLicenseDto, LicensingStatusDto } from '@/types/api';
import { formatDate } from '@/utils/format';

/**
 * Banda bajo la cabecera cuando la licencia de algún club de la cuenta no está vigente (o la prueba está a punto de
 * acabar): el club puede pagar desde aquí; técnicos y jugadores saben a quién pedirlo.
 */
const auth = useAuthStore();
const status = shallowRef<LicensingStatusDto | null>(null);

watch(
  () => [auth.isAuthenticated, auth.account?.type] as const,
  async ([authenticated]) => {
    status.value = null;
    if (!authenticated) return;
    try {
      status.value = await api.licensing.status();
    } catch { /* sin estado de licencia no se enseña banda */ }
  },
  { immediate: true },
);

const expired = computed(() => status.value?.licenses.filter((l) => l.status === 'Expired') ?? []);
// Prueba a punto de acabar sin plan elegido (con plan, el cobro llega solo al acabarla).
const ending = computed(() => status.value?.licenses.filter((l) => l.status === 'Trial' && l.daysLeft <= 7 && !l.autoRenew) ?? []);
// El club ya sabe que es suyo; a técnicos y jugadores se les dice de qué club y equipo.
const names = (list: ClubLicenseDto[]) =>
  auth.isClub ? 'tus equipos' : list.map((l) => `${l.clubName} (${l.teams.map((t) => t.teamName).join(', ')})`).join(', ');
</script>

<template>
  <div v-if="expired.length" class="border-b border-red-200 bg-red-50" role="status">
    <div class="mx-auto flex w-full max-w-[1760px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm text-red-800 sm:px-6 lg:px-10">
      <Icon icon="lock" class="h-3.5 w-3.5" />
      <span>
        <strong>Sin licencia vigente:</strong> {{ names(expired) }}. Los datos se conservan, pero
        <template v-if="auth.isClub">la plantilla, el cuerpo técnico y los jugadores no pueden verlos hasta que la renueves.</template>
        <template v-else>no podrás verlos hasta que tu club renueve la licencia.</template>
      </span>
      <RouterLink v-if="auth.isClub" :to="{ name: 'licenses' }" class="font-semibold underline">Renovar licencia</RouterLink>
    </div>
  </div>
  <div v-else-if="ending.length" class="border-b border-amber-200 bg-amber-50" role="status">
    <div class="mx-auto flex w-full max-w-[1760px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm text-amber-800 sm:px-6 lg:px-10">
      <Icon icon="circle-info" class="h-3.5 w-3.5" />
      <span>
        Periodo de prueba de {{ names(ending) }} hasta el {{ formatDate(ending[0]!.validUntil) }}.
        <template v-if="auth.isClub">Elige un plan para no perder el acceso: no se cobra nada hasta que acabe.</template>
        <template v-else>Recuérdaselo a tu club para no perder el acceso.</template>
      </span>
      <RouterLink v-if="auth.isClub" :to="{ name: 'licenses' }" class="font-semibold underline">Elegir plan</RouterLink>
    </div>
  </div>
</template>
