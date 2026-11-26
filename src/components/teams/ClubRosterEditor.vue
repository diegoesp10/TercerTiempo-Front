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
import SortHeader from '@/components/ui/SortHeader.vue';
import type { Position, RosterEntryDto, RosterEntryRequest } from '@/types/api';
import { positionLabels, positionOptions } from '@/utils/format';
import { confirmDialog } from '@/composables/useConfirm';
import { useSort } from '@/composables/useSort';
import { groupByPosition } from '@/composables/usePositionGrouping';

// La cuenta de club corrige la plantilla publicada de uno de sus equipos: añadir y retirar fichas en la tabla, y
// editar cada jugador (datos, foto y sus actas) en un modal.
const props = defineProps<{ teamId: string; roster: RosterEntryDto[]; grouped?: boolean }>();
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

// La plantilla llega por posición y, dentro de cada una, por nombre: «Jugador» ordena por posición y a igualdad
// respeta ese orden por nombre. Los que no tienen posición, siempre al final.
const positionRank = Object.fromEntries(positionOptions.map((o, i) => [o.value, i])) as Record<Position, number>;
type SortKey = 'player' | 'season';
const rows = computed(() => props.roster);
const getters: Record<SortKey, (entry: RosterEntryDto) => number | null> = {
  player: (e) => (e.position ? positionRank[e.position] : null),
  season: (e) => e.stats?.minutesPlayed ?? null,
};
const { sorted, sortBy, state } = useSort<RosterEntryDto, SortKey>(rows, getters, 'player', { desc: false, ascendingFirst: ['player'] });
const groups = computed(() => groupByPosition(sorted.value, (e) => e.position, props.grouped ?? false));

async function remove(entry: RosterEntryDto) {
  if (!(await confirmDialog({ title: `Retirar a ${entry.fullName}`, message: 'Dejará de aparecer en la plantilla publicada del equipo.', confirmLabel: 'Retirar', danger: true }))) return;
  void act(() => api.clubs.removeRosterEntry(props.teamId, entry.id));
}

const adding = ref(false);
const newEntry = reactive<{ fullName: string; position: Position | '' }>({ fullName: '', position: '' });

const toRequest = (form: typeof newEntry): RosterEntryRequest => ({
  fullName: form.fullName.trim(),
  position: form.position || null,
});

async function add() {
  if (await act(() => api.clubs.addRosterEntry(props.teamId, toRequest(newEntry)))) {
    newEntry.fullName = '';
    newEntry.position = '';
    adding.value = false;
  }
}
</script>

<template>
  <div>
    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>

    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="text-xs text-slate-500">
          <tr>
            <SortHeader class="py-2 pr-3 text-left" label="Jugador" title="Por posición (portero, defensa, centrocampista, delantero) y nombre" v-bind="state('player')" @sort="sortBy('player')" />
            <SortHeader class="py-2 pr-3 text-left" label="Temporada" title="Minutos según las actas oficiales (se ven también goles y tarjetas)" v-bind="state('season')" @sort="sortBy('season')" />
            <th class="py-2 text-right uppercase tracking-wide"></th>
          </tr>
        </thead>
        <tbody v-for="group in groups" :key="group.key" class="divide-y divide-slate-100">
          <tr v-if="group.label">
            <td colspan="3" class="bg-surface-2 px-2 py-1.5 font-display text-2xs font-semibold uppercase tracking-[0.14em] text-slate-500">{{ group.label }} · {{ group.rows.length }}</td>
          </tr>
          <tr v-for="entry in group.rows" :key="entry.id" class="cursor-pointer hover:bg-surface-2/60" @click="openId = entry.id">
            <td class="py-2 pr-3">
              <span class="flex items-center gap-2">
                <PlayerAvatar :src="entry.photoUrl" :name="entry.fullName" size="sm" class="shrink-0" />
                <span class="min-w-0">
                  <span class="font-medium text-slate-800">{{ entry.fullName }}</span>
                  <Badge v-if="entry.managedByClub" tone="blue" class="ml-1">Club</Badge>
                  <span class="block text-xs text-slate-500">{{ entry.position ? positionLabels[entry.position] : 'Sin posición' }}</span>
                </span>
              </span>
            </td>
            <td class="py-2 pr-3 whitespace-nowrap"><RosterStatsSummary :stats="entry.stats" /></td>
            <td class="py-2 text-right whitespace-nowrap" @click.stop>
              <button type="button" class="btn-ghost btn-sm px-2" v-busy="busy" :disabled="busy" aria-label="Ver y editar la ficha" @click="openId = entry.id"><Icon icon="pen" class="h-3.5 w-3.5" /></button>
              <button type="button" class="btn-ghost-danger btn-sm px-2" v-busy="busy" :disabled="busy" aria-label="Retirar ficha" @click="remove(entry)"><Icon icon="trash" class="h-3.5 w-3.5" /></button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <form v-if="adding" class="mt-4 grid grid-cols-1 items-start gap-3 rounded-lg border border-line bg-surface-2 p-3 sm:flex sm:flex-wrap" @submit.prevent="add">
      <div class="min-w-0 sm:min-w-48 sm:flex-1">
        <label class="label" for="roster-new-name">Nombre y apellidos</label>
        <input id="roster-new-name" v-model="newEntry.fullName" type="text" required maxlength="150" class="input" />
        <p v-if="fieldErrors.fullName" class="field-error">{{ fieldErrors.fullName[0] }}</p>
      </div>
      <div class="sm:w-44">
        <label class="label" for="roster-new-position">Posición</label>
        <SearchSelect id="roster-new-position" placeholder="Elige su posición" :model-value="newEntry.position || null" :options="positionOptions" @update:model-value="newEntry.position = ($event as Position | null) ?? ''" />
      </div>
      <div class="flex gap-2">
        <div>
          <span class="label invisible hidden sm:block" aria-hidden="true">Añadir</span>
          <button type="submit" class="btn-primary" v-busy="busy" :disabled="busy || !newEntry.fullName.trim() || !newEntry.position">Añadir</button>
        </div>
        <div>
          <span class="label invisible hidden sm:block" aria-hidden="true">Cancelar</span>
          <button type="button" class="btn-ghost" @click="adding = false">Cancelar</button>
        </div>
      </div>
    </form>
    <button v-else type="button" class="btn-secondary mt-4 text-sm" v-busy="busy" :disabled="busy" @click="adding = true"><Icon icon="plus" class="mr-1.5 h-3.5 w-3.5" />Añadir jugador</button>

    <RosterPlayerModal :team-id="teamId" :entry="openEntry" @close="openId = null" @updated="emit('updated', $event)" />
  </div>
</template>
