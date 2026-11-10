<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import TrainingItemsEditor from '@/components/trainings/TrainingItemsEditor.vue';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import type { ExerciseDto, TrainingCatalogDto, TrainingItemInput, TrainingKind, TrainingRequest, Weekday } from '@/types/api';
import { weekdayLabels, weekdays } from '@/utils/format';

/** Crear un entrenamiento (o una serie semanal) con sus ejercicios. */
const props = defineProps<{
  open: boolean;
  squadId: string;
  /** Día propuesto (YYYY-MM-DD), por ejemplo el pulsado en el calendario. */
  date: string | null;
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

watch(() => props.open, (open) => {
  if (!open) return;
  error.value = null;
  items.value = [];
  const date = props.date ?? new Date().toISOString().slice(0, 10);
  const weekday = weekdays[(new Date(`${date}T00:00:00`).getDay() + 6) % 7]!;
  form.value = { kind: 'Season', title: '', date, time: '19:30', durationMinutes: 90, location: '', notes: '', repeat: false, weekdays: [weekday], until: '' };
});

function toggleWeekday(day: Weekday) {
  form.value.weekdays = form.value.weekdays.includes(day) ? form.value.weekdays.filter((d) => d !== day) : [...form.value.weekdays, day];
}

async function submit() {
  busy.value = true;
  error.value = null;
  try {
    const body: TrainingRequest = {
      kind: form.value.kind,
      title: form.value.title.trim() || null,
      startsAt: new Date(`${form.value.date}T${form.value.time || '00:00'}`).toISOString(),
      durationMinutes: form.value.durationMinutes,
      location: form.value.location.trim() || null,
      notes: form.value.notes.trim() || null,
      items: items.value,
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
        <div class="grid grid-cols-[1fr_6rem_5rem] gap-2 sm:col-span-2">
          <div>
            <label class="label" for="pt-date">{{ form.repeat ? 'Desde el día' : 'Día' }}</label>
            <input id="pt-date" v-model="form.date" type="date" required class="input" />
          </div>
          <div>
            <label class="label" for="pt-time">Hora</label>
            <input id="pt-time" v-model="form.time" type="time" required class="input px-2" />
          </div>
          <div>
            <label class="label" for="pt-minutes">Minutos</label>
            <input id="pt-minutes" v-model.number="form.durationMinutes" type="number" :min="catalog?.minDurationMinutes ?? 15" :max="catalog?.maxDurationMinutes ?? 300" required class="input px-2" />
          </div>
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
        <div v-if="form.repeat" class="mt-3 flex flex-wrap items-end gap-3">
          <div class="flex flex-wrap gap-1" role="group" aria-label="Días de la semana">
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
          <div>
            <label class="label" for="pt-until">Hasta el día</label>
            <input id="pt-until" v-model="form.until" type="date" :min="form.date" required class="input" />
          </div>
          <p class="basis-full text-xs text-slate-500">Se crea una sesión por cada día elegido hasta esa fecha (como mucho {{ catalog?.maxSeriesSessions ?? 60 }}); después cada una se edita por separado.</p>
        </div>
      </div>

      <div>
        <h3 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Ejercicios</h3>
        <TrainingItemsEditor v-model="items" :library="library" :exercise-types="exerciseTypes" :max-items="catalog?.maxItems ?? 40" />
      </div>
    </form>

    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="emit('close')">Cancelar</button>
        <button type="submit" form="plan-training" class="btn-primary" v-busy="busy" :disabled="busy || !form.date || (form.repeat && (form.weekdays.length === 0 || !form.until))">
          {{ form.repeat ? 'Crear la serie' : 'Crear el entrenamiento' }}
        </button>
      </div>
    </template>
  </Modal>
</template>
