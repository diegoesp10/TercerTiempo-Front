<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { Position, TrialPlayerDto, TrialPlayerRequest } from '@/types/api';
import { formatDate, positionLabels } from '@/utils/format';

/**
 * Los jugadores que vienen a entrenar a prueba, sin ficha: se apuntan por su nombre, se les pasa lista en las sesiones
 * a las que vienen y, si el club les hace ficha, pasan a la plantilla con su historial.
 */
const props = defineProps<{
  open: boolean;
  squadId: string;
  trialPlayers: TrialPlayerDto[];
  readonly: boolean;
}>();
const emit = defineEmits<{ close: []; changed: []; promoted: [] }>();

const form = ref<TrialPlayerRequest>({ fullName: '', notes: null });
const editingId = ref<string | null>(null);
const promoteId = ref<string | null>(null);
const promoteForm = ref<{ position: Position | null; shirtNumber: number | null }>({ position: null, shirtNumber: null });
const busy = ref(false);
const error = ref<string | null>(null);

const active = computed(() => props.trialPlayers.filter((t) => !t.promotedSquadPlayerId));
const promoted = computed(() => props.trialPlayers.filter((t) => t.promotedSquadPlayerId));
const positionOptions = computed<SelectOption[]>(() => (Object.keys(positionLabels) as Position[]).map((p) => ({ value: p, label: positionLabels[p] })));

function startEdit(trial: TrialPlayerDto) {
  promoteId.value = null;
  editingId.value = trial.id;
  form.value = { fullName: trial.fullName, notes: trial.notes };
}

function cancelEdit() {
  editingId.value = null;
  form.value = { fullName: '', notes: null };
}

function startPromote(trial: TrialPlayerDto) {
  cancelEdit();
  promoteId.value = trial.id;
  promoteForm.value = { position: null, shirtNumber: null };
}

async function act(action: () => Promise<void>) {
  busy.value = true;
  error.value = null;
  try {
    await action();
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

function save() {
  void act(async () => {
    const body: TrialPlayerRequest = { fullName: form.value.fullName.trim(), notes: form.value.notes?.trim() || null };
    if (editingId.value) await api.trainings.updateTrialPlayer(props.squadId, editingId.value, body);
    else await api.trainings.createTrialPlayer(props.squadId, body);
    cancelEdit();
    emit('changed');
  });
}

function promote(trial: TrialPlayerDto) {
  void act(async () => {
    await api.trainings.promoteTrialPlayer(props.squadId, trial.id, { position: promoteForm.value.position, shirtNumber: promoteForm.value.shirtNumber || null });
    promoteId.value = null;
    emit('promoted');
    emit('changed');
  });
}

async function remove(trial: TrialPlayerDto) {
  if (!(await confirmDialog({ title: `Borrar a ${trial.fullName}`, message: 'Desaparece de la lista y de los entrenamientos en los que estaba apuntado.', confirmLabel: 'Borrar', danger: true }))) return;
  void act(async () => {
    await api.trainings.deleteTrialPlayer(props.squadId, trial.id);
    if (editingId.value === trial.id) cancelEdit();
    emit('changed');
  });
}
</script>

<template>
  <Modal :open="open" title="Jugadores a prueba" size="lg" @close="emit('close')">
    <p class="mb-4 text-sm text-slate-600">Gente que viene a entrenar sin ficha en la plantilla. Se les apunta por su nombre, se les pasa lista en cada sesión y, si el club les hace ficha, pasan a la plantilla con todo lo que ya tenían anotado.</p>
    <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>

    <p v-if="active.length === 0" class="text-sm text-slate-500">Nadie a prueba ahora mismo. Apúntalo aquí o directamente desde la asistencia de un entrenamiento.</p>
    <ul v-else class="divide-y divide-line rounded-lg border border-line">
      <li v-for="t in active" :key="t.id" class="px-3 py-2 text-sm" :class="t.id === editingId || t.id === promoteId ? 'bg-brand-500/5' : ''">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0 flex-1">
            <p class="font-medium text-slate-900">{{ t.fullName }} <Badge tone="amber" class="ml-1">A prueba</Badge></p>
            <p class="text-xs text-slate-500">
              Desde el {{ formatDate(t.createdAt) }} · {{ t.sessions }} {{ t.sessions === 1 ? 'entrenamiento' : 'entrenamientos' }}, vino a {{ t.attended }}
              <template v-if="t.notes"> · {{ t.notes }}</template>
            </p>
          </div>
          <div v-if="!readonly" class="flex shrink-0 flex-wrap gap-1">
            <button v-if="promoteId !== t.id" type="button" class="btn-secondary px-2 py-1 text-xs" :disabled="busy" @click="startPromote(t)"><Icon icon="plus" class="mr-1 h-3 w-3" />Hacerle ficha</button>
            <button type="button" class="btn-ghost px-2 py-1" aria-label="Editar" :disabled="busy" @click="startEdit(t)"><Icon icon="pen" class="h-3.5 w-3.5" /></button>
            <button type="button" class="btn-ghost px-2 py-1 text-red-600 hover:bg-red-50" aria-label="Borrar" :disabled="busy" @click="remove(t)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <form v-if="promoteId === t.id" class="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-brand-500/40 bg-surface-2 p-2" @submit.prevent="promote(t)">
          <p class="basis-full text-xs text-slate-600">Pasa a la plantilla con ficha a nombre de <strong>{{ t.fullName }}</strong>; sus asistencias de prueba se quedan a su nombre.</p>
          <div class="min-w-0 flex-1 basis-40">
            <label class="label text-xs" :for="`tp-pos-${t.id}`">Posición</label>
            <SearchSelect :id="`tp-pos-${t.id}`" v-model="promoteForm.position" :options="positionOptions" size="sm" clearable placeholder="Sin posición" />
          </div>
          <div class="w-20">
            <label class="label text-xs" :for="`tp-num-${t.id}`">Dorsal</label>
            <input :id="`tp-num-${t.id}`" v-model.number="promoteForm.shirtNumber" type="number" min="1" max="99" class="input px-2 py-1.5" placeholder="—" />
          </div>
          <button type="submit" class="btn-primary px-3 py-1.5 text-xs" v-busy="busy" :disabled="busy">Hacerle ficha</button>
          <button type="button" class="btn-ghost px-2 py-1.5 text-xs" @click="promoteId = null">Cancelar</button>
        </form>
      </li>
    </ul>

    <form v-if="!readonly" class="mt-4 card space-y-3" @submit.prevent="save">
      <h3 class="font-semibold text-slate-900">{{ editingId ? 'Editar jugador a prueba' : 'Apuntar a alguien a prueba' }}</h3>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="label" for="tp-name">Nombre y apellidos</label>
          <input id="tp-name" v-model="form.fullName" type="text" required maxlength="150" class="input" placeholder="Iyán Cuervo" />
        </div>
        <div>
          <label class="label" for="tp-notes">Notas</label>
          <input id="tp-notes" v-model="form.notes" type="text" maxlength="500" class="input" placeholder="De dónde viene, posición, contacto…" />
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <button v-if="editingId" type="button" class="btn-ghost" @click="cancelEdit">Cancelar</button>
        <button type="submit" class="btn-primary" v-busy="busy" :disabled="busy || !form.fullName.trim()">{{ editingId ? 'Guardar' : 'Apuntar' }}</button>
      </div>
    </form>

    <details v-if="promoted.length > 0" class="mt-4">
      <summary class="text-sm text-slate-500">Ya con ficha en la plantilla ({{ promoted.length }})</summary>
      <ul class="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
        <li v-for="t in promoted" :key="t.id" class="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <span class="text-slate-800">{{ t.fullName }}</span>
          <span class="text-xs text-slate-500">Ficha desde el {{ formatDate(t.promotedAt!) }} · vino a {{ t.attended }} de {{ t.sessions }} a prueba</span>
        </li>
      </ul>
    </details>
  </Modal>
</template>
