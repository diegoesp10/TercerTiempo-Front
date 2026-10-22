<script setup lang="ts">
import { computed, onMounted, reactive, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import type { InjuryDto, InjuryRequest, InjuryType, InjuryTypeDto, SquadPlayerDto } from '@/types/api';
import { formatDate } from '@/utils/format';

// Control de lesionados de la plantilla: lesiones abiertas con motivo, fechas y días de baja, alta e historial.
// Opcional para el cuerpo técnico; los jugadores vinculados lo ven sin poder tocarlo.
const props = defineProps<{ squadId: string; players: SquadPlayerDto[]; canManage: boolean }>();
const emit = defineEmits<{ changed: [] }>();

const injuries = shallowRef<InjuryDto[]>([]);
const types = shallowRef<InjuryTypeDto[]>([]);
const loading = ref(true);
const loadError = ref<string | null>(null);

async function load() {
  loading.value = true;
  loadError.value = null;
  try {
    [injuries.value, types.value] = await Promise.all([api.squads.injuries(props.squadId), types.value.length ? Promise.resolve(types.value) : api.squads.injuryTypes()]);
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(() => props.squadId, load);

const active = computed(() => injuries.value.filter((i) => i.active));
const history = computed(() => injuries.value.filter((i) => !i.active));

const busy = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

async function act(fn: () => Promise<InjuryDto[]>) {
  busy.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    injuries.value = await fn();
    emit('changed');
    return true;
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
    return false;
  } finally {
    busy.value = false;
  }
}

// --- Formulario (alta de lesión o corrección) ---
const localDay = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDay(date);
};

const form = reactive<{ squadPlayerId: string | null; type: InjuryType | null; reason: string; startedOn: string; expectedReturnOn: string }>({
  squadPlayerId: null,
  type: null,
  reason: '',
  startedOn: localDay(),
  expectedReturnOn: '',
});
const editing = ref<InjuryDto | null>(null);
const formOpen = ref(false);

const playerOptions = computed<SelectOption[]>(() => {
  const injured = new Set(active.value.map((i) => i.squadPlayerId));
  return props.players
    .filter((p) => p.status === 'Active')
    .map((p) => ({ value: p.id, label: p.fullName, hint: p.shirtNumber ? `#${p.shirtNumber}` : undefined, disabled: injured.has(p.id) && editing.value?.squadPlayerId !== p.id }));
});
const typeOptions = computed<SelectOption[]>(() =>
  types.value.map((t) => ({ value: t.type, label: t.label, hint: t.averageDays ? `≈ ${t.averageDays} días` : 'sin referencia' })),
);
const selectedType = computed(() => types.value.find((t) => t.type === form.type) ?? null);

// Al elegir tipo o cambiar el inicio se propone la vuelta con la duración media; el técnico puede corregirla.
function proposeReturn() {
  const days = selectedType.value?.averageDays;
  form.expectedReturnOn = days && form.startedOn ? addDays(form.startedOn, days) : '';
}

function openNew(playerId: string | null = null) {
  editing.value = null;
  form.squadPlayerId = playerId;
  form.type = null;
  form.reason = '';
  form.startedOn = localDay();
  form.expectedReturnOn = '';
  error.value = null;
  fieldErrors.value = {};
  formOpen.value = true;
}

function openEdit(injury: InjuryDto) {
  editing.value = injury;
  form.squadPlayerId = injury.squadPlayerId;
  form.type = injury.type;
  form.reason = injury.reason ?? '';
  form.startedOn = injury.startedOn;
  form.expectedReturnOn = injury.expectedReturnOn ?? '';
  error.value = null;
  fieldErrors.value = {};
  formOpen.value = true;
}

const request = (): InjuryRequest => ({
  squadPlayerId: form.squadPlayerId,
  type: form.type as InjuryType,
  reason: form.reason.trim() || null,
  startedOn: form.startedOn,
  expectedReturnOn: form.expectedReturnOn || null,
});

async function save() {
  if (!form.type || !form.startedOn || (!editing.value && !form.squadPlayerId)) return;
  const ok = editing.value
    ? await act(() => api.squads.updateInjury(props.squadId, editing.value!.id, request()))
    : await act(() => api.squads.recordInjury(props.squadId, request()));
  if (ok) formOpen.value = false;
}

function close(injury: InjuryDto) {
  void act(() => api.squads.closeInjury(props.squadId, injury.id, localDay()));
}

function reopen(injury: InjuryDto) {
  void act(() => api.squads.reopenInjury(props.squadId, injury.id));
}

function remove(injury: InjuryDto) {
  if (!confirm(`¿Borrar la lesión de ${injury.playerName}? Se registró por error y no quedará en el historial.`)) return;
  void act(() => api.squads.deleteInjury(props.squadId, injury.id));
}

const expectedTone = (injury: InjuryDto) => {
  if (!injury.expectedReturnOn) return 'slate';
  return injury.expectedReturnOn < localDay() ? 'amber' : 'blue';
};
</script>

<template>
  <section class="card">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900"><Icon icon="user-injured" class="mr-2 h-4 w-4 text-red-500" />Lesionados</h2>
        <p class="text-xs text-slate-500">Quién está de baja, por qué, desde cuándo y cuándo se espera que vuelva.</p>
      </div>
      <button v-if="canManage" type="button" class="btn-secondary px-3 py-1 text-xs" :disabled="busy || loading" @click="openNew()">
        <Icon icon="plus" class="mr-1.5 h-3 w-3" />Nueva lesión
      </button>
    </div>

    <Alert v-if="loadError" kind="error">{{ loadError }}</Alert>
    <Alert v-else-if="error && !formOpen" kind="error" class="mb-3">{{ error }}</Alert>

    <p v-if="!loading && active.length === 0" class="text-sm text-slate-500">
      No hay nadie lesionado ahora mismo.<template v-if="canManage"> Cuando alguien caiga, regístralo para tenerlo controlado en las convocatorias.</template>
    </p>

    <ul v-else class="divide-y divide-slate-100">
      <li v-for="injury in active" :key="injury.id" class="flex flex-wrap items-start justify-between gap-3 py-3">
        <div class="min-w-0">
          <p class="font-medium text-slate-800">
            <span v-if="injury.shirtNumber" class="mr-1 text-slate-400">{{ injury.shirtNumber }}</span>{{ injury.playerName }}
            <Badge tone="red" class="ml-2">{{ injury.typeLabel }}</Badge>
          </p>
          <p v-if="injury.reason" class="mt-0.5 text-sm text-slate-600">{{ injury.reason }}</p>
          <p class="mt-1 text-xs text-slate-500">
            Desde el {{ formatDate(injury.startedOn) }} · {{ injury.daysOut }} {{ injury.daysOut === 1 ? 'día' : 'días' }} de baja
            <template v-if="injury.averageDays"> · media para esta lesión ≈ {{ injury.averageDays }} días</template>
          </p>
          <p class="mt-1 text-xs">
            <Badge :tone="expectedTone(injury)">
              <template v-if="injury.expectedReturnOn">Vuelta prevista: {{ formatDate(injury.expectedReturnOn) }}</template>
              <template v-else>Sin fecha de vuelta</template>
            </Badge>
          </p>
        </div>
        <div v-if="canManage" class="flex shrink-0 gap-1">
          <button type="button" class="btn-primary px-3 py-1 text-xs" :disabled="busy" @click="close(injury)"><Icon icon="check" class="mr-1 h-3 w-3" />Alta</button>
          <button type="button" class="btn-ghost px-2 py-1 text-xs" :disabled="busy" aria-label="Editar la lesión" @click="openEdit(injury)"><Icon icon="pen" class="h-3.5 w-3.5" /></button>
          <button type="button" class="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" :disabled="busy" aria-label="Borrar la lesión" @click="remove(injury)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
        </div>
      </li>
    </ul>

    <details v-if="history.length > 0" class="mt-3 text-sm">
      <summary class="cursor-pointer text-slate-500">Historial ({{ history.length }})</summary>
      <ul class="mt-2 divide-y divide-slate-100">
        <li v-for="injury in history" :key="injury.id" class="flex flex-wrap items-center justify-between gap-2 py-2 text-slate-600">
          <span>
            <span class="font-medium text-slate-800">{{ injury.playerName }}</span> · {{ injury.typeLabel }}<template v-if="injury.reason"> · {{ injury.reason }}</template>
            <span class="block text-xs text-slate-500">{{ formatDate(injury.startedOn) }} → {{ formatDate(injury.returnedOn!) }} · {{ injury.daysOut }} días</span>
          </span>
          <span v-if="canManage" class="flex gap-1">
            <button type="button" class="btn-ghost px-2 py-1 text-xs" :disabled="busy" @click="reopen(injury)">Recaída</button>
            <button type="button" class="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" :disabled="busy" aria-label="Borrar" @click="remove(injury)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
          </span>
        </li>
      </ul>
    </details>

    <Modal :open="formOpen" :title="editing ? 'Corregir la lesión' : 'Nueva lesión'" size="md" @close="formOpen = false">
      <form id="injury-form" class="space-y-4" @submit.prevent="save">
        <Alert v-if="error" kind="error">{{ error }}</Alert>
        <div>
          <label class="label" for="injury-player">Jugador</label>
          <SearchSelect id="injury-player" placeholder="Elige al jugador" :disabled="editing !== null" :model-value="form.squadPlayerId" :options="playerOptions" @update:model-value="form.squadPlayerId = ($event as string | null)" />
        </div>
        <div>
          <label class="label" for="injury-type">Tipo de lesión</label>
          <SearchSelect id="injury-type" placeholder="Elige el tipo" :model-value="form.type" :options="typeOptions" @update:model-value="form.type = ($event as InjuryType | null); proposeReturn()" />
          <p v-if="selectedType?.averageDays" class="mt-1 text-xs text-slate-500">Duración media orientativa: {{ selectedType.averageDays }} días. La vuelta prevista se propone con ella; cámbiala si el médico dice otra cosa.</p>
        </div>
        <div>
          <label class="label" for="injury-reason">Motivo o detalle <span class="font-normal text-slate-400">(opcional)</span></label>
          <input id="injury-reason" v-model="form.reason" type="text" maxlength="300" class="input" placeholder="Golpe en el entrenamiento del martes, isquio derecho…" />
          <p v-if="fieldErrors.reason" class="field-error">{{ fieldErrors.reason[0] }}</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="label" for="injury-start">Desde</label>
            <input id="injury-start" v-model="form.startedOn" type="date" required class="input" @change="proposeReturn()" />
          </div>
          <div>
            <label class="label" for="injury-return">Vuelta prevista <span class="font-normal text-slate-400">(opcional)</span></label>
            <input id="injury-return" v-model="form.expectedReturnOn" type="date" class="input" :min="form.startedOn" />
            <p v-if="fieldErrors.expectedReturnOn" class="field-error">{{ fieldErrors.expectedReturnOn[0] }}</p>
          </div>
        </div>
      </form>
      <template #footer>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="formOpen = false">Cancelar</button>
          <button type="submit" form="injury-form" class="btn-primary" :disabled="busy || !form.type || !form.startedOn || (!editing && !form.squadPlayerId)">
            {{ editing ? 'Guardar' : 'Registrar lesión' }}
          </button>
        </div>
      </template>
    </Modal>
  </section>
</template>
