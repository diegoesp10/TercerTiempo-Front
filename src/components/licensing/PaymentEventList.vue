<script setup lang="ts">
import Badge from '@/components/ui/Badge.vue';
import type { PaymentEventDto, PaymentEventStatus } from '@/types/api';
import { formatKickoff } from '@/utils/format';

/** Avisos de la pasarela en la cola, del más reciente al primero. Con `admin`, más detalle y botón de reintentar. */
withDefaults(defineProps<{ events: PaymentEventDto[]; admin?: boolean; retrying?: string | null }>(), { admin: false, retrying: null });
const emit = defineEmits<{ retry: [id: string] }>();

const typeLabels: Record<string, string> = {
  'checkout.session.completed': 'Pago completado',
  'invoice.paid': 'Factura cobrada',
  'invoice.payment_failed': 'Cobro rechazado',
  'customer.subscription.deleted': 'Suscripción terminada',
};

const statusInfo: Record<PaymentEventStatus, { label: string; tone: 'green' | 'amber' | 'red' | 'slate' }> = {
  pending: { label: 'En cola', tone: 'amber' },
  processed: { label: 'Aplicado', tone: 'green' },
  ignored: { label: 'Sin cambios', tone: 'slate' },
  failed: { label: 'Fallido', tone: 'red' },
};
</script>

<template>
  <ol class="divide-y divide-line">
    <li v-for="event in events" :key="event.id" class="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 py-2.5">
      <div class="min-w-0">
        <p class="text-sm font-semibold text-slate-800">
          {{ typeLabels[event.type] ?? event.type }}
          <span v-if="admin && event.clubName" class="font-normal text-slate-500">· {{ event.clubName }}</span>
        </p>
        <p class="font-mono text-[11px] text-slate-500">{{ event.type }}<template v-if="admin"> · {{ event.externalId }}</template></p>
        <p v-if="event.summary" class="mt-0.5 text-xs text-slate-600">{{ event.summary }}</p>
        <p v-if="event.error" class="mt-0.5 text-xs text-red-500">{{ event.error }}</p>
        <p v-if="admin && event.nextAttemptAt" class="mt-0.5 text-[11px] text-slate-500">Próximo intento: {{ formatKickoff(event.nextAttemptAt) }}</p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <span class="text-[11px] text-slate-500">{{ formatKickoff(event.receivedAt) }}<template v-if="admin && event.attempts > 1"> · {{ event.attempts }} intentos</template></span>
        <Badge :tone="statusInfo[event.status].tone">{{ statusInfo[event.status].label }}</Badge>
        <button
          v-if="admin && (event.status === 'failed' || event.status === 'pending' || event.status === 'ignored')"
          type="button"
          class="btn-ghost px-2 py-1 text-xs"
          v-busy="retrying === event.id"
          :disabled="retrying === event.id"
          @click="emit('retry', event.id)"
        >
          Reintentar
        </button>
      </div>
    </li>
  </ol>
</template>
