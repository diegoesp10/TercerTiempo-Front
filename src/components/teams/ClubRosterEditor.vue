<script setup lang="ts">
import { reactive, ref } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import type { Position, RosterEntryDto, RosterEntryRequest } from '@/types/api';
import { positionLabels, positionOptions } from '@/utils/format';

/** La cuenta de club corrige la plantilla publicada de uno de sus equipos: añadir, editar y retirar fichas. */
const props = defineProps<{ teamId: string; roster: RosterEntryDto[] }>();
const emit = defineEmits<{ updated: [roster: RosterEntryDto[]] }>();

const busy = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

async function act(fn: () => Promise<RosterEntryDto[]>) {
  busy.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    emit('updated', await fn());
    return true;
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
    return false;
  } finally {
    busy.value = false;
  }
}

const editingId = ref<string | null>(null);
const edit = reactive<{ fullName: string; position: Position | ''; shirtNumber: number | null }>({ fullName: '', position: '', shirtNumber: null });

function startEdit(entry: RosterEntryDto) {
  editingId.value = entry.id;
  edit.fullName = entry.fullName;
  edit.position = entry.position ?? '';
  edit.shirtNumber = entry.shirtNumber;
}

const toRequest = (form: typeof edit): RosterEntryRequest => ({
  fullName: form.fullName.trim(),
  position: form.position || null,
  shirtNumber: form.shirtNumber || null,
});

async function saveEdit(entry: RosterEntryDto) {
  if (await act(() => api.clubs.updateRosterEntry(props.teamId, entry.id, toRequest(edit)))) editingId.value = null;
}

function remove(entry: RosterEntryDto) {
  if (!confirm(`¿Retirar a ${entry.fullName} de la plantilla publicada?`)) return;
  void act(() => api.clubs.removeRosterEntry(props.teamId, entry.id));
}

const adding = ref(false);
const newEntry = reactive<{ fullName: string; position: Position | ''; shirtNumber: number | null }>({ fullName: '', position: '', shirtNumber: null });

async function add() {
  if (await act(() => api.clubs.addRosterEntry(props.teamId, toRequest(newEntry)))) {
    newEntry.fullName = '';
    newEntry.position = '';
    newEntry.shirtNumber = null;
    adding.value = false;
  }
}
</script>

<template>
  <div>
    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>

    <table class="min-w-full text-sm">
      <thead class="text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="py-2 pr-3 text-left">#</th>
          <th class="py-2 pr-3 text-left">Jugador</th>
          <th class="py-2 pr-3 text-left">Posición</th>
          <th class="py-2 text-right"></th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="entry in roster" :key="entry.id">
          <template v-if="editingId === entry.id">
            <td class="py-2 pr-3">
              <input v-model.number="edit.shirtNumber" type="number" min="1" max="99" class="input w-16 px-2 py-1" aria-label="Dorsal" />
            </td>
            <td class="py-2 pr-3">
              <input v-model="edit.fullName" type="text" required maxlength="150" class="input px-2 py-1" aria-label="Nombre" />
              <p v-if="fieldErrors.fullName" class="field-error">{{ fieldErrors.fullName[0] }}</p>
            </td>
            <td class="py-2 pr-3">
              <SearchSelect size="sm" aria-label="Posición" placeholder="—" clearable :model-value="edit.position || null" :options="positionOptions" @update:model-value="edit.position = ($event as Position | null) ?? ''" />
            </td>
            <td class="py-2 text-right whitespace-nowrap">
              <button type="button" class="btn-primary px-3 py-1 text-xs" :disabled="busy || !edit.fullName.trim()" @click="saveEdit(entry)"><Icon icon="check" class="mr-1 h-3 w-3" />Guardar</button>
              <button type="button" class="btn-ghost ml-1 px-3 py-1 text-xs" @click="editingId = null">Cancelar</button>
            </td>
          </template>
          <template v-else>
            <td class="py-2 pr-3 tabular-nums text-slate-500">{{ entry.shirtNumber ?? '—' }}</td>
            <td class="py-2 pr-3 font-medium text-slate-800">
              {{ entry.fullName }}
              <Badge v-if="entry.managedByClub" tone="blue" class="ml-1">Club</Badge>
            </td>
            <td class="py-2 pr-3 text-slate-600">{{ entry.position ? positionLabels[entry.position] : '—' }}</td>
            <td class="py-2 text-right whitespace-nowrap">
              <button type="button" class="btn-ghost px-2 py-1 text-xs" :disabled="busy" aria-label="Editar ficha" @click="startEdit(entry)"><Icon icon="pen" class="h-3.5 w-3.5" /></button>
              <button type="button" class="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" :disabled="busy" aria-label="Retirar ficha" @click="remove(entry)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
            </td>
          </template>
        </tr>
      </tbody>
    </table>

    <form v-if="adding" class="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface-2 p-3" @submit.prevent="add">
      <div class="w-20">
        <label class="label" for="roster-new-number">Dorsal</label>
        <input id="roster-new-number" v-model.number="newEntry.shirtNumber" type="number" min="1" max="99" class="input" />
      </div>
      <div class="min-w-48 flex-1">
        <label class="label" for="roster-new-name">Nombre y apellidos</label>
        <input id="roster-new-name" v-model="newEntry.fullName" type="text" required maxlength="150" class="input" />
      </div>
      <div class="w-44">
        <label class="label" for="roster-new-position">Posición</label>
        <SearchSelect id="roster-new-position" placeholder="—" clearable :model-value="newEntry.position || null" :options="positionOptions" @update:model-value="newEntry.position = ($event as Position | null) ?? ''" />
      </div>
      <button type="submit" class="btn-primary" :disabled="busy || !newEntry.fullName.trim()">Añadir</button>
      <button type="button" class="btn-ghost" @click="adding = false">Cancelar</button>
    </form>
    <button v-else type="button" class="btn-secondary mt-4 text-sm" :disabled="busy" @click="adding = true"><Icon icon="plus" class="mr-1.5 h-3.5 w-3.5" />Añadir jugador</button>
  </div>
</template>
