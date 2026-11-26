<script setup lang="ts">
import { rateText, type AttendanceGroup } from './attendance';

// Cabecera de un grupo de la asistencia (porteros, defensas…): se pliega y despliega, y dice cuántos son y la
// asistencia del grupo.
defineProps<{ group: AttendanceGroup; colspan: number }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <tr>
    <td :colspan="colspan" class="border-b border-line bg-surface-2 p-0">
      <button
        type="button"
        class="sticky left-0 flex items-center gap-2 px-3 py-1.5 text-left font-display text-2xs font-semibold uppercase tracking-[0.14em] text-slate-500 transition hover:text-slate-800"
        :aria-expanded="group.open"
        :title="group.open ? `Plegar ${group.label.toLowerCase()}` : `Desplegar ${group.label.toLowerCase()}`"
        @click="$emit('toggle')"
      >
        <Icon icon="chevron-down" class="h-3 w-3 transition-transform" :class="group.open ? '' : '-rotate-90'" aria-hidden="true" />
        {{ group.label }}
        <span class="font-sans font-medium normal-case tracking-normal text-slate-400">· {{ group.rows.length }}</span>
        <span
          v-if="group.rate !== null"
          class="font-sans font-semibold normal-case tracking-normal tabular-nums"
          :class="rateText(group.rate)"
          :title="`Asistencia de ${group.label.toLowerCase()}: días que entrenaron sobre los que les tocaban`"
        >
          · {{ group.rate }} %
        </span>
      </button>
    </td>
  </tr>
</template>
