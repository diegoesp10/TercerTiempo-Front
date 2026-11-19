<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import type { InjuryBriefDto } from '@/types/api';
import { formatDate } from '@/utils/format';

/**
 * Por qué un jugador no entrena o no va convocado: «Lesionado» con el tipo, las fechas y el motivo. Sin detalle (un
 * compañero no puede verlo) se queda en «Lesionado».
 */
const props = withDefaults(defineProps<{ injury: InjuryBriefDto | null; badge?: boolean }>(), { badge: true });

const detail = computed(() => {
  const i = props.injury;
  if (!i) return null;
  const parts = [i.typeLabel, `desde el ${formatDate(i.startedOn)}`];
  if (i.returnedOn) parts.push(`alta el ${formatDate(i.returnedOn)}`);
  else if (i.expectedReturnOn) parts.push(`vuelta prevista el ${formatDate(i.expectedReturnOn)}`);
  else parts.push('sin fecha de vuelta');
  return parts.join(' · ');
});
</script>

<template>
  <span class="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
    <Badge v-if="badge" tone="red"><Icon icon="user-injured" class="mr-1 h-2.5 w-2.5" />Lesionado</Badge>
    <span v-if="detail" class="text-slate-600">{{ detail }}</span>
    <span v-if="injury?.reason" class="text-slate-500">({{ injury.reason }})</span>
  </span>
</template>
