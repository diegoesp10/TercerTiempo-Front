<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import RosterPlayerModal from '@/components/teams/RosterPlayerModal.vue';
import RosterStatsSummary from '@/components/teams/RosterStatsSummary.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import type { Position, RosterEntryDto, RosterEntryRequest } from '@/types/api';
import { positionLabels, positionOptions } from '@/utils/format';

// La cuenta de club corrige la plantilla publicada de uno de sus equipos: añadir y retirar fichas en la tabla, y
// editar cada jugador (datos, foto y sus actas) en un modal.
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

const openId = ref<string | null>(null);
const openEntry = computed(() => props.roster.find((e) => e.id === openId.value) ?? null);

function remove(entry: RosterEntryDto) {
  if (!confirm(`¿Retirar a ${entry.fullName} de la plantilla publicada?`)) return;
  void act(() => api.clubs.removeRosterEntry(props.teamId, entry.id));
}

const adding = ref(false);
const newEntry = reactive<{ fullName: string; position: Position | ''; shirtNumber: number | null }>({ fullName: '', position: '', shirtNumber: null });

const toRequest = (form: typeof newEntry): RosterEntryRequest => ({
  fullName: form.fullName.trim(),
  position: form.position || null,
  shirtNumber: form.shirtNumber || null,
});

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

    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="py-2 pr-3 text-left">#</th>
            <th class="py-2 pr-3 text-left">Jugador</th>
            <th class="py-2 pr-3 text-left" title="Goles, tarjetas y minutos según las actas oficiales">Temporada</th>
            <th class="py-2 text-right"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="entry in roster" :key="entry.id" class="cursor-pointer hover:bg-surface-2/60" @click="openId = entry.id">
            <td class="py-2 pr-3 tabular-nums text-slate-500">{{ entry.shirtNumber ?? '—' }}</td>
            <td class="py-2 pr-3 whitespace-nowrap">
              <span class="inline-flex items-center gap-2">
                <PlayerAvatar :src="entry.photoUrl" :name="entry.fullName" size="sm" />
                <span>
                  <span class="font-medium text-slate-800">{{ entry.fullName }}</span>
                  <Badge v-if="entry.managedByClub" tone="blue" class="ml-1">Club</Badge>
                  <span class="block text-xs text-slate-500">{{ entry.position ? positionLabels[entry.position] : 'Sin posición' }}</span>
                </span>
              </span>
            </td>
            <td class="py-2 pr-3 whitespace-nowrap"><RosterStatsSummary :stats="entry.stats" /></td>
            <td class="py-2 text-right whitespace-nowrap" @click.stop>
              <button type="button" class="btn-ghost px-2 py-1 text-xs" :disabled="busy" aria-label="Ver y editar la ficha" @click="openId = entry.id"><Icon icon="pen" class="h-3.5 w-3.5" /></button>
              <button type="button" class="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" :disabled="busy" aria-label="Retirar ficha" @click="remove(entry)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <form v-if="adding" class="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface-2 p-3" @submit.prevent="add">
      <div class="w-20">
        <label class="label" for="roster-new-number">Dorsal</label>
        <input id="roster-new-number" v-model.number="newEntry.shirtNumber" type="number" min="1" max="99" class="input" />
      </div>
      <div class="min-w-48 flex-1">
        <label class="label" for="roster-new-name">Nombre y apellidos</label>
        <input id="roster-new-name" v-model="newEntry.fullName" type="text" required maxlength="150" class="input" />
        <p v-if="fieldErrors.fullName" class="field-error">{{ fieldErrors.fullName[0] }}</p>
      </div>
      <div class="w-44">
        <label class="label" for="roster-new-position">Posición</label>
        <SearchSelect id="roster-new-position" placeholder="—" clearable :model-value="newEntry.position || null" :options="positionOptions" @update:model-value="newEntry.position = ($event as Position | null) ?? ''" />
      </div>
      <button type="submit" class="btn-primary" :disabled="busy || !newEntry.fullName.trim()">Añadir</button>
      <button type="button" class="btn-ghost" @click="adding = false">Cancelar</button>
    </form>
    <button v-else type="button" class="btn-secondary mt-4 text-sm" :disabled="busy" @click="adding = true"><Icon icon="plus" class="mr-1.5 h-3.5 w-3.5" />Añadir jugador</button>

    <RosterPlayerModal :team-id="teamId" :entry="openEntry" @close="openId = null" @updated="emit('updated', $event)" />
  </div>
</template>
