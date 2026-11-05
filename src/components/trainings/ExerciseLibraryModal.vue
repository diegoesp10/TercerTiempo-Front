<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { ExerciseDto, ExerciseRequest, ExerciseType } from '@/types/api';
import { formatDurationMinutes } from '@/utils/format';

/** Biblioteca de ejercicios de la plantilla: los crea el cuerpo técnico una vez y los mete en las sesiones que quiera. */
const props = defineProps<{
  open: boolean;
  squadId: string;
  exercises: ExerciseDto[];
  exerciseTypes: { type: ExerciseType; label: string }[];
  readonly: boolean;
}>();
const emit = defineEmits<{ close: []; changed: [exercises: ExerciseDto[]] }>();

const empty = (): ExerciseRequest => ({ name: '', type: 'Technical', durationMinutes: 15, description: null, material: null });
const form = ref<ExerciseRequest>(empty());
const editingId = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);

const typeOptions = computed<SelectOption[]>(() => props.exerciseTypes.map((t) => ({ value: t.type, label: t.label })));
const grouped = computed(() => {
  const groups = new Map<string, ExerciseDto[]>();
  for (const e of props.exercises) groups.set(e.typeLabel, [...(groups.get(e.typeLabel) ?? []), e]);
  return [...groups.entries()];
});

function startEdit(exercise: ExerciseDto) {
  editingId.value = exercise.id;
  form.value = { name: exercise.name, type: exercise.type, durationMinutes: exercise.durationMinutes, description: exercise.description, material: exercise.material };
}

function cancelEdit() {
  editingId.value = null;
  form.value = empty();
}

async function save() {
  busy.value = true;
  error.value = null;
  try {
    const body: ExerciseRequest = { ...form.value, name: form.value.name.trim(), description: form.value.description?.trim() || null, material: form.value.material?.trim() || null };
    const list = editingId.value ? await api.trainings.updateExercise(props.squadId, editingId.value, body) : await api.trainings.createExercise(props.squadId, body);
    emit('changed', list);
    cancelEdit();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function remove(exercise: ExerciseDto) {
  if (!(await confirmDialog({ title: `Borrar «${exercise.name}»`, message: 'Las sesiones que ya lo tienen se quedan como están: solo desaparece de la biblioteca.', confirmLabel: 'Borrar', danger: true }))) return;
  busy.value = true;
  error.value = null;
  try {
    emit('changed', await api.trainings.deleteExercise(props.squadId, exercise.id));
    if (editingId.value === exercise.id) cancelEdit();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" title="Biblioteca de ejercicios" size="xl" @close="emit('close')">
    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div>
        <p v-if="exercises.length === 0" class="text-sm text-slate-500">Todavía no hay ejercicios. Los que crees aquí los tendrás a mano en cada entrenamiento.</p>
        <div v-for="[label, items] in grouped" :key="label" class="mb-4">
          <h3 class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{{ label }}</h3>
          <ul class="divide-y divide-line rounded-lg border border-line">
            <li v-for="e in items" :key="e.id" class="flex flex-wrap items-start justify-between gap-2 px-3 py-2" :class="e.id === editingId ? 'bg-brand-500/5' : ''">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-slate-900">{{ e.name }} <span class="text-xs font-normal text-slate-500">· {{ formatDurationMinutes(e.durationMinutes) }}</span></p>
                <p v-if="e.description" class="text-xs text-slate-600">{{ e.description }}</p>
                <p v-if="e.material" class="text-xs text-slate-500">Material: {{ e.material }}</p>
              </div>
              <div v-if="!readonly" class="flex shrink-0 gap-1">
                <button type="button" class="btn-ghost px-2 py-1" aria-label="Editar" @click="startEdit(e)"><Icon icon="pen" class="h-3.5 w-3.5" /></button>
                <button type="button" class="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50" aria-label="Borrar" :disabled="busy" @click="remove(e)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
              </div>
            </li>
          </ul>
        </div>
      </div>

      <form v-if="!readonly" class="card h-fit space-y-3" @submit.prevent="save">
        <h3 class="font-semibold text-slate-900">{{ editingId ? 'Editar ejercicio' : 'Nuevo ejercicio' }}</h3>
        <Alert v-if="error" kind="error">{{ error }}</Alert>
        <div>
          <label class="label" for="ex-name">Nombre</label>
          <input id="ex-name" v-model="form.name" type="text" required maxlength="120" class="input" placeholder="Rondo 4x2" />
        </div>
        <div class="grid grid-cols-[1fr_5rem] gap-2">
          <div>
            <label class="label" for="ex-type">Tipo</label>
            <SearchSelect id="ex-type" v-model="form.type" :options="typeOptions" />
          </div>
          <div>
            <label class="label" for="ex-minutes">Minutos</label>
            <input id="ex-minutes" v-model.number="form.durationMinutes" type="number" min="1" max="300" required class="input px-2" />
          </div>
        </div>
        <div>
          <label class="label" for="ex-desc">Descripción</label>
          <textarea id="ex-desc" v-model="form.description" rows="3" maxlength="1000" class="input" placeholder="Cómo se hace, qué se trabaja…"></textarea>
        </div>
        <div>
          <label class="label" for="ex-material">Material</label>
          <input id="ex-material" v-model="form.material" type="text" maxlength="300" class="input" placeholder="Conos, petos, balones…" />
        </div>
        <div class="flex justify-end gap-2">
          <button v-if="editingId" type="button" class="btn-ghost" @click="cancelEdit">Cancelar</button>
          <button type="submit" class="btn-primary" v-busy="busy" :disabled="busy || !form.name.trim()">{{ editingId ? 'Guardar' : 'Añadir' }}</button>
        </div>
      </form>
    </div>
  </Modal>
</template>
