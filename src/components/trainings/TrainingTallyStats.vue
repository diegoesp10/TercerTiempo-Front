<script setup lang="ts">
import { computed } from 'vue';
import InjuryNote from '@/components/trainings/InjuryNote.vue';
import StatCard from '@/components/ui/StatCard.vue';
import type { InjuryBriefDto } from '@/types/api';
import { formatDurationMinutes } from '@/utils/format';

const props = defineProps<{
  tally: {
    sessions: number;
    attended: number;
    missed: number;
    warned: number;
    attendedMinutes: number;
    attendanceRate: number | null;
    /** Entrenamientos que se perdió lesionado: no cuentan como faltas ni bajan el porcentaje. */
    injured?: number;
    injuries?: InjuryBriefDto[] | null;
  };
  /** Lo mira el propio jugador: los textos le hablan de tú. */
  self?: boolean;
}>();

const average = computed(() => (props.tally.attended ? Math.round(props.tally.attendedMinutes / props.tally.attended) : 0));
</script>

<template>
  <div>
    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard :label="self ? 'Días que entrenaste' : 'Días que entrenó'" :value="tally.attended" :hint="`de ${tally.sessions} ${tally.sessions === 1 ? 'día' : 'días'} de entrenamiento`" accent />
      <StatCard label="% de asistencia" :value="tally.attendanceRate === null ? '—' : `${tally.attendanceRate} %`" :hint="tally.sessions ? `${tally.attended} de ${tally.sessions}` : 'sin entrenamientos acabados'" />
      <StatCard :label="self ? 'Días que no entrenaste' : 'Días que no entrenó'" :value="tally.missed" :hint="tally.missed ? `${self ? 'avisaste' : 'avisó'} en ${tally.warned}` : 'ninguno'" />
      <StatCard label="Tiempo entrenado" :value="formatDurationMinutes(tally.attendedMinutes)" :hint="tally.attended ? `${formatDurationMinutes(average)} de media por sesión` : 'sumado sesión a sesión'" />
    </div>
    <div v-if="tally.injured || tally.injuries?.length" class="mt-3 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-slate-700">
      <p class="flex items-center gap-2">
        <Icon icon="user-injured" class="h-3.5 w-3.5 text-red-500" />
        <template v-if="tally.injured">{{ self ? 'Te perdiste' : 'Se perdió' }} {{ tally.injured }} {{ tally.injured === 1 ? 'entrenamiento' : 'entrenamientos' }} por lesión: no cuentan como faltas.</template>
        <template v-else>{{ self ? 'Estuviste' : 'Estuvo' }} lesionado en este periodo.</template>
      </p>
      <ul class="mt-1 space-y-0.5 pl-5">
        <li v-for="i in tally.injuries ?? []" :key="i.id"><InjuryNote :injury="i" :badge="false" /></li>
      </ul>
    </div>
  </div>
</template>
