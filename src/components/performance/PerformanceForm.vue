<script setup lang="ts">
import { reactive, ref } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import type { PerformanceDto, PerformanceStats, Position } from '@/types/api';

const props = defineProps<{
  matchId: string;
  initial: PerformanceDto | null;
  position: Position;
}>();

const emit = defineEmits<{ saved: [performance: PerformanceDto] }>();

const form = reactive<PerformanceStats>({
  started: props.initial?.started ?? true,
  minutesPlayed: props.initial?.minutesPlayed ?? 90,
  goals: props.initial?.goals ?? 0,
  assists: props.initial?.assists ?? 0,
  shots: props.initial?.shots ?? 0,
  shotsOnTarget: props.initial?.shotsOnTarget ?? 0,
  keyPasses: props.initial?.keyPasses ?? 0,
  tackles: props.initial?.tackles ?? 0,
  interceptions: props.initial?.interceptions ?? 0,
  saves: props.initial?.saves ?? 0,
  yellowCards: props.initial?.yellowCards ?? 0,
  redCard: props.initial?.redCard ?? false,
  selfRating: props.initial?.selfRating ?? 6,
  notes: props.initial?.notes ?? '',
});

const saving = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const saved = ref(false);

type NumericField = keyof Omit<PerformanceStats, 'started' | 'redCard' | 'notes'>;

const counters: { key: NumericField; label: string; max?: number; goalkeeper?: boolean }[] = [
  { key: 'goals', label: 'Goles' },
  { key: 'assists', label: 'Asistencias' },
  { key: 'shots', label: 'Tiros' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta' },
  { key: 'keyPasses', label: 'Pases clave' },
  { key: 'tackles', label: 'Entradas' },
  { key: 'interceptions', label: 'Intercepciones' },
  { key: 'saves', label: 'Paradas', goalkeeper: true },
  { key: 'yellowCards', label: 'Amarillas', max: 2 },
];

async function submit() {
  saving.value = true;
  error.value = null;
  fieldErrors.value = {};
  saved.value = false;

  try {
    const result = await api.matches.logPerformance(props.matchId, {
      ...form,
      notes: form.notes?.trim() ? form.notes.trim() : null,
    });
    saved.value = true;
    emit('saved', result);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <Alert v-if="saved" kind="success">Rendimiento guardado.</Alert>

    <div class="grid gap-4 sm:grid-cols-3">
      <label class="flex items-center gap-2 text-sm text-slate-700">
        <input v-model="form.started" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-emerald-600" />
        Titular
      </label>
      <div>
        <label class="label" for="minutes">Minutos jugados</label>
        <input id="minutes" v-model.number="form.minutesPlayed" type="number" min="0" max="120" class="input" />
        <p v-if="fieldErrors.minutesPlayed" class="field-error">{{ fieldErrors.minutesPlayed[0] }}</p>
      </div>
      <div>
        <label class="label" for="rating">Tu valoración (1-10): <strong>{{ form.selfRating }}</strong></label>
        <input id="rating" v-model.number="form.selfRating" type="range" min="1" max="10" step="1" class="w-full accent-emerald-600" />
        <p v-if="fieldErrors.selfRating" class="field-error">{{ fieldErrors.selfRating[0] }}</p>
      </div>
    </div>

    <div class="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
      <div v-for="counter in counters" :key="counter.key" :class="counter.goalkeeper && position !== 'Goalkeeper' ? 'opacity-60' : ''">
        <label class="label" :for="counter.key">{{ counter.label }}</label>
        <input :id="counter.key" v-model.number="form[counter.key]" type="number" min="0" :max="counter.max" class="input" />
        <p v-if="fieldErrors[counter.key]" class="field-error">{{ fieldErrors[counter.key]?.[0] }}</p>
      </div>
      <label class="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
        <input v-model="form.redCard" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-red-600" />
        Tarjeta roja
      </label>
    </div>

    <div>
      <label class="label" for="notes">Notas (opcional)</label>
      <textarea id="notes" v-model="form.notes" rows="3" class="input" maxlength="1000" placeholder="Sensaciones, lesiones, cambios de posición…" />
      <p v-if="fieldErrors.notes" class="field-error">{{ fieldErrors.notes[0] }}</p>
    </div>

    <div class="flex justify-end">
      <button type="submit" class="btn-primary" :disabled="saving">
        {{ saving ? 'Guardando…' : initial ? 'Actualizar rendimiento' : 'Guardar rendimiento' }}
      </button>
    </div>
  </form>
</template>
