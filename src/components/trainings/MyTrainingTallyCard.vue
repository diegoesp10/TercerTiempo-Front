<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import TrainingPeriodFilter from '@/components/trainings/TrainingPeriodFilter.vue';
import TrainingTallyStats from '@/components/trainings/TrainingTallyStats.vue';
import Alert from '@/components/ui/Alert.vue';
import type { MyTrainingAttendanceDto } from '@/types/api';

// Los entrenamientos del jugador: de una temporada (empieza por la actual) o de todas, y entre las fechas que elija.
const props = defineProps<{ currentSquadId?: string | null }>();

const squadId = ref<string | null>(props.currentSquadId ?? null);
const from = ref<string | null>(null);
const to = ref<string | null>(null);
const data = ref<MyTrainingAttendanceDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await api.trainings.myAttendance({ squadId: squadId.value, from: from.value, to: to.value });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch([squadId, from, to], () => void load(), { immediate: true });

const season = computed(() => data.value?.seasons.find((s) => s.squadId === squadId.value) ?? null);

// Al cambiar de temporada, las fechas de otra no sirven.
function chooseSeason(value: string) {
  from.value = null;
  to.value = null;
  squadId.value = value || null;
}
</script>

<template>
  <section class="card">
    <h2 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="calendar-check" class="h-4 w-4 text-accent-400" />Tus entrenamientos</h2>
    <p class="mb-3 text-xs text-slate-500">Cuenta las sesiones ya acabadas a las que te tocaba ir: a cuántas fuiste y el tiempo que llevas entrenado.</p>
    <TrainingPeriodFilter
      v-model:from="from"
      v-model:to="to"
      class="mb-3"
      :min="season?.startsOn"
      :max="season?.endsOn"
      :all-label="squadId ? 'Toda la temporada' : 'Siempre'"
    >
      <select v-if="data && data.seasons.length" :value="squadId ?? ''" class="input px-2 py-1 text-xs" aria-label="Temporada" @change="chooseSeason(($event.target as HTMLSelectElement).value)">
        <option value="">Todas las temporadas</option>
        <option v-for="s in data.seasons" :key="s.squadId" :value="s.squadId">{{ s.teamName }} · {{ s.label }}</option>
      </select>
    </TrainingPeriodFilter>
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <p v-else-if="loading && !data" class="text-sm text-slate-500">Cargando…</p>
    <TrainingTallyStats v-else-if="data" :tally="data" self :class="loading ? 'is-refreshing' : ''" />
  </section>
</template>
