<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import TrainingItemsEditor from '@/components/trainings/TrainingItemsEditor.vue';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import type { ExerciseDto, TrainingCatalogDto, TrainingItemInput, TrainingKind, TrainingRequest, Weekday } from '@/types/api';
import { formatDurationMinutes, weekdayLabels, weekdays } from '@/utils/format';

/**
 * Crear un entrenamiento (o una serie semanal) con sus ejercicios. Con ejercicios, la duración es su suma y no se
 * escribe; sin ellos, la pone el técnico. Mientras falte algo, el pie dice qué y lleva al campo.
 */
const props = defineProps<{
  open: boolean;
  squadId: string;
  /** Día propuesto (YYYY-MM-DD), por ejemplo el pulsado en el calendario. */
  date: string | null;
  /** Hora propuesta (HH:mm), la del hueco pulsado en las vistas por horas del calendario. */
  time?: string | null;
  library: ExerciseDto[];
  catalog: TrainingCatalogDto | null;
}>();
const emit = defineEmits<{ close: []; created: [count: number] }>();

const form = ref({ kind: 'Season' as TrainingKind, title: '', date: '', time: '19:30', durationMinutes: 90, location: '', notes: '', repeat: false, weekdays: [] as Weekday[], until: '' });
const items = ref<TrainingItemInput[]>([]);
const busy = ref(false);
const error = ref<string | null>(null);

const kindOptions = computed<SelectOption[]>(() => (props.catalog?.kinds ?? []).map((k) => ({ value: k.kind, label: k.label, hint: k.description })));
const exerciseTypes = computed(() => props.catalog?.exerciseTypes ?? []);
const minMinutes = computed(() => props.catalog?.minDurationMinutes ?? 15);
const maxMinutes = computed(() => props.catalog?.maxDurationMinutes ?? 300);
const maxSessions = computed(() => props.catalog?.maxSeriesSessions ?? 60);

const plannedMinutes = computed(() => items.value.reduce((sum, i) => sum + (i.durationMinutes || 0), 0));
const fromExercises = computed(() => items.value.length > 0);
const duration = computed(() => (fromExercises.value ? plannedMinutes.value : Number(form.value.durationMinutes) || 0));

// Mismo cálculo que la API: cada día elegido desde el primero hasta «Hasta el día», ambos incluidos.
const seriesCount = computed(() => {
  const { repeat, date, until, weekdays: chosen } = form.value;
  if (!repeat || !date || !until || until < date || chosen.length === 0) return 0;
  const [y, m, d] = date.split('-').map(Number);
  const day = new Date(y!, m! - 1, d!);
  let count = 0;
  for (let key = date; key <= until && count <= maxSessions.value; ) {
    if (chosen.includes(weekdays[(day.getDay() + 6) % 7]!)) count++;
    day.setDate(day.getDate() + 1);
    key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
  }
  return count;
});

const missing = computed(() => ({
  date: !form.value.date,
  time: !form.value.time,
  weekdays: form.value.repeat && form.value.weekdays.length === 0,
  until: form.value.repeat && (!form.value.until || (!!form.value.date && form.value.until < form.value.date)),
  duration: duration.value < minMinutes.value || duration.value > maxMinutes.value,
}));

const blockers = computed(() => {
  const list: { text: string; field?: string }[] = [];
  const f = form.value;
  if (!f.date) list.push({ text: f.repeat ? 'Falta «Desde el día»: el primer día de la serie.' : 'Falta el día del entrenamiento.', field: 'pt-date' });
  if (!f.time) list.push({ text: 'Falta la hora.', field: 'pt-time' });
  if (f.repeat) {
    if (f.weekdays.length === 0) list.push({ text: 'Elige al menos un día de la semana para repetir.', field: 'pt-weekdays' });
    if (!f.until) list.push({ text: 'Falta «Hasta el día»: la fecha en que termina la serie.', field: 'pt-until' });
    else if (f.date && f.until < f.date) list.push({ text: '«Hasta el día» es anterior a «Desde el día».', field: 'pt-until' });
    else if (f.date && f.weekdays.length > 0 && seriesCount.value === 0) list.push({ text: 'Entre esas dos fechas no cae ninguno de los días elegidos.', field: 'pt-until' });
    else if (seriesCount.value > maxSessions.value) list.push({ text: `Salen más de ${maxSessions.value} sesiones, el máximo de una serie: acerca «Hasta el día» o quita días.`, field: 'pt-until' });
  }
  if (missing.value.duration) {
    const range = `entre ${formatDurationMinutes(minMinutes.value)} y ${formatDurationMinutes(maxMinutes.value)}`;
    list.push(fromExercises.value
      ? { text: `Los ejercicios suman ${formatDurationMinutes(duration.value)} y una sesión tiene que durar ${range}: ajusta sus minutos.` }
      : { text: `La duración tiene que estar ${range}.`, field: 'pt-minutes' });
  }
  const unnamed = items.value.flatMap((item, i) => (item.name.trim() ? [] : [i + 1]));
  if (unnamed.length === 1) list.push({ text: `El ejercicio ${unnamed[0]} no tiene descripción.` });
  else if (unnamed.length > 1) list.push({ text: `Los ejercicios ${unnamed.slice(0, -1).join(', ')} y ${unnamed[unnamed.length - 1]} no tienen descripción.` });
  return list;
});

const action = computed(() => (form.value.repeat ? 'crear la serie' : 'crear el entrenamiento'));

watch(() => props.open, (open) => {
  if (!open) return;
  error.value = null;
  items.value = [];
  const date = props.date ?? new Date().toISOString().slice(0, 10);
  const weekday = weekdays[(new Date(`${date}T00:00:00`).getDay() + 6) % 7]!;
  form.value = { kind: 'Season', title: '', date, time: props.time ?? '19:30', durationMinutes: 90, location: '', notes: '', repeat: false, weekdays: [weekday], until: '' };
});

function toggleWeekday(day: Weekday) {
  form.value.weekdays = form.value.weekdays.includes(day) ? form.value.weekdays.filter((d) => d !== day) : [...form.value.weekdays, day];
}

async function goTo(field: string | undefined) {
  if (!field) return;
  await nextTick();
  const el = document.getElementById(field);
  el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  (el?.matches('input, select, textarea, button') ? el : el?.querySelector<HTMLElement>('input, button'))?.focus({ preventScroll: true });
}

async function submit() {
  if (blockers.value.length > 0) return;
  busy.value = true;
  error.value = null;
  try {
    const body: TrainingRequest = {
      kind: form.value.kind,
      title: form.value.title.trim() || null,
      startsAt: new Date(`${form.value.date}T${form.value.time || '00:00'}`).toISOString(),
      durationMinutes: duration.value,
      location: form.value.location.trim() || null,
      notes: form.value.notes.trim() || null,
      items: items.value.map((i) => ({ ...i, name: i.name.trim() })),
      repeatWeekdays: form.value.repeat ? form.value.weekdays : [],
      repeatUntil: form.value.repeat ? form.value.until || null : null,
    };
    const created = await api.trainings.plan(props.squadId, body);
    emit('created', created.length);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" title="Nuevo entrenamiento" size="xl" @close="emit('close')">
    <form id="plan-training" class="space-y-5" @submit.prevent="submit">
      <Alert v-if="error" kind="error">{{ error }}</Alert>

      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="pt-kind">Tipo</label>
          <SearchSelect id="pt-kind" v-model="form.kind" :options="kindOptions" />
        </div>
        <div>
          <label class="label" for="pt-title">Título</label>
          <input id="pt-title" v-model="form.title" type="text" maxlength="120" class="input" placeholder="Si lo dejas vacío, el tipo" />
        </div>
        <div class="sm:col-span-2">
          <div class="grid grid-cols-[1fr_6rem_6rem] gap-2">
            <div>
              <label class="label" for="pt-date">{{ form.repeat ? 'Desde el día' : 'Día' }}</label>
              <input id="pt-date" v-model="form.date" type="date" class="input" :class="{ 'border-red-400 ring-1 ring-red-300': missing.date }" :aria-invalid="missing.date" />
            </div>
            <div>
              <label class="label" for="pt-time">Hora</label>
              <input id="pt-time" v-model="form.time" type="time" class="input px-2" :class="{ 'border-red-400 ring-1 ring-red-300': missing.time }" :aria-invalid="missing.time" />
            </div>
            <div>
              <label class="label" for="pt-minutes">Minutos</label>
              <input
                v-if="fromExercises"
                id="pt-minutes"
                :value="plannedMinutes"
                type="number"
                readonly
                tabindex="-1"
                class="input cursor-default bg-surface-2 px-2 font-semibold tabular-nums"
                :class="{ 'border-red-400 ring-1 ring-red-300': missing.duration }"
                title="La suma de los minutos de los ejercicios"
                aria-describedby="pt-minutes-hint"
              />
              <input
                v-else
                id="pt-minutes"
                v-model.number="form.durationMinutes"
                type="number"
                :min="minMinutes"
                :max="maxMinutes"
                class="input px-2"
                :class="{ 'border-red-400 ring-1 ring-red-300': missing.duration }"
                aria-describedby="pt-minutes-hint"
              />
            </div>
          </div>
          <p id="pt-minutes-hint" class="mt-1 text-xs text-slate-500">
            <template v-if="fromExercises">
              <Icon icon="clock" class="mr-1 h-3 w-3 text-accent-400" />Dura <strong class="text-slate-700">{{ formatDurationMinutes(plannedMinutes) }}</strong>: la suma de
              {{ items.length === 1 ? 'su ejercicio' : `sus ${items.length} ejercicios` }}. Cambia los minutos de cada ejercicio para ajustarla.
            </template>
            <template v-else>Sin ejercicios, pon tú los minutos. En cuanto añadas uno, la duración será la suma de los ejercicios.</template>
          </p>
        </div>
        <div>
          <label class="label" for="pt-location">Lugar</label>
          <input id="pt-location" v-model="form.location" type="text" maxlength="150" class="input" placeholder="Campo, pabellón…" />
        </div>
        <div>
          <label class="label" for="pt-notes">Notas</label>
          <input id="pt-notes" v-model="form.notes" type="text" maxlength="2000" class="input" placeholder="Lo que la plantilla debe saber" />
        </div>
      </div>

      <div class="rounded-lg border border-line p-3">
        <label class="flex items-center gap-2 text-sm font-medium text-slate-800">
          <input v-model="form.repeat" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" />
          Repetir cada semana
        </label>
        <div v-if="form.repeat" class="mt-3 flex flex-wrap items-start gap-3">
          <div>
            <span class="label">Días</span>
            <div id="pt-weekdays" class="flex flex-wrap gap-1 rounded-lg" :class="{ 'ring-2 ring-red-300 ring-offset-2': missing.weekdays }" role="group" aria-label="Días de la semana">
              <button
                v-for="day in weekdays"
                :key="day"
                type="button"
                class="rounded-lg border px-2.5 py-1 text-xs font-semibold transition"
                :class="form.weekdays.includes(day) ? 'border-brand-500 bg-brand-500 text-white' : 'border-line text-slate-600 hover:bg-surface-2'"
                :aria-pressed="form.weekdays.includes(day)"
                @click="toggleWeekday(day)"
              >{{ weekdayLabels[day].slice(0, 3) }}</button>
            </div>
            <p v-if="missing.weekdays" class="mt-1 text-xs text-red-600">Elige al menos un día.</p>
          </div>
          <div>
            <label class="label" for="pt-until">Hasta el día</label>
            <input id="pt-until" v-model="form.until" type="date" :min="form.date" class="input" :class="{ 'border-red-400 ring-1 ring-red-300': missing.until }" :aria-invalid="missing.until" />
            <p v-if="!form.until" class="mt-1 text-xs text-red-600">Pon la fecha en que termina la serie.</p>
            <p v-else-if="missing.until" class="mt-1 text-xs text-red-600">Tiene que ser igual o posterior a «Desde el día».</p>
          </div>
          <p v-if="seriesCount > 0" class="basis-full text-xs font-medium" :class="seriesCount > maxSessions ? 'text-red-600' : 'text-emerald-700'">
            <template v-if="seriesCount > maxSessions">Salen más de {{ maxSessions }} sesiones, el máximo de una serie.</template>
            <template v-else>Se crearán {{ seriesCount }} {{ seriesCount === 1 ? 'sesión' : 'sesiones' }}.</template>
          </p>
          <p class="basis-full text-xs text-slate-500">Se crea una sesión por cada día elegido hasta esa fecha (como mucho {{ maxSessions }}); después cada una se edita por separado.</p>
          <p class="basis-full text-xs text-slate-500">A cada jugador con cuenta le llega una sola citación por toda la serie.</p>
        </div>
      </div>

      <p class="text-xs text-slate-500"><Icon icon="bell" class="mr-1 h-3 w-3 text-accent-400" />Se cita a toda la plantilla: los jugadores con cuenta reciben la citación en su campanita y solo avisan si faltan.</p>

      <div>
        <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Ejercicios</h3>
        <TrainingItemsEditor v-model="items" :library="library" :exercise-types="exerciseTypes" :max-items="catalog?.maxItems ?? 40" />
      </div>
    </form>

    <template #footer>
      <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div v-if="blockers.length" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 sm:max-w-md" role="status" aria-live="polite">
          <p class="font-semibold"><Icon icon="triangle-exclamation" class="mr-1 h-3 w-3" />Aún no se puede {{ action }}:</p>
          <ul class="mt-1 list-disc space-y-0.5 pl-4">
            <li v-for="blocker in blockers" :key="blocker.text">
              <button v-if="blocker.field" type="button" class="text-left underline decoration-dotted underline-offset-2 hover:text-amber-950" @click="goTo(blocker.field)">{{ blocker.text }}</button>
              <span v-else>{{ blocker.text }}</span>
            </li>
          </ul>
        </div>
        <span v-else class="hidden sm:block" />
        <div class="flex shrink-0 justify-end gap-2">
          <button type="button" class="btn-ghost" @click="emit('close')">Cancelar</button>
          <button
            type="submit"
            form="plan-training"
            class="btn-primary"
            v-busy="busy"
            :disabled="busy || blockers.length > 0"
            :title="blockers.length ? `Aún no se puede ${action}: ${blockers.map((b) => b.text).join(' ')}` : undefined"
          >
            {{ form.repeat ? 'Crear la serie' : 'Crear el entrenamiento' }}
          </button>
        </div>
      </div>
    </template>
  </Modal>
</template>
