<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Modal from '@/components/ui/Modal.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { ExerciseDto, ExerciseRequest, ExerciseType, ExerciseTypeDto } from '@/types/api';
import { formatDurationMinutes } from '@/utils/format';
import { exerciseTypeStyle } from './exerciseTypes';

/**
 * Biblioteca de ejercicios de la plantilla: los crea el cuerpo técnico una vez y los mete en las sesiones que quiera.
 * Se toca un ejercicio para editarlo (y borrarlo) en el panel de la derecha; sin ninguno elegido, el panel crea uno.
 */
const props = defineProps<{
  open: boolean;
  squadId: string;
  exercises: ExerciseDto[];
  exerciseTypes: ExerciseTypeDto[];
  readonly: boolean;
}>();
const emit = defineEmits<{ close: []; changed: [exercises: ExerciseDto[]] }>();

const empty = (): ExerciseRequest => ({ name: '', type: 'Technical', durationMinutes: 15, description: null, material: null });
const form = ref<ExerciseRequest>(empty());
const editingId = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const panel = ref<HTMLElement | null>(null);
const nameInput = ref<HTMLInputElement | null>(null);

const editing = computed(() => props.exercises.find((e) => e.id === editingId.value) ?? null);
const quickMinutes = [10, 15, 20, 30];
const typeDescription = computed(() => props.exerciseTypes.find((t) => t.type === form.value.type)?.description ?? '');

// Buscador y filtro por tipo; los grupos salen en el orden del catálogo (calentamiento primero, vuelta a la calma al final).
const query = ref('');
const typeFilter = ref<ExerciseType | null>(null);
const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const counts = computed(() => {
  const map = new Map<ExerciseType, number>();
  for (const e of props.exercises) map.set(e.type, (map.get(e.type) ?? 0) + 1);
  return map;
});
const filterTypes = computed(() => props.exerciseTypes.filter((t) => counts.value.has(t.type)));
const typeChoices = computed(() => [
  { value: 'all', label: 'Todos', count: props.exercises.length },
  ...filterTypes.value.map((t) => ({ value: t.type as string, label: t.label, icon: exerciseTypeStyle[t.type].icon, count: counts.value.get(t.type), title: t.description })),
]);
const filtered = computed(() => {
  const needle = fold(query.value.trim());
  return props.exercises.filter(
    (e) =>
      (!typeFilter.value || e.type === typeFilter.value) &&
      (!needle || fold(`${e.name} ${e.description ?? ''} ${e.material ?? ''}`).includes(needle)),
  );
});
const groups = computed(() =>
  props.exerciseTypes
    .map((t) => ({ ...t, items: filtered.value.filter((e) => e.type === t.type).sort((a, b) => a.name.localeCompare(b.name, 'es')) }))
    .filter((g) => g.items.length > 0),
);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    cancelEdit();
    query.value = '';
    typeFilter.value = null;
  },
);

async function startEdit(exercise: ExerciseDto) {
  if (props.readonly) return;
  editingId.value = exercise.id;
  error.value = null;
  form.value = { name: exercise.name, type: exercise.type, durationMinutes: exercise.durationMinutes, description: exercise.description, material: exercise.material };
  await nextTick();
  panel.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  nameInput.value?.focus({ preventScroll: true });
}

function cancelEdit() {
  editingId.value = null;
  error.value = null;
  form.value = empty();
}

const saveBlocked = computed(() => {
  if (!form.value.name.trim()) return 'Ponle un nombre al ejercicio';
  if (!form.value.durationMinutes || form.value.durationMinutes < 1 || form.value.durationMinutes > 300) return 'La duración va de 1 a 300 minutos';
  return null;
});

async function save() {
  if (saveBlocked.value) return;
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

async function remove() {
  const exercise = editing.value;
  if (!exercise) return;
  if (!(await confirmDialog({ title: `Borrar «${exercise.name}»`, message: 'Las sesiones que ya lo tienen se quedan como están: solo desaparece de la biblioteca.', confirmLabel: 'Borrar', danger: true }))) return;
  busy.value = true;
  error.value = null;
  try {
    emit('changed', await api.trainings.deleteExercise(props.squadId, exercise.id));
    cancelEdit();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" title="Biblioteca de ejercicios" size="xl" @close="emit('close')">
    <template #header>
      <div class="flex min-w-0 items-center gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="book-open" class="h-4 w-4" /></span>
        <div class="min-w-0">
          <h2 class="text-lg font-bold leading-tight text-slate-900">Biblioteca de ejercicios</h2>
          <p class="text-xs text-slate-500">
            {{ exercises.length === 1 ? '1 ejercicio' : `${exercises.length} ejercicios` }} ·
            {{ readonly ? 'los que ha preparado el cuerpo técnico' : 'toca uno para editarlo; los tendrás a mano en cada entrenamiento' }}
          </p>
        </div>
      </div>
    </template>

    <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <!-- Lista -->
      <section class="min-w-0">
        <div v-if="exercises.length > 0" class="mb-3 space-y-2.5">
          <label class="relative block">
            <Icon icon="magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input v-model="query" type="search" class="input w-full pl-9" placeholder="Buscar por nombre, descripción o material" aria-label="Buscar ejercicio" @keydown.esc.stop="query = ''" />
          </label>
          <ChoiceToggle
            v-if="filterTypes.length > 1"
            :options="typeChoices"
            :model-value="typeFilter ?? 'all'"
            label="Filtrar por tipo"
            size="xs"
            min-item="7.5rem"
            @update:model-value="typeFilter = $event === 'all' ? null : ($event as ExerciseType)"
          />
        </div>

        <EmptyState v-if="exercises.length === 0" icon="book-open" title="Todavía no hay ejercicios">
          {{ readonly ? 'Cuando el cuerpo técnico los prepare, saldrán aquí.' : 'Crea el primero con el formulario: lo tendrás a mano en cada entrenamiento.' }}
        </EmptyState>
        <EmptyState v-else-if="groups.length === 0" compact>Ningún ejercicio coincide con la búsqueda.</EmptyState>

        <div v-for="g in groups" :key="g.type" class="mb-4 last:mb-0">
          <h3 class="mb-2 flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500" :title="g.description">
            <span class="grid h-5 w-5 place-items-center rounded-md" :class="exerciseTypeStyle[g.type].chip"><Icon :icon="exerciseTypeStyle[g.type].icon" class="h-2.5 w-2.5" /></span>
            {{ g.label }}
            <span class="font-sans font-medium normal-case tracking-normal text-slate-400">· {{ g.items.length }}</span>
          </h3>
          <ul class="space-y-1.5">
            <li v-for="e in g.items" :key="e.id">
              <component
                :is="readonly ? 'div' : 'button'"
                :type="readonly ? undefined : 'button'"
                class="group flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition"
                :class="[
                  e.id === editingId ? 'border-brand-500 bg-brand-500/5 ring-1 ring-brand-500' : 'border-line bg-surface',
                  readonly ? '' : 'cursor-pointer hover:border-brand-500/50 hover:bg-surface-2 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                ]"
                :title="readonly ? undefined : `Editar «${e.name}»`"
                :aria-pressed="readonly ? undefined : e.id === editingId"
                @click="startEdit(e)"
              >
                <span class="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg" :class="exerciseTypeStyle[e.type].chip">
                  <Icon :icon="exerciseTypeStyle[e.type].icon" class="h-3.5 w-3.5" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex items-start justify-between gap-2">
                    <span class="min-w-0 font-semibold text-slate-900">{{ e.name }}</span>
                    <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium tabular-nums text-slate-600 group-hover:bg-surface">
                      <Icon icon="stopwatch" class="h-2.5 w-2.5" />{{ formatDurationMinutes(e.durationMinutes) }}
                    </span>
                  </span>
                  <span v-if="e.description" class="mt-0.5 block whitespace-pre-line break-words text-xs text-slate-600">{{ e.description }}</span>
                  <span v-if="e.material" class="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500"><Icon icon="toolbox" class="h-2.5 w-2.5 shrink-0" />{{ e.material }}</span>
                </span>
                <Icon
                  v-if="!readonly"
                  :icon="e.id === editingId ? 'pen' : 'chevron-right'"
                  class="mt-2 h-3 w-3 shrink-0 transition"
                  :class="e.id === editingId ? 'text-brand-500' : 'text-slate-300 group-hover:translate-x-0.5 group-hover:text-brand-500'"
                  aria-hidden="true"
                />
              </component>
            </li>
          </ul>
        </div>
      </section>

      <!-- Panel: nuevo o editar -->
      <aside v-if="!readonly" ref="panel" class="scroll-mt-4 lg:sticky lg:top-0 lg:self-start">
        <form class="overflow-hidden rounded-2xl border bg-surface shadow-card" :class="editing ? 'border-brand-500/60' : 'border-line'" @submit.prevent="save">
          <header class="flex items-center justify-between gap-2 border-b border-line px-4 py-3" :class="editing ? 'bg-brand-500/5' : 'bg-surface-2/60'">
            <h3 class="flex min-w-0 items-center gap-2 font-semibold text-slate-900">
              <Icon :icon="editing ? 'pen' : 'plus'" class="h-3.5 w-3.5 shrink-0 text-brand-500" />
              <span class="min-w-0 break-words">{{ editing ? 'Editar ejercicio' : 'Nuevo ejercicio' }}</span>
            </h3>
            <button v-if="editing" type="button" class="btn-ghost btn-sm shrink-0 px-2" title="Dejar de editar y crear uno nuevo" @click="cancelEdit">
              <Icon icon="plus" class="mr-1 h-3 w-3" />Nuevo
            </button>
          </header>

          <div class="space-y-3.5 px-4 py-4">
            <Alert v-if="error" kind="error">{{ error }}</Alert>
            <div>
              <label class="label" for="ex-name">Nombre</label>
              <input id="ex-name" ref="nameInput" v-model="form.name" type="text" required maxlength="120" class="input" placeholder="Rondo 4x2" />
            </div>

            <fieldset>
              <legend class="label">Tipo</legend>
              <!-- De tres en tres solo si «Calentamiento» cabe entero en su casilla; si no, de dos en dos. -->
              <div class="@container">
                <div class="grid grid-cols-2 gap-1.5 @[18rem]:grid-cols-3">
                  <button
                    v-for="t in exerciseTypes"
                    :key="t.type"
                    type="button"
                    class="flex cursor-pointer flex-col items-center gap-1 rounded-lg border px-1 py-2 text-center text-[11px] font-medium leading-tight transition"
                    :class="form.type === t.type ? 'border-brand-500 bg-brand-500/10 text-slate-900 ring-1 ring-brand-500' : 'border-line text-slate-600 hover:bg-surface-2'"
                    :aria-pressed="form.type === t.type"
                    :title="t.description"
                    @click="form.type = t.type"
                  >
                    <span class="grid h-6 w-6 place-items-center rounded-md" :class="exerciseTypeStyle[t.type].chip"><Icon :icon="exerciseTypeStyle[t.type].icon" class="h-3 w-3" /></span>
                    {{ t.label }}
                  </button>
                </div>
              </div>
              <p v-if="typeDescription" class="mt-1.5 text-[11px] text-slate-500">{{ typeDescription }}</p>
            </fieldset>

            <div>
              <label class="label" for="ex-minutes">Duración</label>
              <div class="flex items-center gap-1.5">
                <div class="relative w-24 shrink-0">
                  <input id="ex-minutes" v-model.number="form.durationMinutes" type="number" min="1" max="300" required class="input pr-9" />
                  <span class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">min</span>
                </div>
                <button
                  v-for="m in quickMinutes"
                  :key="m"
                  type="button"
                  class="cursor-pointer rounded-md border px-2 py-1.5 text-xs font-medium tabular-nums transition"
                  :class="form.durationMinutes === m ? 'border-brand-500 bg-brand-500/10 text-slate-900' : 'border-line text-slate-600 hover:bg-surface-2'"
                  :title="`${m} minutos`"
                  @click="form.durationMinutes = m"
                >
                  {{ m }}
                </button>
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
          </div>

          <footer class="flex items-center gap-2 border-t border-line bg-surface-2/60 px-4 py-3">
            <button
              v-if="editing"
              type="button"
              class="btn-ghost-danger px-2.5"
              :disabled="busy"
              :title="busy ? 'Espera a que termine lo que se está guardando' : 'Quitarlo de la biblioteca (las sesiones que lo tienen no cambian)'"
              @click="remove"
            >
              <Icon icon="trash" class="mr-1.5 h-3.5 w-3.5" />Eliminar
            </button>
            <div class="ml-auto flex gap-2">
              <button v-if="editing" type="button" class="btn-ghost" @click="cancelEdit">Cancelar</button>
              <button type="submit" class="btn-primary" v-busy="busy" :disabled="busy || !!saveBlocked" :title="saveBlocked ?? undefined">
                {{ editing ? 'Guardar cambios' : 'Añadir ejercicio' }}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  </Modal>
</template>
