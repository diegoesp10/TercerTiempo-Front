<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import { useSquad } from '@/composables/useSquad';
import { useAuthStore } from '@/stores/auth';
import type { Position, SquadPlayerDto, SquadPlayerRequest, SquadVisibility } from '@/types/api';
import { formatDate, positionLabels, positionOptions, staffRoleLabels, visibilityLabels } from '@/utils/format';

const { squadId, detail, reload } = useSquad();
const auth = useAuthStore();

const canManage = computed(() => detail.value?.canManage ?? false);
const active = computed(() => (detail.value?.players ?? []).filter((p) => p.status === 'Active'));
const left = computed(() => (detail.value?.players ?? []).filter((p) => p.status !== 'Active'));
const myEntryId = computed(() => (auth.playerSquad?.squadId === squadId.value ? auth.playerSquad.squadPlayerId : null));

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

// --- Código de invitación ---
const copied = ref(false);

async function copyCode() {
  const code = detail.value?.inviteCode;
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    copied.value = true;
    setTimeout(() => (copied.value = false), 2000);
  } catch {
    /* portapapeles no disponible: el código queda visible para copiarlo a mano */
  }
}

function rotateCode() {
  if (!confirm('El código actual dejará de valer para quien aún no lo haya usado. ¿Generar uno nuevo?')) return;
  void act(async () => {
    detail.value = await api.squads.rotateInviteCode(squadId.value);
    return 'Código nuevo generado.';
  });
}

// --- Visibilidad ---
function setVisibility(visibility: SquadVisibility) {
  if (detail.value?.summary.visibility === visibility) return;
  void act(async () => {
    detail.value = await api.squads.setVisibility(squadId.value, visibility);
    await auth.refreshAccount();
    return visibility === 'Public'
      ? 'La plantilla ya es pública: cualquiera puede ver sus actas y estadísticas.'
      : 'La plantilla vuelve a ser privada.';
  });
}

// --- Proveedor ---
function importRoster() {
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

const newPlayer = reactive<PlayerForm>({ fullName: '', position: '', shirtNumber: '' });

function add() {
  void act(async () => {
    const player = await api.squads.addPlayer(squadId.value, toRequest(newPlayer));
    newPlayer.fullName = '';
    newPlayer.position = '';
    newPlayer.shirtNumber = '';
    await reload();
    return `${player.fullName} añadido a la plantilla.`;
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

function remove(player: SquadPlayerDto) {
  if (!confirm(`¿Dar de baja a ${player.fullName}? Sus actas se conservan.`)) return;
  void act(async () => {
    await api.squads.removePlayer(squadId.value, player.id);
    await reload();
    return `${player.fullName} ha causado baja.`;
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
      <div class="mt-4 grid gap-6 md:grid-cols-3">
        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Código de invitación</p>
          <p class="mt-2 font-mono text-2xl font-semibold tracking-[0.3em] text-slate-900">{{ detail.inviteCode }}</p>
          <p class="mt-1 text-xs text-slate-500">Compártelo con el resto del staff y con los jugadores para que se vinculen a su ficha.</p>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" class="btn-secondary px-3 py-1 text-xs" @click="copyCode">{{ copied ? 'Copiado ✓' : 'Copiar' }}</button>
            <button type="button" class="btn-ghost px-3 py-1 text-xs" :disabled="busy" @click="rotateCode">Generar otro</button>
          </div>
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Visibilidad</p>
          <div class="mt-2 inline-flex rounded-lg border border-slate-200 p-0.5" role="radiogroup" aria-label="Visibilidad">
            <button
              v-for="option in (['Private', 'Public'] as SquadVisibility[])"
              :key="option"
              type="button"
              role="radio"
              :aria-checked="detail.summary.visibility === option"
              class="rounded-md px-3 py-1 text-sm font-medium transition"
              :class="detail.summary.visibility === option ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
              :disabled="busy"
              @click="setVisibility(option)"
            >
              {{ visibilityLabels[option] }}
            </button>
          </div>
          <p class="mt-2 text-xs text-slate-500">
            <template v-if="detail.summary.visibility === 'Private'">Solo el cuerpo técnico y los jugadores vinculados ven actas y estadísticas.</template>
            <template v-else>Cualquiera puede ver las actas y estadísticas; los jugadores de la liga se comparan con ellas.</template>
          </p>
        </div>

        <div>
          <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Proveedor de datos</p>
          <p class="mt-2 text-xs text-slate-500">Añade las fichas publicadas por futbolasturiano.es que aún no estén en la plantilla.</p>
          <button type="button" class="btn-secondary mt-3 px-3 py-1 text-xs" :disabled="busy" @click="importRoster">Importar plantilla publicada</button>
        </div>
      </div>
    </section>

    <div class="grid gap-6 lg:grid-cols-3">
      <!-- Jugadores -->
      <section class="card lg:col-span-2">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold text-slate-900">Jugadores</h2>
          <span class="text-xs text-slate-500">{{ active.length }} activos</span>
        </div>

        <p v-if="active.length === 0" class="text-sm text-slate-500">
          Todavía no hay fichas en la plantilla.<template v-if="canManage"> Impórtalas del proveedor o añádelas a mano.</template>
        </p>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="py-2 pr-3 text-left">#</th>
                <th class="py-2 pr-3 text-left">Jugador</th>
                <th class="py-2 pr-3 text-left">Posición</th>
                <th class="py-2 pr-3 text-left">Cuenta</th>
                <th v-if="canManage" class="py-2 text-right"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="player in active" :key="player.id" :class="player.id === myEntryId ? 'bg-emerald-50' : ''">
                <template v-if="editingId === player.id">
                  <td class="py-2 pr-3">
                    <input v-model.number="edit.shirtNumber" type="number" min="1" max="99" class="input w-16 px-2 py-1" aria-label="Dorsal" />
                  </td>
                  <td class="py-2 pr-3">
                    <input v-model="edit.fullName" type="text" required maxlength="150" class="input px-2 py-1" aria-label="Nombre" />
                  </td>
                  <td class="py-2 pr-3">
                    <select v-model="edit.position" class="input px-2 py-1" aria-label="Posición">
                      <option value="">—</option>
                      <option v-for="option in positionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                  </td>
                  <td class="py-2 pr-3 text-xs text-slate-500">{{ player.linked ? player.linkedPlayerName : '—' }}</td>
                  <td class="py-2 text-right whitespace-nowrap">
                    <button type="button" class="btn-primary px-3 py-1 text-xs" :disabled="busy" @click="saveEdit">Guardar</button>
                    <button type="button" class="btn-ghost ml-1 px-3 py-1 text-xs" @click="editingId = null">Cancelar</button>
                  </td>
                </template>
                <template v-else>
                  <td class="py-2 pr-3 tabular-nums text-slate-500">{{ player.shirtNumber ?? '—' }}</td>
                  <td class="py-2 pr-3">
                    <p class="font-medium text-slate-800">{{ player.fullName }}</p>
                    <p class="text-xs text-slate-400">{{ player.fromRoster ? 'futbolasturiano.es' : 'añadido a mano' }}</p>
                  </td>
                  <td class="py-2 pr-3 text-slate-600">{{ player.position ? positionLabels[player.position] : '—' }}</td>
                  <td class="py-2 pr-3">
                    <Badge v-if="player.linked" tone="green">{{ player.id === myEntryId ? 'Eres tú' : 'Vinculado' }}</Badge>
                    <span v-else class="text-xs text-slate-400">Sin cuenta</span>
                  </td>
                  <td v-if="canManage" class="py-2 text-right whitespace-nowrap">
                    <button type="button" class="btn-ghost px-3 py-1 text-xs" :disabled="busy" @click="startEdit(player)">Editar</button>
                    <button type="button" class="btn-ghost px-3 py-1 text-xs text-red-600 hover:bg-red-50" :disabled="busy" @click="remove(player)">Baja</button>
                  </td>
                </template>
              </tr>
            </tbody>
          </table>
        </div>

        <form v-if="canManage" class="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4" @submit.prevent="add">
          <div class="w-20">
            <label class="label" for="new-shirt">Dorsal</label>
            <input id="new-shirt" v-model.number="newPlayer.shirtNumber" type="number" min="1" max="99" class="input px-2" />
          </div>
          <div class="min-w-48 flex-1">
            <label class="label" for="new-name">Nombre y apellidos</label>
            <input id="new-name" v-model="newPlayer.fullName" type="text" required maxlength="150" class="input" placeholder="Nuevo jugador" />
          </div>
          <div class="w-44">
            <label class="label" for="new-position">Posición</label>
            <select id="new-position" v-model="newPlayer.position" class="input">
              <option value="">—</option>
              <option v-for="option in positionOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
            </select>
          </div>
          <button type="submit" class="btn-primary" :disabled="busy || !newPlayer.fullName.trim()">Añadir</button>
        </form>

        <details v-if="left.length > 0" class="mt-4 text-sm">
          <summary class="cursor-pointer text-slate-500">Bajas ({{ left.length }})</summary>
          <ul class="mt-2 divide-y divide-slate-100">
            <li v-for="player in left" :key="player.id" class="flex items-center justify-between py-1 text-slate-500">
              <span>{{ player.fullName }}</span>
              <Badge>Baja</Badge>
            </li>
          </ul>
        </details>
      </section>

      <!-- Cuerpo técnico -->
      <section class="card self-start">
        <h2 class="mb-3 font-semibold text-slate-900">Cuerpo técnico</h2>
        <ul class="divide-y divide-slate-100 text-sm">
          <li v-for="member in detail.staff" :key="member.coachId" class="py-2">
            <p class="font-medium text-slate-800">{{ member.displayName }}</p>
            <p class="text-xs text-slate-500">{{ staffRoleLabels[member.role] }} · desde {{ formatDate(member.joinedAt) }}</p>
          </li>
        </ul>
        <p v-if="canManage" class="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          Para incorporar a alguien al staff, pásale el código de invitación: al unirse elige su rol.
        </p>
      </section>
    </div>
  </template>
</template>
