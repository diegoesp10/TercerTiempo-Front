<script setup lang="ts">
import { computed, ref } from 'vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import type { ExerciseDto, ExerciseType, ExerciseTypeDto, Position, TrainingItemInput } from '@/types/api';
import { exerciseTypeLabels, formatDurationMinutes } from '@/utils/format';

/**
 * Los ejercicios de una sesión: se añaden desde la biblioteca de la plantilla (copiando descripción, tipo y duración) o
 * sueltos, se ordenan, se dice quién los hace (toda la plantilla o solo unas líneas) y se les ponen notas. El padre
 * guarda la lista cuando quiera; la duración de la sesión es la suma de los ejercicios.
 */
const props = withDefaults(
  defineProps<{
    modelValue: TrainingItemInput[];
    library: ExerciseDto[];
    exerciseTypes: ExerciseTypeDto[];
    maxItems?: number;
    readonly?: boolean;
  }>(),
  { maxItems: 40, readonly: false },
);
const emit = defineEmits<{ 'update:modelValue': [items: TrainingItemInput[]] }>();

// Sin ninguna línea marcada (o con las cuatro) lo hace toda la plantilla.
const groups: { position: Position; label: string }[] = [
  { position: 'Goalkeeper', label: 'Porteros' },
  { position: 'Defender', label: 'Defensas' },
  { position: 'Midfielder', label: 'Centrocampistas' },
  { position: 'Forward', label: 'Delanteros' },
];

const fromLibrary = ref<string | null>(null);
const adHoc = ref<{ name: string; type: ExerciseType; durationMinutes: number }>({ name: '', type: 'Technical', durationMinutes: 15 });

const libraryOptions = computed<SelectOption[]>(() =>
  props.library.map((e) => ({ value: e.id, label: e.name, hint: `${e.typeLabel} · ${formatDurationMinutes(e.durationMinutes)}`, group: e.typeLabel })),
);
const typeOptions = computed<SelectOption[]>(() => props.exerciseTypes.map((t) => ({ value: t.type, label: t.label, hint: t.description })));
const total = computed(() => props.modelValue.reduce((sum, i) => sum + i.durationMinutes, 0));
const full = computed(() => props.modelValue.length >= props.maxItems);

const typeDescription = (type: ExerciseType) => props.exerciseTypes.find((t) => t.type === type)?.description ?? '';
const defaultPositions = (type: ExerciseType): Position[] => (type === 'Goalkeeping' ? ['Goalkeeper'] : []);

function whoDoesIt(positions: Position[] | undefined) {
  const chosen = groups.filter((g) => positions?.includes(g.position));
  if (chosen.length === 0 || chosen.length === groups.length) return 'Toda la plantilla';
  const names = chosen.map((g, i) => (i === 0 ? g.label : g.label.toLowerCase()));
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
}

function update(items: TrainingItemInput[]) {
  emit('update:modelValue', items);
}

function addFromLibrary() {
  const exercise = props.library.find((e) => e.id === fromLibrary.value);
  if (!exercise || full.value) return;
  update([...props.modelValue, { exerciseId: exercise.id, name: exercise.name, type: exercise.type, durationMinutes: exercise.durationMinutes, notes: null, positions: defaultPositions(exercise.type) }]);
  fromLibrary.value = null;
}

function addAdHoc() {
  const name = adHoc.value.name.trim();
  if (!name || full.value) return;
  update([...props.modelValue, { exerciseId: null, name, type: adHoc.value.type, durationMinutes: Math.max(1, adHoc.value.durationMinutes || 1), notes: null, positions: defaultPositions(adHoc.value.type) }]);
  adHoc.value = { name: '', type: adHoc.value.type, durationMinutes: 15 };
}

function patch(index: number, changes: Partial<TrainingItemInput>) {
  update(props.modelValue.map((item, i) => (i === index ? { ...item, ...changes } : item)));
}

function toggleGroup(index: number, position: Position | null) {
  const current = props.modelValue[index]?.positions ?? [];
  let next = position === null ? [] : current.includes(position) ? current.filter((p) => p !== position) : [...current, position];
  if (next.length === groups.length) next = [];
  patch(index, { positions: groups.map((g) => g.position).filter((p) => next.includes(p)) });
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
        <template v-if="readonly">
          <div class="flex flex-wrap items-center gap-2">
            <span class="w-6 shrink-0 text-center text-xs font-semibold text-slate-400">{{ index + 1 }}</span>
            <span class="min-w-0 flex-1 font-medium text-slate-900">{{ item.name }}</span>
            <span class="text-xs text-slate-500" :title="typeDescription(item.type)">{{ exerciseTypeLabels[item.type] }}</span>
            <span class="text-xs font-semibold tabular-nums text-slate-700">{{ formatDurationMinutes(item.durationMinutes) }}</span>
          </div>
          <p class="mt-1 pl-8 text-xs text-slate-500">
            <Icon icon="users" class="mr-1 h-3 w-3 text-accent-400" />{{ whoDoesIt(item.positions) }}<template v-if="item.notes"> · {{ item.notes }}</template>
          </p>
        </template>

        <template v-else>
          <div class="flex items-start gap-2">
            <span class="mt-6 w-6 shrink-0 text-center text-xs font-semibold text-slate-400">{{ index + 1 }}</span>
            <div class="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_11rem_4.5rem]">
              <label class="block min-w-0">
                <span class="mb-0.5 block text-[11px] font-medium text-slate-500">Descripción</span>
                <input
                  :value="item.name"
                  type="text"
                  maxlength="120"
                  class="input w-full px-2 py-1"
                  :class="{ 'border-red-400 ring-1 ring-red-300': !item.name.trim() }"
                  placeholder="Qué se hace: rondo 4x2, posesión 6x6…"
                  :aria-invalid="!item.name.trim()"
                  @input="patch(index, { name: ($event.target as HTMLInputElement).value })"
                />
              </label>
              <div class="min-w-0">
                <span class="mb-0.5 block text-[11px] font-medium text-slate-500">Tipo de ejercicio</span>
                <SearchSelect :model-value="item.type" :options="typeOptions" size="sm" aria-label="Tipo de ejercicio" @update:model-value="patch(index, { type: $event as ExerciseType })" />
              </div>
              <label class="block">
                <span class="mb-0.5 block text-[11px] font-medium text-slate-500">Minutos</span>
                <input :value="item.durationMinutes" type="number" min="1" max="300" class="input w-full px-2 py-1" @input="patch(index, { durationMinutes: Number(($event.target as HTMLInputElement).value) || 1 })" />
              </label>
            </div>
            <div class="mt-5 flex items-center gap-0.5">
              <button type="button" class="btn-ghost px-1.5 py-1" :disabled="index === 0" aria-label="Subir" @click="move(index, -1)"><Icon icon="chevron-left" class="h-3 w-3 rotate-90" /></button>
              <button type="button" class="btn-ghost px-1.5 py-1" :disabled="index === modelValue.length - 1" aria-label="Bajar" @click="move(index, 1)"><Icon icon="chevron-right" class="h-3 w-3 rotate-90" /></button>
              <button type="button" class="btn-ghost px-1.5 py-1 text-red-600 hover:bg-red-50" aria-label="Quitar" @click="remove(index)"><Icon icon="trash" class="h-3 w-3" /></button>
            </div>
          </div>
          <div class="mt-1 pl-8">
            <p v-if="!item.name.trim()" class="text-[11px] text-red-600">Escribe qué se hace en este ejercicio.</p>
            <p v-else-if="typeDescription(item.type)" class="text-[11px] text-slate-500">{{ exerciseTypeLabels[item.type] }}: {{ typeDescription(item.type) }}</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-1" role="group" :aria-label="`Quién hace el ejercicio ${index + 1}`">
              <span class="mr-1 text-[11px] font-medium text-slate-500">Quién lo hace</span>
              <button
                type="button"
                class="rounded-full border px-2 py-0.5 text-[11px] font-semibold transition"
                :class="!item.positions?.length ? 'border-brand-500 bg-brand-500 text-white' : 'border-line text-slate-600 hover:bg-surface'"
                :aria-pressed="!item.positions?.length"
                @click="toggleGroup(index, null)"
              >Toda la plantilla</button>
              <button
                v-for="group in groups"
                :key="group.position"
                type="button"
                class="rounded-full border px-2 py-0.5 text-[11px] font-semibold transition"
                :class="item.positions?.includes(group.position) ? 'border-brand-500 bg-brand-500 text-white' : 'border-line text-slate-600 hover:bg-surface'"
                :aria-pressed="!!item.positions?.includes(group.position)"
                @click="toggleGroup(index, group.position)"
              >{{ group.label }}</button>
            </div>
            <input
              :value="item.notes ?? ''"
              type="text"
              maxlength="500"
              class="input mt-1.5 w-full px-2 py-1 text-xs"
              placeholder="Notas para este ejercicio (series, variantes, material…)"
              aria-label="Notas del ejercicio"
              @input="patch(index, { notes: ($event.target as HTMLInputElement).value || null })"
            />
          </div>
        </template>
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
          <button type="button" class="btn-secondary shrink-0 px-3" :disabled="!fromLibrary || full" aria-label="Añadir el ejercicio de la biblioteca" @click="addFromLibrary"><Icon icon="plus" class="h-3.5 w-3.5" /></button>
        </div>
        <p v-if="library.length === 0" class="mt-1 text-xs text-slate-500">La biblioteca está vacía: crea ejercicios para reutilizarlos en cada sesión.</p>
      </div>
      <form class="rounded-lg border border-dashed border-line p-3" @submit.prevent="addAdHoc">
        <p class="label">Suelto</p>
        <div class="flex flex-wrap gap-2">
          <input v-model="adHoc.name" type="text" maxlength="120" class="input min-w-0 flex-1 basis-32 px-2 py-1.5" placeholder="Descripción del ejercicio" aria-label="Descripción del ejercicio suelto" :disabled="full" />
          <SearchSelect v-model="adHoc.type" :options="typeOptions" size="sm" class="w-36" aria-label="Tipo del ejercicio suelto" :disabled="full" />
          <input v-model.number="adHoc.durationMinutes" type="number" min="1" max="300" class="input w-16 px-2 py-1.5" aria-label="Minutos del ejercicio suelto" :disabled="full" />
          <button type="submit" class="btn-secondary shrink-0 px-3" :disabled="!adHoc.name.trim() || full" aria-label="Añadir el ejercicio suelto"><Icon icon="plus" class="h-3.5 w-3.5" /></button>
        </div>
      </form>
    </div>
    <p v-if="!readonly && full" class="mt-2 text-xs text-amber-700">Una sesión admite como mucho {{ maxItems }} ejercicios.</p>
  </div>
</template>
