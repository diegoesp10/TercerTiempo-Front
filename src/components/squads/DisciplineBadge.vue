<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import CardIcon from '@/components/ui/CardIcon.vue';
import type { DisciplineDto } from '@/types/api';

/**
 * Cómo llega alguien al próximo partido de liga, sin alarmas: «Apercibido» (cuatro amarillas en el ciclo: con una más
 * se pierde el siguiente) o «Sancionado» (no puede jugar ni entrar en la convocatoria; en el cuerpo técnico, no puede
 * estar en el banquillo), con la tarjeta que lo causa. El porqué va al pasar por encima y, con `reason`, al lado. Con
 * `compact`, en pantallas estrechas solo queda la tarjeta. Sin nada que marcar no pinta nada.
 */
const props = withDefaults(
  defineProps<{ discipline: DisciplineDto | null | undefined; staff?: boolean; compact?: boolean; reason?: boolean }>(),
  { staff: false, compact: false, reason: false },
);

const view = computed(() => {
  const d = props.discipline;
  if (d?.suspension) {
    const s = d.suspension;
    return {
      tone: 'red' as const,
      card: s.cause === 'YellowCards' ? ('yellow' as const) : ('red' as const),
      label: 'Sancionado',
      why: s.reason,
      title: `${s.reason}. ${props.staff ? 'No puede estar en el banquillo' : 'No puede jugar ni entrar en la convocatoria'} en el próximo partido de liga.`,
    };
  }
  if (d?.warned) {
    return {
      tone: 'amber' as const,
      card: 'yellow' as const,
      label: 'Apercibido',
      why: `${d.cycleYellows} amarillas en el ciclo`,
      title: `Lleva ${d.cycleYellows} amarillas en el ciclo: con una más se pierde el siguiente partido de liga.`,
    };
  }
  return null;
});
</script>

<template>
  <span v-if="view" class="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 align-middle" :title="view.title">
    <Badge :tone="view.tone" class="shrink-0 gap-1">
      <CardIcon :kind="view.card" small :title="view.title" />
      <span :class="compact ? 'hidden sm:inline' : ''">{{ view.label }}</span>
    </Badge>
    <span v-if="reason" class="text-xs text-slate-600">{{ view.why }}</span>
  </span>
</template>
