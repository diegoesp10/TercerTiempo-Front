<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import type { Position, SquadPlayerDto, TrialPlayerDto } from '@/types/api';
import { formatDate, positionOptions } from '@/utils/format';

// Ficha nueva en la plantilla: a mano o para uno de los que vienen a entrenar a prueba (se apuntan en la agenda), que
// pasa con lo que ya se le había anotado. Se queda abierta para añadir otro: cada alta se confirma dentro.
const props = defineProps<{ open: boolean; squadId: string; trials: TrialPlayerDto[] }>();
const emit = defineEmits<{ close: []; added: [player: SquadPlayerDto, fromTrial: boolean] }>();

const name = ref('');
const position = ref<Position | null>(null);
const trialId = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const done = ref<string | null>(null);
const nameInput = ref<HTMLInputElement | null>(null);

const waiting = computed(() => props.trials.filter((t) => !t.promotedSquadPlayerId));
const trial = computed(() => waiting.value.find((t) => t.id === trialId.value) ?? null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    name.value = '';
    position.value = null;
    trialId.value = null;
    error.value = null;
    done.value = null;
    void nextTick(() => nameInput.value?.focus());
  },
  { immediate: true },
);

// Para sugerir, no para decidir: sin tildes ni mayúsculas, y basta con que un nombre lleve todas las palabras del otro
// («Iyán Cuervo» y «Iyan Cuervo García»). Con una sola palabra escrita no se sugiere nada: «Pablo» sería medio vestuario.
const words = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter(Boolean);
const covers = (some: string[], all: string[]) => some.length > 0 && some.every((word) => all.includes(word));
const lookalike = computed(() => {
  if (trial.value) return null;
  const typed = words(name.value);
  if (typed.length < 2) return null;
  return waiting.value.find((t) => {
    const known = words(t.fullName);
    return covers(known, typed) || covers(typed, known);
  }) ?? null;
});

function pick(chosen: TrialPlayerDto) {
  trialId.value = chosen.id;
  name.value = chosen.fullName;
  error.value = null;
  done.value = null;
}

function unpick() {
  trialId.value = null;
  name.value = '';
  void nextTick(() => nameInput.value?.focus());
}

const blocked = computed(() => {
  if (busy.value) return 'Espera a que termine lo que se está guardando';
  if (!name.value.trim()) return 'Escribe su nombre y apellidos';
  if (!position.value) return 'Elige su posición';
  return undefined;
});

async function submit() {
  if (blocked.value || !position.value) return;
  const chosen = trial.value;
  const fullName = name.value.trim();
  busy.value = true;
  error.value = null;
  done.value = null;
  try {
    let player: SquadPlayerDto;
    if (chosen) {
      // A prueba se le apunta como se le conoce: al hacerle ficha se puede completar el nombre.
      if (fullName !== chosen.fullName) await api.trainings.updateTrialPlayer(props.squadId, chosen.id, { fullName, notes: chosen.notes });
      player = await api.trainings.promoteTrialPlayer(props.squadId, chosen.id, { position: position.value, shirtNumber: null });
      const history = chosen.sessions > 0 ? `, con lo que se le anotó a prueba (vino a ${chosen.attended} de ${chosen.sessions})` : '';
      done.value = `${player.fullName} ya tiene ficha y está en la plantilla${history}.`;
    } else {
      player = await api.squads.addPlayer(props.squadId, { fullName, position: position.value, shirtNumber: null });
      done.value = `${player.fullName} añadido a la plantilla.`;
    }
    name.value = '';
    position.value = null;
    trialId.value = null;
    emit('added', player, !!chosen);
    void nextTick(() => nameInput.value?.focus());
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" title="Añadir jugador" size="md" @close="emit('close')">
    <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>
    <Alert v-if="done" kind="success" class="mb-4">{{ done }} Puedes añadir otro o cerrar.</Alert>

    <section v-if="waiting.length > 0" class="mb-5">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">A prueba · {{ waiting.length }}</h3>
      <p class="mt-1 text-xs text-slate-500">Los que vienen a entrenar sin ficha, apuntados en la agenda. Elige uno para hacerle ficha: pasa a la plantilla con lo que ya se le había anotado.</p>
      <ul class="mt-2 divide-y divide-line rounded-lg border border-line">
        <li v-for="t in waiting" :key="t.id" class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" :class="t.id === trialId ? 'bg-brand-500/10' : ''">
          <div class="min-w-0 flex-1">
            <p class="break-words font-medium text-slate-900">{{ t.fullName }}</p>
            <p class="text-xs text-slate-500">
              Desde el {{ formatDate(t.createdAt) }} · vino a {{ t.attended }} de {{ t.sessions }} {{ t.sessions === 1 ? 'entrenamiento' : 'entrenamientos' }}<template v-if="t.notes"> · {{ t.notes }}</template>
            </p>
          </div>
          <span v-if="t.id === trialId" class="inline-flex items-center gap-1 text-xs font-semibold text-brand-500"><Icon icon="check" class="h-3 w-3" />Elegido</span>
          <button v-else type="button" class="btn-secondary px-2.5 py-1 text-xs" :aria-label="`Elegir a ${t.fullName} para hacerle ficha`" :disabled="busy" @click="pick(t)">Elegir</button>
        </li>
      </ul>
    </section>

    <form class="space-y-3" @submit.prevent="submit">
      <h3 class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ trial ? 'Ficha para quien está a prueba' : 'Jugador nuevo' }}</h3>
      <p v-if="trial" class="text-xs text-slate-600">
        Sus entrenamientos de prueba se quedan a su nombre. Si a prueba se le apuntó solo con el nombre de pila, complétalo.
        <button type="button" class="font-semibold text-accent-400 hover:underline" @click="unpick">Es otro jugador</button>
      </p>
      <p v-else class="text-xs text-slate-500">Las fichas de la federación se traen con «Importar fichas de la federación», en «Gestión de la plantilla».</p>
      <div>
        <label class="label" for="add-player-name">Nombre y apellidos</label>
        <input id="add-player-name" ref="nameInput" v-model="name" type="text" required maxlength="150" class="input" placeholder="Nuevo jugador" />
      </div>
      <Alert v-if="lookalike" kind="warning">
        {{ lookalike.fullName }} está a prueba. Si es él,
        <button type="button" class="font-semibold underline hover:no-underline" @click="pick(lookalike)">elígelo</button>
        para que pase con sus entrenamientos de prueba; si es otra persona, sigue.
      </Alert>
      <div>
        <label class="label" for="add-player-position">Posición</label>
        <SearchSelect
          id="add-player-position"
          placeholder="Elige su posición"
          :model-value="position"
          :options="positionOptions"
          @update:model-value="position = ($event as Position | null)"
        />
      </div>
      <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
        <p v-if="blocked && !busy" class="mr-auto text-xs text-slate-500">{{ blocked }}</p>
        <button type="button" class="btn-ghost" @click="emit('close')">Cerrar</button>
        <button type="submit" class="btn-primary" v-busy="busy" :disabled="!!blocked" :title="blocked">{{ trial ? 'Hacerle ficha' : 'Añadir a la plantilla' }}</button>
      </div>
    </form>
  </Modal>
</template>
