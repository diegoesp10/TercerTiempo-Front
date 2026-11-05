<script setup lang="ts">
import { computed, ref } from 'vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import type { ExerciseDto, ExerciseType, TrainingItemInput } from '@/types/api';
import { exerciseTypeLabels, formatDurationMinutes } from '@/utils/format';

/**
 * Los ejercicios de una sesión: se añaden desde la biblioteca de la plantilla (copiando nombre, tipo y duración) o
 * sueltos, se ordenan y se les ponen notas. El padre guarda la lista cuando quiera.
 */
const props = withDefaults(
  defineProps<{
    modelValue: TrainingItemInput[];
    library: ExerciseDto[];
    exerciseTypes: { type: ExerciseType; label: string }[];
    maxItems?: number;
    readonly?: boolean;
  }>(),
  { maxItems: 40, readonly: false },
);
const emit = defineEmits<{ 'update:modelValue': [items: TrainingItemInput[]] }>();

const fromLibrary = ref<string | null>(null);
const adHoc = ref<{ name: string; type: ExerciseType; durationMinutes: number }>({ name: '', type: 'Technical', durationMinutes: 15 });

const libraryOptions = computed<SelectOption[]>(() =>
  props.library.map((e) => ({ value: e.id, label: e.name, hint: `${e.typeLabel} · ${formatDurationMinutes(e.durationMinutes)}`, group: e.typeLabel })),
);
const typeOptions = computed<SelectOption[]>(() => props.exerciseTypes.map((t) => ({ value: t.type, label: t.label })));
const total = computed(() => props.modelValue.reduce((sum, i) => sum + i.durationMinutes, 0));
const full = computed(() => props.modelValue.length >= props.maxItems);

function update(items: TrainingItemInput[]) {
  emit('update:modelValue', items);
}

function addFromLibrary() {
  const exercise = props.library.find((e) => e.id === fromLibrary.value);
  if (!exercise || full.value) return;
  update([...props.modelValue, { exerciseId: exercise.id, name: exercise.name, type: exercise.type, durationMinutes: exercise.durationMinutes, notes: null }]);
  fromLibrary.value = null;
}

function addAdHoc() {
  const name = adHoc.value.name.trim();
  if (!name || full.value) return;
  update([...props.modelValue, { exerciseId: null, name, type: adHoc.value.type, durationMinutes: Math.max(1, adHoc.value.durationMinutes || 1), notes: null }]);
  adHoc.value = { name: '', type: adHoc.value.type, durationMinutes: 15 };
}

function patch(index: number, changes: Partial<TrainingItemInput>) {
  update(props.modelValue.map((item, i) => (i === index ? { ...item, ...changes } : item)));
}

function move(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= props.modelValue.length) return;
  const items = [...props.modelValue];
  [items[index], items[target]] = [items[target]!, items[index]!];
  update(items);
}

function remove(index: number) {
  update(props.modelValue.filter((_, i) => i !== index));
}
</script>

<template>
  <div>
    <ol v-if="modelValue.length > 0" class="space-y-2">
      <li v-for="(item, index) in modelValue" :key="index" class="rounded-lg border border-line bg-surface-2 px-3 py-2">
        <div class="flex flex-wrap items-center gap-2">
          <span class="w-6 shrink-0 text-center text-xs font-semibold text-slate-400">{{ index + 1 }}</span>
          <template v-if="readonly">
            <span class="min-w-0 flex-1 font-medium text-slate-900">{{ item.name }}</span>
            <span class="text-xs text-slate-500">{{ exerciseTypeLabels[item.type] }}</span>
            <span class="text-xs font-semibold tabular-nums text-slate-700">{{ formatDurationMinutes(item.durationMinutes) }}</span>
          </template>
          <template v-else>
            <input :value="item.name" type="text" maxlength="120" class="input min-w-0 flex-1 px-2 py-1" aria-label="Nombre del ejercicio" @input="patch(index, { name: ($event.target as HTMLInputElement).value })" />
            <SearchSelect :model-value="item.type" :options="typeOptions" size="sm" aria-label="Tipo de ejercicio" class="w-40" @update:model-value="patch(index, { type: $event as ExerciseType })" />
            <label class="flex items-center gap-1 text-xs text-slate-500">
              <input :value="item.durationMinutes" type="number" min="1" max="300" class="input w-16 px-2 py-1" aria-label="Minutos" @input="patch(index, { durationMinutes: Number(($event.target as HTMLInputElement).value) || 1 })" />
              min
            </label>
            <div class="flex items-center gap-0.5">
              <button type="button" class="btn-ghost px-1.5 py-1" :disabled="index === 0" aria-label="Subir" @click="move(index, -1)"><Icon icon="chevron-left" class="h-3 w-3 rotate-90" /></button>
              <button type="button" class="btn-ghost px-1.5 py-1" :disabled="index === modelValue.length - 1" aria-label="Bajar" @click="move(index, 1)"><Icon icon="chevron-right" class="h-3 w-3 rotate-90" /></button>
              <button type="button" class="btn-ghost px-1.5 py-1 text-red-600 hover:bg-red-50" aria-label="Quitar" @click="remove(index)"><Icon icon="trash" class="h-3 w-3" /></button>
            </div>
          </template>
        </div>
        <p v-if="readonly && item.notes" class="mt-1 pl-8 text-xs text-slate-500">{{ item.notes }}</p>
        <input
          v-else-if="!readonly"
          :value="item.notes ?? ''"
          type="text"
          maxlength="500"
          class="input mt-1.5 ml-8 w-[calc(100%-2rem)] px-2 py-1 text-xs"
          placeholder="Notas para este ejercicio (series, variantes, jugadores…)"
          aria-label="Notas del ejercicio"
          @input="patch(index, { notes: ($event.target as HTMLInputElement).value || null })"
        />
      </li>
    </ol>
    <p v-else class="text-sm text-slate-500">{{ readonly ? 'Sin ejercicios preparados.' : 'Todavía no hay ejercicios: añade los de tu biblioteca o escribe uno suelto.' }}</p>

    <p v-if="modelValue.length > 0" class="mt-2 text-xs text-slate-500">
      {{ modelValue.length }} {{ modelValue.length === 1 ? 'ejercicio' : 'ejercicios' }} · <strong class="text-slate-700">{{ formatDurationMinutes(total) }}</strong> en total
    </p>

    <div v-if="!readonly" class="mt-4 grid gap-3 sm:grid-cols-2">
      <div class="rounded-lg border border-dashed border-line p-3">
        <p class="label">De la biblioteca</p>
        <div class="flex gap-2">
          <SearchSelect v-model="fromLibrary" :options="libraryOptions" placeholder="Elige un ejercicio" :disabled="library.length === 0 || full" class="min-w-0 flex-1" aria-label="Ejercicio de la biblioteca" />
          <button type="button" class="btn-secondary shrink-0 px-3" :disabled="!fromLibrary || full" @click="addFromLibrary"><Icon icon="plus" class="h-3.5 w-3.5" /></button>
        </div>
        <p v-if="library.length === 0" class="mt-1 text-xs text-slate-500">La biblioteca está vacía: crea ejercicios para reutilizarlos en cada sesión.</p>
      </div>
      <form class="rounded-lg border border-dashed border-line p-3" @submit.prevent="addAdHoc">
        <p class="label">Suelto</p>
        <div class="flex flex-wrap gap-2">
          <input v-model="adHoc.name" type="text" maxlength="120" class="input min-w-0 flex-1 basis-32 px-2 py-1.5" placeholder="Nombre" aria-label="Nombre del ejercicio suelto" :disabled="full" />
          <SearchSelect v-model="adHoc.type" :options="typeOptions" size="sm" class="w-36" aria-label="Tipo del ejercicio suelto" :disabled="full" />
          <input v-model.number="adHoc.durationMinutes" type="number" min="1" max="300" class="input w-16 px-2 py-1.5" aria-label="Minutos del ejercicio suelto" :disabled="full" />
          <button type="submit" class="btn-secondary shrink-0 px-3" :disabled="!adHoc.name.trim() || full"><Icon icon="plus" class="h-3.5 w-3.5" /></button>
        </div>
      </form>
    </div>
    <p v-if="!readonly && full" class="mt-2 text-xs text-amber-700">Una sesión admite como mucho {{ maxItems }} ejercicios.</p>
  </div>
</template>
