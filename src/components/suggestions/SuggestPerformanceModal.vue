<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import type { MatchDto, PerformanceDto, SuggestionDto } from '@/types/api';
import { formatKickoff } from '@/utils/format';

/**
 * El jugador propone su línea del acta de un partido: corrige la que registró el cuerpo técnico o crea una nueva
 * si no aparece. Va con un mensaje y la decide su club o su entrenador.
 */
const props = defineProps<{ open: boolean; match: MatchDto | null; current: PerformanceDto | null; opponentLabel: string }>();
const emit = defineEmits<{ close: []; sent: [suggestion: SuggestionDto] }>();

const form = reactive({
  started: false,
  minutesPlayed: 90,
  goals: 0,
  assists: 0,
  shots: 0,
  shotsOnTarget: 0,
  keyPasses: 0,
  tackles: 0,
  interceptions: 0,
  saves: 0,
  yellowCards: 0,
  redCard: false,
  message: '',
});

watch(
  () => [props.open, props.current] as const,
  ([open, current]) => {
    if (!open) return;
    form.started = current?.started ?? true;
    form.minutesPlayed = current?.minutesPlayed ?? 90;
    form.goals = current?.goals ?? 0;
    form.assists = current?.assists ?? 0;
    form.shots = current?.shots ?? 0;
    form.shotsOnTarget = current?.shotsOnTarget ?? 0;
    form.keyPasses = current?.keyPasses ?? 0;
    form.tackles = current?.tackles ?? 0;
    form.interceptions = current?.interceptions ?? 0;
    form.saves = current?.saves ?? 0;
    form.yellowCards = current?.yellowCards ?? 0;
    form.redCard = current?.redCard ?? false;
    form.message = '';
    error.value = null;
    fieldErrors.value = {};
  },
  { immediate: true },
);

const fields: { key: 'goals' | 'assists' | 'shots' | 'shotsOnTarget' | 'keyPasses' | 'tackles' | 'interceptions' | 'saves'; label: string }[] = [
  { key: 'goals', label: 'Goles' },
  { key: 'assists', label: 'Asistencias de gol' },
  { key: 'shots', label: 'Tiros' },
  { key: 'shotsOnTarget', label: 'Tiros a puerta' },
  { key: 'tackles', label: 'Entradas' },
  { key: 'interceptions', label: 'Intercepciones' },
  { key: 'saves', label: 'Paradas' },
];

const busy = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const title = computed(() => (props.current ? 'Sugerir una corrección de mi línea' : 'Sugerir mi línea de este partido'));

async function submit() {
  if (!props.match) return;
  busy.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    const suggestion = await api.players.suggest({
      matchId: props.match.id,
      started: form.started,
      minutesPlayed: form.minutesPlayed,
      goals: form.goals,
      assists: form.assists,
      shots: form.shots,
      shotsOnTarget: form.shotsOnTarget,
      keyPasses: form.keyPasses,
      tackles: form.tackles,
      interceptions: form.interceptions,
      saves: form.saves,
      yellowCards: form.yellowCards,
      redCard: form.redCard,
      message: form.message.trim() || null,
    });
    emit('sent', suggestion);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="title" size="lg" @close="emit('close')">
    <p v-if="match" class="text-sm text-slate-600">
      Jornada {{ match.matchday }} · {{ opponentLabel }} · {{ formatKickoff(match.kickoffAt) }}.
      <template v-if="current">Propón los valores que creas correctos: tu club o tu entrenador los revisarán antes de cambiar nada.</template>
      <template v-else>El cuerpo técnico no te ha registrado en este partido. Propón tu línea y ellos decidirán si la añaden al acta.</template>
    </p>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>

    <form class="mt-4 space-y-4" @submit.prevent="submit">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label class="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input v-model="form.started" type="checkbox" class="h-4 w-4 rounded border-slate-300 accent-brand-500" />
          Titular
        </label>
        <div class="sm:col-span-2">
          <label class="label" for="sug-minutes">Minutos jugados</label>
          <input id="sug-minutes" v-model.number="form.minutesPlayed" type="number" min="0" max="120" class="input" />
          <p v-if="fieldErrors.minutesPlayed" class="field-error">{{ fieldErrors.minutesPlayed[0] }}</p>
        </div>
        <div v-for="field in fields" :key="field.key">
          <label class="label" :for="`sug-${field.key}`">{{ field.label }}</label>
          <input :id="`sug-${field.key}`" v-model.number="form[field.key]" type="number" min="0" class="input" />
          <p v-if="fieldErrors[field.key]" class="field-error">{{ fieldErrors[field.key]![0] }}</p>
        </div>
        <div>
          <label class="label" for="sug-yellow">Amarillas</label>
          <input id="sug-yellow" v-model.number="form.yellowCards" type="number" min="0" max="2" class="input" />
        </div>
        <label class="flex items-center gap-2 self-end pb-2 text-sm text-slate-700">
          <input v-model="form.redCard" type="checkbox" class="h-4 w-4 rounded border-slate-300 accent-red-600" />
          Roja
        </label>
      </div>

      <div>
        <label class="label" for="sug-message">Mensaje para tu club o tu entrenador</label>
        <textarea id="sug-message" v-model="form.message" rows="3" maxlength="500" class="input" placeholder="Por ejemplo: «Jugué los 90 y marqué el 1-0, en el acta no aparece el gol»." />
        <p v-if="fieldErrors.message" class="field-error">{{ fieldErrors.message[0] }}</p>
      </div>

      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-ghost" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn-primary" v-busy="busy" :disabled="busy">Enviar sugerencia</button>
      </div>
    </form>
  </Modal>
</template>
