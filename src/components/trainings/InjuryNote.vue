<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import type { InjuryBriefDto } from '@/types/api';
import { formatDate } from '@/utils/format';
import { injuryWithLocation } from '@/utils/injuryAnatomy';
import { occasionIcon, occasionPlace } from '@/utils/injuryOccasion';

/**
 * Por qué un jugador no entrena o no va convocado: «Lesionado» con el tipo, los días de baja que lleva contados desde el
 * parte, del día del parte a la vuelta prevista (o al alta), el motivo y dónde se lesionó. Sin detalle (un compañero no
 * puede verlo) se queda en «Lesionado».
 */
// place: dónde se lesionó (se omite en el propio entrenamiento en que se lesionó).
const props = withDefaults(defineProps<{ injury: InjuryBriefDto | null; badge?: boolean; place?: boolean }>(), { badge: true, place: true });

const days = (n: number) => (n === 1 ? '1 día' : `${n} días`);

const detail = computed(() => {
  const i = props.injury;
  if (!i) return null;
  const parts = [injuryWithLocation(i)];
  const out = i.daysOut ?? null;
  if (i.returnedOn) {
    if (out !== null) parts.push(`${days(out)} de baja`);
    parts.push(`del ${formatDate(i.startedOn)} al ${formatDate(i.returnedOn)} (alta)`);
  } else {
    if (out !== null) parts.push(out === 0 ? 'parte de hoy' : `lleva ${days(out)} de baja`);
    parts.push(i.expectedReturnOn ? `del ${formatDate(i.startedOn)} al ${formatDate(i.expectedReturnOn)} (vuelta prevista)` : `desde el ${formatDate(i.startedOn)}, sin fecha de vuelta`);
  }
  return parts.join(' · ');
});
</script>

<template>
  <span class="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
    <Badge v-if="badge" tone="red"><Icon icon="user-injured" class="mr-1 h-2.5 w-2.5" />Lesionado</Badge>
    <span v-if="detail" class="text-slate-600">{{ detail }}</span>
    <span v-if="injury?.reason" class="text-slate-500">({{ injury.reason }})</span>
    <span v-if="place && injury?.occasion" class="text-slate-500"><Icon :icon="occasionIcon(injury.occasion)" class="mr-1 h-2.5 w-2.5" />Se lesionó {{ occasionPlace(injury.occasion) }}</span>
  </span>
</template>
