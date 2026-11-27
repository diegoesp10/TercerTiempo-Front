<script setup lang="ts">
import { computed, ref } from 'vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import type { ExerciseDto, ExerciseType, ExerciseTypeDto, Position, TrainingItemInput } from '@/types/api';
import { exerciseTypeLabels, formatDurationMinutes } from '@/utils/format';
import { exerciseTypeStyle } from './exerciseTypes';

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

const typeStyle = (type: ExerciseType) => exerciseTypeStyle[type] ?? exerciseTypeStyle.Other;
const libraryOptions = computed<SelectOption[]>(() =>
  props.library.map((e) => ({
    value: e.id,
    label: e.name,
    hint: `${e.typeLabel} · ${formatDurationMinutes(e.durationMinutes)}`,
    group: e.typeLabel,
    icon: typeStyle(e.type).icon,
    iconClass: typeStyle(e.type).chip,
  })),
);
const typeOptions = computed<SelectOption[]>(() =>
  props.exerciseTypes.map((t) => ({ value: t.type, label: t.label, hint: t.description, icon: typeStyle(t.type).icon, iconClass: typeStyle(t.type).chip })),
);
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
    <ol v-if="modelValue.length > 0" class="space-y-2.5">
      <li v-for="(item, index) in modelValue" :key="index" class="@container rounded-xl border border-line bg-surface-2/60 p-3">
        <!-- Solo lectura: el tipo encima de lo que se hace, y los minutos a la derecha. -->
        <div v-if="readonly" class="flex items-start gap-3">
          <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold tabular-nums text-slate-500 ring-1 ring-line">{{ index + 1 }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span class="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-2xs font-semibold" :class="typeStyle(item.type).chip" :title="typeDescription(item.type)">
                <Icon :icon="typeStyle(item.type).icon" class="h-2.5 w-2.5" />{{ exerciseTypeLabels[item.type] }}
              </span>
              <span class="inline-flex items-center gap-1 text-xs font-semibold tabular-nums text-slate-700">
                <Icon icon="stopwatch" class="h-3 w-3 text-slate-400" />{{ formatDurationMinutes(item.durationMinutes) }}
              </span>
            </div>
            <p class="mt-1 break-words font-medium text-slate-900">{{ item.name }}</p>
            <p class="mt-1 text-xs text-slate-500">
              <Icon icon="users" class="mr-1 h-3 w-3 text-accent-400" />{{ whoDoesIt(item.positions) }}<template v-if="item.notes"> · {{ item.notes }}</template>
            </p>
          </div>
        </div>

        <template v-else>
          <!-- Número, tipo y orden. El tipo va encima de la descripción; en estrecho baja a su propia línea para no encogerse. -->
          <div class="flex flex-wrap items-end gap-x-3 gap-y-2">
            <span class="mb-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface text-xs font-bold tabular-nums text-slate-500 ring-1 ring-line">{{ index + 1 }}</span>
            <div class="order-last min-w-0 basis-full @sm:order-none @sm:max-w-sm @sm:flex-1 @sm:basis-auto">
              <span class="mb-1 block text-xs font-medium text-slate-500">Tipo de ejercicio</span>
              <SearchSelect
                :model-value="item.type"
                :options="typeOptions"
                hint-as-description
                :searchable="false"
                :aria-label="`Tipo del ejercicio ${index + 1}`"
                @update:model-value="patch(index, { type: $event as ExerciseType })"
              />
            </div>
            <div class="mb-1 ml-auto flex shrink-0 items-center gap-0.5">
              <button type="button" class="btn-ghost h-8 w-8 p-0" :disabled="index === 0" title="Subir" aria-label="Subir" @click="move(index, -1)"><Icon icon="chevron-up" class="h-3 w-3" /></button>
              <button type="button" class="btn-ghost h-8 w-8 p-0" :disabled="index === modelValue.length - 1" title="Bajar" aria-label="Bajar" @click="move(index, 1)"><Icon icon="chevron-down" class="h-3 w-3" /></button>
              <button type="button" class="btn-ghost-danger h-8 w-8 p-0" title="Quitar el ejercicio" aria-label="Quitar" @click="remove(index)"><Icon icon="trash" class="h-3 w-3" /></button>
            </div>
          </div>

          <div class="mt-1.5 space-y-3 @sm:pl-10">
            <p v-if="typeDescription(item.type)" class="text-xs text-slate-500">{{ typeDescription(item.type) }}</p>
            <div>
              <div class="flex flex-wrap items-end gap-x-3 gap-y-2">
                <label class="block min-w-0 flex-1 basis-48">
                  <span class="mb-1 block text-xs font-medium text-slate-500">Descripción</span>
                  <input
                    :value="item.name"
                    type="text"
                    maxlength="120"
                    class="input"
                    :class="{ 'border-danger ring-1 ring-danger/40': !item.name.trim() }"
                    placeholder="Qué se hace: rondo 4x2…"
                    :aria-invalid="!item.name.trim()"
                    @input="patch(index, { name: ($event.target as HTMLInputElement).value })"
                  />
                </label>
                <label class="block w-24 shrink-0">
                  <span class="mb-1 block text-xs font-medium text-slate-500">Minutos</span>
                  <span class="relative block">
                    <input
                      :value="item.durationMinutes"
                      type="number"
                      min="1"
                      max="300"
                      class="input pl-2.5 pr-10 tabular-nums"
                      @input="patch(index, { durationMinutes: Number(($event.target as HTMLInputElement).value) || 1 })"
                    />
                    <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">min</span>
                  </span>
                </label>
              </div>
              <p v-if="!item.name.trim()" class="mt-1 text-xs text-danger">Escribe qué se hace en este ejercicio.</p>
            </div>
            <div class="flex flex-wrap items-center gap-1.5" role="group" :aria-label="`Quién hace el ejercicio ${index + 1}`">
              <span class="mr-0.5 text-xs font-medium text-slate-500">Quién lo hace</span>
              <button
                type="button"
                class="rounded-full border px-2.5 py-0.5 text-xs font-semibold transition"
                :class="!item.positions?.length ? 'border-action bg-action text-white' : 'border-line bg-surface text-slate-600 hover:border-brand-400 hover:text-slate-900'"
                :aria-pressed="!item.positions?.length"
                @click="toggleGroup(index, null)"
              >Toda la plantilla</button>
              <button
                v-for="group in groups"
                :key="group.position"
                type="button"
                class="rounded-full border px-2.5 py-0.5 text-xs font-semibold transition"
                :class="item.positions?.includes(group.position) ? 'border-action bg-action text-white' : 'border-line bg-surface text-slate-600 hover:border-brand-400 hover:text-slate-900'"
                :aria-pressed="!!item.positions?.includes(group.position)"
                @click="toggleGroup(index, group.position)"
              >{{ group.label }}</button>
            </div>
            <input
              :value="item.notes ?? ''"
              type="text"
              maxlength="500"
              class="input py-1.5 text-xs"
              placeholder="Notas: series, variantes…"
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
      <section class="rounded-xl border border-dashed border-line p-3">
        <h4 class="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-500/10 text-brand-500"><Icon icon="book-open" class="h-3 w-3" /></span>
          De la biblioteca
        </h4>
        <span class="mb-1 block text-xs font-medium text-slate-500">Ejercicio</span>
        <!-- Si al lado del botón el desplegable no cabe entero, el botón baja a la línea siguiente. -->
        <div class="flex flex-wrap items-start gap-2">
          <SearchSelect
            v-model="fromLibrary"
            :options="libraryOptions"
            hint-as-description
            placeholder="Elige un ejercicio"
            :disabled="library.length === 0 || full"
            class="min-w-0 flex-1 basis-44"
            aria-label="Ejercicio de la biblioteca"
          />
          <button type="button" class="btn-secondary ml-auto shrink-0 px-3" :disabled="!fromLibrary || full" aria-label="Añadir el ejercicio de la biblioteca" @click="addFromLibrary">
            <Icon icon="plus" class="h-3 w-3" />Añadir
          </button>
        </div>
        <p class="mt-2 text-xs text-slate-500">
          {{ library.length === 0 ? 'La biblioteca está vacía: crea ejercicios para reutilizarlos en cada sesión.' : 'Se copian la descripción, el tipo y los minutos; aquí los cambias sin tocar la biblioteca.' }}
        </p>
      </section>

      <form class="rounded-xl border border-dashed border-line p-3" @submit.prevent="addAdHoc">
        <h4 class="mb-2.5 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <span class="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-brand-500/10 text-brand-500"><Icon icon="pen" class="h-3 w-3" /></span>
          Suelto
        </h4>
        <div class="space-y-3">
          <div>
            <span class="mb-1 block text-xs font-medium text-slate-500">Tipo de ejercicio</span>
            <SearchSelect v-model="adHoc.type" :options="typeOptions" hint-as-description :searchable="false" aria-label="Tipo del ejercicio suelto" :disabled="full" />
            <p v-if="typeDescription(adHoc.type)" class="mt-1 text-xs text-slate-500">{{ typeDescription(adHoc.type) }}</p>
          </div>
          <div class="flex flex-wrap items-end gap-x-3 gap-y-2">
            <label class="block min-w-0 flex-1 basis-48">
              <span class="mb-1 block text-xs font-medium text-slate-500">Descripción</span>
              <input v-model="adHoc.name" type="text" maxlength="120" class="input" placeholder="Qué se hace: rondo 4x2…" aria-label="Descripción del ejercicio suelto" :disabled="full" />
            </label>
            <label class="block w-24 shrink-0">
              <span class="mb-1 block text-xs font-medium text-slate-500">Minutos</span>
              <span class="relative block">
                <input v-model.number="adHoc.durationMinutes" type="number" min="1" max="300" class="input pl-2.5 pr-10 tabular-nums" aria-label="Minutos del ejercicio suelto" :disabled="full" />
                <span class="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">min</span>
              </span>
            </label>
            <button type="submit" class="btn-secondary ml-auto shrink-0 px-3" :disabled="!adHoc.name.trim() || full" aria-label="Añadir el ejercicio suelto">
              <Icon icon="plus" class="h-3 w-3" />Añadir
            </button>
          </div>
        </div>
      </form>
    </div>
    <p v-if="!readonly && full" class="mt-2 text-xs text-warning">Una sesión admite como mucho {{ maxItems }} ejercicios.</p>
  </div>
</template>
