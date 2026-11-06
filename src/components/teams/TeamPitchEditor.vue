<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import type { TeamProfileDto } from '@/types/api';

/**
 * Medidas del terreno de juego de un equipo del club (largo × ancho, en metros). La federación no las publica: las
 * apunta el club en la ficha de su equipo y el analizador de vídeo calibra con ellas el campo de los partidos que se
 * juegan en él. Con los dos huecos vacíos se quitan.
 */
const props = defineProps<{ teamId: string; lengthM: number | null | undefined; widthM: number | null | undefined }>();
const emit = defineEmits<{ saved: [profile: TeamProfileDto] }>();

const length = ref<number | '' | null>(null);
const width = ref<number | '' | null>(null);
watch(() => [props.lengthM, props.widthM], () => {
  length.value = props.lengthM ?? null;
  width.value = props.widthM ?? null;
}, { immediate: true });

const value = (input: number | '' | null) => (input === '' || input === null ? null : Number(input));
const dirty = computed(() => value(length.value) !== (props.lengthM ?? null) || value(width.value) !== (props.widthM ?? null));

const saving = ref(false);
const error = ref<string | null>(null);
const done = ref(false);

async function save() {
  saving.value = true;
  error.value = null;
  done.value = false;
  try {
    emit('saved', await api.clubs.setTeamPitch(props.teamId, value(length.value), value(width.value)));
    done.value = true;
  } catch (e) {
    error.value = e instanceof ApiError && Object.keys(e.fieldErrors).length > 0 ? Object.values(e.fieldErrors).flat().join(' ') : errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <form class="mt-2 rounded-lg border border-line bg-surface-2 p-3" @submit.prevent="save">
    <p class="text-xs font-medium text-slate-700">Medidas del terreno de juego</p>
    <div class="mt-2 flex flex-wrap items-end gap-2">
      <label class="block">
        <span class="mb-1 block text-[11px] text-slate-500">Largo (m)</span>
        <input v-model.number="length" type="number" min="60" max="130" step="0.5" inputmode="decimal" class="input w-24 px-2 py-1 text-center" placeholder="100" />
      </label>
      <span class="pb-1.5 text-slate-400" aria-hidden="true">×</span>
      <label class="block">
        <span class="mb-1 block text-[11px] text-slate-500">Ancho (m)</span>
        <input v-model.number="width" type="number" min="35" max="90" step="0.5" inputmode="decimal" class="input w-24 px-2 py-1 text-center" placeholder="62" />
      </label>
      <button type="submit" class="btn-secondary px-3 py-1 text-xs" v-busy="saving" :disabled="saving || !dirty">Guardar medidas</button>
    </div>
    <p v-if="error" class="field-error">{{ error }}</p>
    <p v-else-if="done && !dirty" class="mt-1 text-xs text-emerald-700">Medidas guardadas.</p>
    <p class="mt-2 text-[11px] leading-relaxed text-slate-500">
      Con ellas el analizador de vídeo calibra el campo en los partidos que se juegan aquí (sin ellas usa un campo genérico de 120 × 70 m).
      Deja los dos huecos vacíos para quitarlas.
    </p>
  </form>
</template>
