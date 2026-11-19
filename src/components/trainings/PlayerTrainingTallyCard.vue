<script setup lang="ts">
import { ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import TrainingPeriodFilter from '@/components/trainings/TrainingPeriodFilter.vue';
import TrainingTallyStats from '@/components/trainings/TrainingTallyStats.vue';
import Alert from '@/components/ui/Alert.vue';
import type { PlayerTrainingTallyDto } from '@/types/api';

// Entrenamientos de un jugador de la plantilla (temporada de esa plantilla), para el cuerpo técnico y para él mismo.
const props = defineProps<{ squadId: string; squadPlayerId: string }>();

const from = ref<string | null>(null);
const to = ref<string | null>(null);
const tally = ref<PlayerTrainingTallyDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    const report = await api.trainings.squadAttendance(props.squadId, { from: from.value, to: to.value, squadPlayerId: props.squadPlayerId });
    tally.value = report.players[0] ?? null;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch([() => props.squadId, () => props.squadPlayerId, from, to], () => void load(), { immediate: true });
</script>

<template>
  <section class="card">
    <h2 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="calendar-check" class="h-4 w-4 text-accent-400" />Entrenamientos</h2>
    <p class="mb-3 text-xs text-slate-500">Sesiones ya acabadas de esta temporada a las que le tocaba ir, a cuántas vino y el tiempo que suman.</p>
    <TrainingPeriodFilter v-model:from="from" v-model:to="to" class="mb-3" />
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <p v-else-if="loading && !tally" class="text-sm text-slate-500">Cargando…</p>
    <TrainingTallyStats v-else-if="tally" :tally="tally" :class="loading ? 'is-refreshing' : ''" />
  </section>
</template>
