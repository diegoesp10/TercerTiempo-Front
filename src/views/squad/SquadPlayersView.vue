<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import AddSquadPlayerModal from '@/components/squads/AddSquadPlayerModal.vue';
import Alert from '@/components/ui/Alert.vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';
import type { ChoiceOption } from '@/components/ui/choice';
import GroupByPositionToggle from '@/components/ui/GroupByPositionToggle.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Badge from '@/components/ui/Badge.vue';
import InjuryPanel from '@/components/squads/InjuryPanel.vue';
import DisciplineBadge from '@/components/squads/DisciplineBadge.vue';
import SquadSeasonTable from '@/components/squads/SquadSeasonTable.vue';
import CardTally from '@/components/ui/CardTally.vue';
import { useSquad } from '@/composables/useSquad';
import { useAuthStore } from '@/stores/auth';
import type { Position, SquadDisciplineDto, SquadPlayerDto, SquadPlayerRequest, SquadVisibility, TrialPlayerDto } from '@/types/api';
import { formatDate, positionLabels, positionOptions, staffRoleLabels, visibilityLabels } from '@/utils/format';
import { confirmDialog } from '@/composables/useConfirm';
import PlayerName from '@/components/players/PlayerName.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import { useViewer } from '@/composables/useViewer';
import { useSort } from '@/composables/useSort';
import { groupByPosition, useGroupByPosition } from '@/composables/usePositionGrouping';

const { squadId, detail, reload } = useSquad();
const auth = useAuthStore();

const canManage = computed(() => detail.value?.canManage ?? false);
const canInvitePlayers = computed(() => detail.value?.canInvitePlayers ?? false);
// Los de baja llegan aparte (leftPlayers): aquí se ven en su grupo; en el resto de la app ya no entran en nada nuevo.
const players = computed(() => [...(detail.value?.players ?? []), ...(detail.value?.leftPlayers ?? [])]);
const active = computed(() => players.value.filter((p) => p.status === 'Active'));
// Las lesiones solo llegan al cuerpo técnico, a los jugadores vinculados y al administrador (que solo mira).
const { isAdmin } = useViewer();
const seesInjuries = computed(() => canManage.value || myEntryId.value !== null || isAdmin.value);
// Los de baja siguen en la lista, en su último grupo «De baja»: ya no se convocan, alinean ni citan.
const left = computed(() => players.value.filter((p) => p.status !== 'Active'));
const isLeft = (p: SquadPlayerDto) => p.status !== 'Active';
const myEntryId = computed(() => (auth.playerSquad?.squadId === squadId.value ? auth.playerSquad.squadPlayerId : null));

// Quién llega apercibido o sancionado al próximo partido de liga (en la tabla de la temporada, no en las fichas) y las
// tarjetas del cuerpo técnico. Si no llega, todo sale igual, sin las marcas.
const discipline = ref<SquadDisciplineDto | null>(null);
watch(
  squadId,
  async (id) => {
    discipline.value = null;
    try {
      discipline.value = await api.squads.discipline(id);
    } catch {
      /* sin marcas */
    }
  },
  { immediate: true },
);
const playerDiscipline = computed(() => new Map((discipline.value?.players ?? []).map((p) => [p.squadPlayerId, p.next])));
const staffDiscipline = computed(() => new Map((discipline.value?.staff ?? []).map((s) => [s.coachId, s.discipline])));
const playerCycles = computed(() => new Map((discipline.value?.cycles ?? []).map((c) => [c.squadPlayerId, c])));

// Fichas: llegan por nombre. Se ordena solo por lo que no se edita en la fila (lee la ficha guardada, no el
// formulario), así que una edición en curso no mueve su fila.
const positionRank = Object.fromEntries(positionOptions.map((o, i) => [o.value, i])) as Record<Position, number>;
type SortKey = 'name' | 'position' | 'account';
const getters: Record<SortKey, (p: SquadPlayerDto) => number | string | null> = {
  name: (p) => p.fullName,
  position: (p) => (p.position ? positionRank[p.position] : null),
  account: (p) => (p.linked ? 1 : 0),
};
const { sorted, sortBy, state } = useSort<SquadPlayerDto, SortKey>(players, getters, 'name', { desc: false, ascendingFirst: ['name', 'position'] });
const grouped = useGroupByPosition('squad-players');
const groups = computed(() => groupByPosition(sorted.value, (p) => p.position, grouped.value, undefined, isLeft));
const columnCount = computed(() => 3 + (canInvitePlayers.value ? 1 : 0) + (canManage.value ? 1 : 0));

const busy = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);

async function act(fn: () => Promise<string | void>) {
  busy.value = true;
  error.value = null;
  notice.value = null;
  try {
    notice.value = (await fn()) || null;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

// --- Invitaciones personales ---
const copied = ref<string | null>(null);

// Copia el código o el enlace de alta (/registro?invite=CODIGO) que lo lleva ya puesto.
async function copyCode(player: SquadPlayerDto, asLink = false) {
  const code = player.inviteCode;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(asLink ? `${window.location.origin}/registro?invite=${code}` : code);
    copied.value = `${player.id}${asLink ? ':link' : ''}`;
    setTimeout(() => { if (copied.value?.startsWith(player.id)) copied.value = null; }, 2000);
  } catch {
    /* portapapeles no disponible: el código queda visible para copiarlo a mano */
  }
}

async function generateCode(player: SquadPlayerDto) {
  if (player.inviteCode && !(await confirmDialog({ title: `Nuevo código para ${player.fullName}`, message: 'El código anterior de este jugador dejará de ser válido.', confirmLabel: 'Generar' }))) return;
  void act(async () => {
    detail.value = await api.squads.generatePlayerInviteCode(squadId.value, player.id);
    return `Código personal generado para ${player.fullName}. Entrégaselo solo a este jugador.`;
  });
}

// --- Visibilidad ---
const visibilityOptions: ChoiceOption<SquadVisibility>[] = (['Private', 'Public'] as const).map((value) => ({ value, label: visibilityLabels[value] }));
function setVisibility(visibility: SquadVisibility) {
  if (detail.value?.summary.visibility === visibility) return;
  void act(async () => {
    detail.value = await api.squads.setVisibility(squadId.value, visibility);
    await auth.refreshAccount();
    return visibility === 'Public'
      ? 'La plantilla ya acepta solicitudes: quien quiera ver el acta interna o el vídeo de un partido se lo pedirá al club.'
      : 'La plantilla vuelve a ser privada: nadie puede pedir acceso (los pases que ya diste siguen valiendo).';
  });
}

// --- Convocatorias: a cuántos se convoca ---
const callUpMin = 7;
const callUpMax = 30;
const callUpMode = ref<'ask' | 'fixed'>('ask');
const callUpModeOptions: ChoiceOption<'ask' | 'fixed'>[] = [
  { value: 'ask', label: 'Preguntar en cada partido' },
  { value: 'fixed', label: 'Número fijo' },
];
const callUpSize = ref<number | null>(null);
watch(
  () => detail.value?.callUpSize,
  (size) => {
    callUpMode.value = size ? 'fixed' : 'ask';
    callUpSize.value = size ?? null;
  },
  { immediate: true },
);
const callUpSizeValid = computed(() => callUpSize.value !== null && Number.isInteger(callUpSize.value) && callUpSize.value >= callUpMin && callUpSize.value <= callUpMax);
const callUpChanged = computed(() => {
  const saved = detail.value?.callUpSize ?? null;
  return callUpMode.value === 'ask' ? saved !== null : saved !== callUpSize.value;
});
const callUpBlocked = computed(() => {
  if (busy.value) return 'Espera a que termine lo que se está guardando';
  if (!callUpChanged.value) return 'No has cambiado nada';
  if (callUpMode.value === 'fixed' && !callUpSizeValid.value) return `Pon un número de ${callUpMin} a ${callUpMax}`;
  return undefined;
});

function saveCallUpSize() {
  const size = callUpMode.value === 'fixed' ? callUpSize.value : null;
  void act(async () => {
    detail.value = await api.squads.setCallUpSize(squadId.value, size);
    return size
      ? `Las convocatorias serán siempre de ${size}: no se podrá marcar a más y, si se envía con menos, se avisará de que faltan jugadores.`
      : 'En cada convocatoria se preguntará a cuántos convocas.';
  });
}

// --- Proveedor ---
// Va a la web del proveedor y puede tardar: se avisa en cada clic, para que no se pulse a la ligera.
async function importRoster() {
  const ok = await confirmDialog({
    title: 'Importar fichas de la federación',
    message:
      'Se traerán las fichas de la plantilla que publica la federación (a través de futbolasturiano.es) y que todavía no estén aquí; las que ya tienes no se repiten. Puede tardar un poco.',
    confirmLabel: 'Importar fichas',
  });
  if (!ok) return;
  void act(async () => {
    const before = detail.value?.players.length ?? 0;
    detail.value = await api.squads.importRoster(squadId.value);
    const added = detail.value.players.length - before;
    return added > 0 ? `${added} ${added === 1 ? 'ficha importada' : 'fichas importadas'}.` : 'No había fichas nuevas que importar.';
  });
}

// --- Fichas ---
interface PlayerForm {
  fullName: string;
  position: Position | '';
  shirtNumber: number | '';
}

const toRequest = (form: PlayerForm): SquadPlayerRequest => ({
  fullName: form.fullName.trim(),
  position: form.position || null,
  shirtNumber: typeof form.shirtNumber === 'number' ? form.shirtNumber : null,
});

// «Añadir jugador» abre su ventana: a mano o para uno de los que están a prueba (los apunta la agenda), que pasa con su
// historial. Sin la lista de prueba, se añade igual a mano.
const addOpen = ref(false);
const trials = ref<TrialPlayerDto[]>([]);
async function loadTrials() {
  if (!canManage.value) return;
  try {
    trials.value = await api.trainings.trialPlayers(squadId.value);
  } catch {
    trials.value = [];
  }
}
watch([canManage, squadId], () => void loadTrials(), { immediate: true });
const waitingTrials = computed(() => trials.value.filter((t) => !t.promotedSquadPlayerId).length);

async function onAdded(_player: SquadPlayerDto, fromTrial: boolean) {
  await Promise.all([reload(), fromTrial ? loadTrials() : Promise.resolve()]);
}

// La federación no publica la posición de todos: hasta que el club se la pone, salen arriba con su selector.
const withoutPosition = computed(() => active.value.filter((p) => p.position === null));

function setPosition(player: SquadPlayerDto, position: Position | null) {
  if (!position) return;
  void act(async () => {
    await api.squads.updatePlayer(squadId.value, player.id, { fullName: player.fullName, position, shirtNumber: player.shirtNumber });
    await reload();
    return `${player.fullName}: ${positionLabels[position].toLowerCase()}.`;
  });
}

const editingId = ref<string | null>(null);
const edit = reactive<PlayerForm>({ fullName: '', position: '', shirtNumber: '' });

function startEdit(player: SquadPlayerDto) {
  editingId.value = player.id;
  edit.fullName = player.fullName;
  edit.position = player.position ?? '';
  edit.shirtNumber = player.shirtNumber ?? '';
}

function saveEdit() {
  const id = editingId.value;
  if (!id) return;
  void act(async () => {
    await api.squads.updatePlayer(squadId.value, id, toRequest(edit));
    editingId.value = null;
    await reload();
  });
}

async function remove(player: SquadPlayerDto) {
  const ok = await confirmDialog({
    title: `Dar de baja a ${player.fullName}`,
    message: 'Ya no se podrá convocar, alinear ni citar a entrenamientos, y si tiene cuenta deja de ver la plantilla. Sigue en la lista, en «De baja», con sus actas, su asistencia y sus estadísticas, y se le puede reincorporar.',
    confirmLabel: 'Dar de baja',
    danger: true,
  });
  if (!ok) return;
  void act(async () => {
    await api.squads.removePlayer(squadId.value, player.id);
    await reload();
    return `${player.fullName} ha causado baja.`;
  });
}

async function reinstate(player: SquadPlayerDto) {
  const ok = await confirmDialog({
    title: `Reincorporar a ${player.fullName}`,
    message: 'Vuelve a la plantilla con todo su historial: se le podrá convocar, alinear y citar a entrenamientos. Si tenía la cuenta vinculada, recupera el acceso.',
    confirmLabel: 'Reincorporar',
  });
  if (!ok) return;
  void act(async () => {
    await api.squads.reinstatePlayer(squadId.value, player.id);
    await reload();
    return `${player.fullName} vuelve a la plantilla.`;
  });
}
</script>

<template>
  <template v-if="detail">
    <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>
    <Alert v-if="notice" kind="success" class="mb-4">{{ notice }}</Alert>

    <!-- Gestión (solo cuerpo técnico) -->
    <section v-if="canManage" class="card mb-6">
      <h2 class="font-semibold text-slate-900">Gestión de la plantilla</h2>
      <div class="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Visibilidad</p>
          <ChoiceToggle
            class="mt-2"
            :model-value="detail.summary.visibility"
            :options="visibilityOptions"
            label="Visibilidad"
            :busy="busy"
            :disabled="busy"
            @update:model-value="setVisibility"
          />
          <p class="mt-2 text-xs text-slate-500">
            <template v-if="detail.summary.visibility === 'Private'">Solo el club, el cuerpo técnico y los jugadores vinculados ven actas, estadísticas y vídeos. Nadie de fuera puede pedir acceso; solo quien reciba un pase.</template>
            <template v-else>Lo interno sigue siendo privado, pero cualquiera puede pedirle al club el acta interna o el vídeo de un partido; solo lo ve quien canjee el pase que le des (gratis o con precio). Sus medias cuentan en la comparativa de la liga.</template>
          </p>
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Convocatorias</p>
          <ChoiceToggle v-model="callUpMode" class="mt-2" :options="callUpModeOptions" label="A cuántos se convoca" :disabled="busy" />
          <div v-if="callUpMode === 'fixed'" class="mt-2 flex items-center gap-2">
            <label for="callup-size" class="text-sm text-slate-600">Convocados</label>
            <input id="callup-size" v-model.number="callUpSize" type="number" :min="callUpMin" :max="callUpMax" step="1" class="input w-20 px-2 py-1 text-sm" />
          </div>
          <p class="mt-2 text-xs text-slate-500">
            El número es exacto: al convocar no se puede marcar a más y, si se envía con menos, el cuerpo técnico y el club reciben un aviso de que
            faltan jugadores hasta completarla. <template v-if="callUpMode === 'ask'">Se pregunta al empezar cada convocatoria.</template>
          </p>
          <button type="button" class="btn-secondary btn-sm mt-3" v-busy="busy" :disabled="!!callUpBlocked" :title="callUpBlocked" @click="saveCallUpSize">Guardar</button>
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor de datos</p>
          <p class="mt-2 text-xs text-slate-500">Si la federación publica fichas nuevas (futbolasturiano.es), tráelas a la plantilla. Antes de importar te avisa: puede tardar.</p>
          <button
            type="button"
            class="btn-secondary btn-sm mt-3"
            v-busy="busy"
            :disabled="busy"
            :title="busy ? 'Espera a que termine lo que se está guardando' : 'Trae las fichas nuevas de la federación; antes te pide confirmación'"
            @click="importRoster"
          >
            <Icon icon="download" class="mr-1.5 h-3 w-3" />Importar fichas de la federación
          </button>
        </div>
      </div>
    </section>

    <section v-if="canManage && withoutPosition.length > 0" class="card mb-6 border-amber-400/40">
      <h2 class="flex items-center gap-2 font-semibold text-slate-900">
        <Icon icon="triangle-exclamation" class="h-4 w-4 text-amber-400" />
        {{ withoutPosition.length }} {{ withoutPosition.length === 1 ? 'jugador sin posición' : 'jugadores sin posición' }}
      </h2>
      <p class="mt-1 text-xs text-slate-500">
        La federación no publica la posición de todos sus jugadores: pónsela tú. La convocatoria y el acta los agrupan por posición y la
        nota de cada partido depende de ella. Si la federación la publica más adelante, se pone sola.
      </p>
      <!-- En rejilla: en una pantalla ancha cada selector queda junto a su jugador, no al otro lado de la página. -->
      <ul class="mt-3 grid grid-cols-1 gap-x-8 lg:grid-cols-2 2xl:grid-cols-3">
        <li v-for="player in withoutPosition" :key="player.id" class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 py-2">
          <PlayerName :name="player.fullName" :photo-url="player.photoUrl" size="sm" class="font-medium text-slate-800" />
          <SearchSelect
            class="w-48"
            size="sm"
            :aria-label="`Posición de ${player.fullName}`"
            placeholder="Elige su posición"
            :model-value="null"
            :options="positionOptions"
            :disabled="busy"
            @update:model-value="setPosition(player, $event as Position | null)"
          />
        </li>
      </ul>
    </section>

    <SquadSeasonTable class="mb-6" :squad-id="squadId" :highlight-id="myEntryId" :discipline="playerDiscipline" :cycles="playerCycles" />

    <Alert v-if="canInvitePlayers" kind="info" class="mb-6">
      Genera el código personal junto al nombre de cada jugador y entrégaselo solo a él. Con ese código se da de alta sin escribir
      nada más: la cuenta se crea con el nombre de su ficha y el código queda invalidado al utilizarse.
    </Alert>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Jugadores -->
      <section class="card lg:col-span-2">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
            <h2 class="font-semibold text-slate-900">{{ canManage || canInvitePlayers ? 'Fichas e invitaciones' : 'Fichas' }}</h2>
            <button v-if="canManage" type="button" class="btn-primary btn-sm py-1.5" @click="addOpen = true">
              <Icon icon="plus" class="mr-1.5 h-3 w-3" />Añadir jugador
              <Badge v-if="waitingTrials > 0" tone="amber">{{ waitingTrials }} a prueba</Badge>
            </button>
          </div>
          <div class="flex items-center gap-3">
            <GroupByPositionToggle v-if="active.length > 0" v-model="grouped" />
            <span class="text-xs text-slate-500">{{ active.length }} activos<template v-if="left.length > 0"> · {{ left.length }} de baja</template></span>
          </div>
        </div>

        <p v-if="players.length === 0" class="text-sm text-slate-500">
          Todavía no hay fichas en la plantilla.<template v-if="canManage"> Impórtalas de la federación, en «Gestión de la plantilla», o añádelas con «Añadir jugador».</template>
        </p>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="text-xs text-slate-500">
              <tr>
                <SortHeader class="py-2 pr-3 text-left" label="Jugador" v-bind="state('name')" @sort="sortBy('name')" />
                <SortHeader class="col-sm py-2 pr-3 text-left" label="Posición" title="Posición (portero, defensa, centrocampista, delantero)" v-bind="state('position')" @sort="sortBy('position')" />
                <SortHeader class="col-md py-2 pr-3 text-left" label="Cuenta" title="Cuenta vinculada" v-bind="state('account')" @sort="sortBy('account')" />
                <th v-if="canInvitePlayers" class="py-2 pr-3 text-left uppercase tracking-wide">Invitación personal</th>
                <th v-if="canManage" class="py-2 text-right uppercase tracking-wide"></th>
              </tr>
            </thead>
            <tbody v-for="group in groups" :key="group.key" class="divide-y divide-slate-100">
              <tr v-if="group.label">
                <td :colspan="columnCount" class="bg-surface-2 px-2 py-1.5 font-display text-2xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {{ group.label }} · {{ group.rows.length }}
                  <span v-if="group.left" class="ml-1 font-sans font-normal normal-case tracking-normal">— estuvieron en la plantilla y ya no están: no se convocan, alinean ni citan; sus actas se conservan</span>
                </td>
              </tr>
              <tr v-for="player in group.rows" :key="player.id" :class="player.id === myEntryId ? 'bg-brand-500/10' : ''">
                <template v-if="isLeft(player)">
                  <td class="py-2 pr-3">
                    <RouterLink
                      :to="{ name: 'squad-player', params: { squadId, squadPlayerId: player.id } }"
                      class="font-medium text-slate-500 hover:text-accent-400 hover:underline"
                    ><PlayerName :name="player.fullName" :photo-url="player.photoUrl" size="sm" /></RouterLink>
                    <p class="text-xs text-slate-400">
                      <Badge>De baja</Badge><template v-if="player.leftOn"> desde el {{ formatDate(player.leftOn) }}</template>
                    </p>
                  </td>
                  <td class="col-sm py-2 pr-3 text-slate-500">{{ player.position ? positionLabels[player.position] : '—' }}</td>
                  <td class="col-md py-2 pr-3">
                    <span class="text-xs text-slate-400">{{ player.linked ? 'Vinculado' : 'Sin vincular' }}</span>
                  </td>
                  <td v-if="canInvitePlayers" class="py-2 pr-3 text-xs text-slate-400">—</td>
                  <td v-if="canManage" class="py-2 text-right whitespace-nowrap">
                    <button type="button" class="btn-ghost btn-sm" v-busy="busy" :disabled="busy" @click="reinstate(player)">Reincorporar</button>
                  </td>
                </template>
                <template v-else-if="editingId === player.id">
                  <td class="py-2 pr-3">
                    <input v-model="edit.fullName" type="text" required maxlength="150" class="input px-2 py-1" aria-label="Nombre" />
                  </td>
                  <td class="col-sm py-2 pr-3">
                    <SearchSelect
                      size="sm"
                      aria-label="Posición"
                      placeholder="Elige su posición"
                      :model-value="edit.position || null"
                      :options="positionOptions"
                      @update:model-value="edit.position = ($event as Position | null) ?? ''"
                    />
                  </td>
                  <td class="col-md py-2 pr-3 text-xs text-slate-500">{{ player.linked ? player.linkedPlayerName : '—' }}</td>
                  <td v-if="canInvitePlayers" class="py-2 pr-3 text-xs text-slate-500">{{ player.linked ? 'Vinculado' : '—' }}</td>
                  <td class="py-2 text-right whitespace-nowrap">
                    <button type="button" class="btn-primary btn-sm" v-busy="busy" :disabled="busy || !edit.position || !edit.fullName.trim()" :title="edit.position ? undefined : 'Elige su posición'" @click="saveEdit">Guardar</button>
                    <button type="button" class="btn-ghost btn-sm ml-1" @click="editingId = null">Cancelar</button>
                  </td>
                </template>
                <template v-else>
                  <td class="py-2 pr-3">
                    <RouterLink
                      :to="{ name: 'squad-player', params: { squadId, squadPlayerId: player.id } }"
                      class="font-medium text-slate-800 hover:text-accent-400 hover:underline"
                    ><PlayerName :name="player.fullName" :photo-url="player.photoUrl" size="sm" /></RouterLink>
                    <p class="text-xs text-slate-400">{{ player.fromRoster ? 'futbolasturiano.es' : 'añadido a mano' }}</p>
                  </td>
                  <td class="col-sm py-2 pr-3 text-slate-600">
                    <template v-if="player.position">{{ positionLabels[player.position] }}</template>
                    <span v-else-if="canManage" class="text-amber-400">Sin posición</span>
                    <template v-else>—</template>
                  </td>
                  <td class="col-md py-2 pr-3">
                    <Badge v-if="player.linked" tone="green">{{ player.id === myEntryId ? 'Eres tú' : 'Vinculado' }}</Badge>
                    <span v-else class="text-xs text-slate-400">Sin vincular</span>
                  </td>
                  <td v-if="canInvitePlayers" class="py-2 pr-3">
                    <span v-if="player.linked" class="text-xs text-slate-400">Código utilizado</span>
                    <template v-else>
                      <p v-if="player.inviteCode" class="mb-1 font-mono text-sm tracking-widest text-slate-900">{{ player.inviteCode }}</p>
                      <div class="flex flex-wrap gap-1">
                        <button v-if="player.inviteCode" type="button" class="btn-secondary btn-sm px-2" :aria-label="`Copiar código de ${player.fullName}`" @click="copyCode(player)">{{ copied === player.id ? 'Copiado ✓' : 'Copiar' }}</button>
                        <button v-if="player.inviteCode" type="button" class="btn-ghost btn-sm px-2" :aria-label="`Copiar enlace de alta de ${player.fullName}`" title="Enlace a la página de alta con el código ya puesto" @click="copyCode(player, true)"><Icon icon="link" class="mr-1 h-3 w-3" />{{ copied === `${player.id}:link` ? 'Copiado ✓' : 'Enlace de alta' }}</button>
                        <button type="button" class="btn-ghost btn-sm px-2" :aria-label="`Generar código para ${player.fullName}`" v-busy="busy" :disabled="busy" @click="generateCode(player)">{{ player.inviteCode ? 'Generar otro' : 'Generar código' }}</button>
                      </div>
                    </template>
                  </td>
                  <td v-if="canManage" class="py-2 text-right whitespace-nowrap">
                    <button type="button" class="btn-ghost btn-sm" v-busy="busy" :disabled="busy" @click="startEdit(player)">Editar</button>
                    <button type="button" class="btn-ghost-danger btn-sm" v-busy="busy" :disabled="busy" @click="remove(player)">Baja</button>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

      </section>

      <div class="space-y-6 self-start">
      <InjuryPanel v-if="seesInjuries" :squad-id="squadId" :players="detail.players" :can-manage="canManage" @changed="reload" />

      <!-- Cuerpo técnico -->
      <section class="card">
        <h2 class="mb-3 font-semibold text-slate-900">Cuerpo técnico</h2>
        <ul class="divide-y divide-slate-100 text-sm">
          <li v-for="member in detail.staff" :key="member.coachId" class="py-2">
            <RouterLink :to="{ name: 'coach', params: { coachId: member.coachId } }" class="group flex items-center gap-3" :title="`Ver el perfil de ${member.displayName}`">
              <PlayerAvatar :src="member.photoUrl" :name="member.displayName" size="md" />
              <span class="min-w-0">
                <span class="block break-words font-medium text-slate-800 group-hover:text-accent-400">{{ member.displayName }}</span>
                <span class="block text-xs text-slate-500">
                  {{ staffRoleLabels[member.role] }} · desde {{ formatDate(member.joinedAt) }}<template v-if="member.validUntil"> · hasta {{ formatDate(member.validUntil) }}</template>
                </span>
                <span v-if="staffDiscipline.get(member.coachId)" class="mt-1 flex flex-wrap items-center gap-2">
                  <CardTally
                    :yellow-cards="staffDiscipline.get(member.coachId)!.yellowCards"
                    :red-cards="staffDiscipline.get(member.coachId)!.redCards"
                    title="Tarjetas de la temporada en las actas oficiales"
                  />
                  <DisciplineBadge :discipline="staffDiscipline.get(member.coachId)!.next" staff />
                </span>
              </span>
            </RouterLink>
          </li>
        </ul>
        <p v-if="canManage" class="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Los nombramientos los emite el club: cada técnico entra con su código de acceso y sale cuando caduca o se revoca.
        </p>
      </section>
      </div>
    </div>

    <AddSquadPlayerModal v-if="canManage" :open="addOpen" :squad-id="squadId" :trials="trials" @close="addOpen = false" @added="onAdded" />
  </template>
</template>
