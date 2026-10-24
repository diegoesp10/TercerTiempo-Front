<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { ClubInvitationDto, ClubInvitationStatus, InvitationClubDto } from '@/types/api';
import { formatKickoff } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';

/**
 * Invitaciones de la beta cerrada: cada código sirve para que un club se dé de alta una sola vez. Se comparte el enlace
 * /registro?beta=CODIGO, que abre el alta de club con el código puesto y el club fijado: cada invitación es para un club
 * del catálogo, que se busca al escribir viendo cuáles tienen ya invitación o cuenta.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const invitations = ref<ClubInvitationDto[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const note = ref('');
const days = ref<number | null>(30);
const creating = ref(false);
const copied = ref<string | null>(null);

const suggestions = ref<InvitationClubDto[]>([]);
const open = ref(false);
const active = ref(-1);
const searching = ref(false);
const selected = ref<InvitationClubDto | null>(null);
let searchTimer: ReturnType<typeof setTimeout> | null = null;
let searchId = 0;

const statusLabels: Record<ClubInvitationStatus, string> = { available: 'Disponible', used: 'Usada', expired: 'Caducada', revoked: 'Anulada' };
const statusTone: Record<ClubInvitationStatus, 'green' | 'blue' | 'slate' | 'red'> = { available: 'green', used: 'blue', expired: 'slate', revoked: 'red' };

async function guard<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    error.value = null;
    return await action();
  } catch (e) {
    if ((e as { status?: number }).status === 401) emit('unauthorized');
    else error.value = errorMessage(e);
    return undefined;
  }
}

/** Lo que tiene cada club: cuenta dada de alta, invitación (y en qué estado) o nada. */
function clubState(club: InvitationClubDto): { label: string; tone: 'green' | 'blue' | 'slate' | 'red' | 'amber' } {
  if (club.registeredAs) return { label: 'Ya tiene cuenta', tone: 'blue' };
  if (!club.invitation) return { label: 'Sin invitación', tone: 'amber' };
  const state = statusLabels[club.invitation.status];
  return { label: club.invitation.status === 'available' ? `${state} · ${club.invitation.code}` : state, tone: statusTone[club.invitation.status] };
}

const teamsLine = (club: InvitationClubDto) =>
  club.teams.map((t) => (t.competitionName ? `${t.name} (${t.competitionName})` : t.name)).join(' · ');

function onNoteInput() {
  if (selected.value && note.value !== selected.value.name) selected.value = null;
  if (searchTimer) clearTimeout(searchTimer);
  const text = note.value.trim();
  if (text.length < 2) {
    suggestions.value = [];
    open.value = false;
    return;
  }
  searchTimer = setTimeout(() => void search(text), 200);
}

async function search(text: string) {
  const id = ++searchId;
  searching.value = true;
  const found = await guard(() => adminApi.invitationClubs(props.token, text));
  // Solo vale la respuesta de lo último escrito.
  if (id !== searchId) return;
  searching.value = false;
  suggestions.value = found ?? [];
  active.value = suggestions.value.length ? 0 : -1;
  open.value = true;
}

function choose(club: InvitationClubDto) {
  // Un club con cuenta ya no necesita invitación.
  if (club.registeredAs) return;
  selected.value = club;
  note.value = club.name;
  open.value = false;
}

function onNoteKeydown(event: KeyboardEvent) {
  if (!open.value || suggestions.value.length === 0) return;
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    active.value = (active.value + 1) % suggestions.value.length;
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    active.value = (active.value - 1 + suggestions.value.length) % suggestions.value.length;
  } else if (event.key === 'Enter' && active.value >= 0) {
    event.preventDefault();
    choose(suggestions.value[active.value]!);
  } else if (event.key === 'Escape') {
    open.value = false;
  }
}

/** Al salir del campo se cierra la lista; con un respiro para que el clic en una opción llegue antes. */
function onNoteBlur() {
  setTimeout(() => { open.value = false; }, 150);
}

async function load() {
  loading.value = true;
  const result = await guard(() => adminApi.invitations(props.token));
  if (result) invitations.value = result;
  loading.value = false;
}

async function create() {
  creating.value = true;
  const club = selected.value;
  if (!club) return;
  const created = await guard(() => adminApi.createInvitation(props.token, null, days.value || null, club.teamId));
  if (created) {
    invitations.value = [created, ...invitations.value];
    note.value = '';
    selected.value = null;
    suggestions.value = [];
    await copy(created);
  }
  creating.value = false;
}

async function revoke(invitation: ClubInvitationDto) {
  const ok = await confirmDialog({
    title: `Anular la invitación ${invitation.code}`,
    message: 'Dejará de servir para dar de alta un club. Los clubes que ya entraron no se ven afectados.',
    confirmLabel: 'Anular',
    danger: true,
  });
  if (!ok) return;
  const updated = await guard(() => adminApi.revokeInvitation(props.token, invitation.id));
  if (updated) invitations.value = invitations.value.map((i) => (i.id === updated.id ? { ...updated, clubName: i.clubName } : i));
}

const link = (invitation: ClubInvitationDto) => `${window.location.origin}/registro?beta=${invitation.code}`;

async function copy(invitation: ClubInvitationDto) {
  try {
    await navigator.clipboard.writeText(link(invitation));
    copied.value = invitation.id;
    setTimeout(() => { if (copied.value === invitation.id) copied.value = null; }, 2500);
  } catch {
    /* sin portapapeles: el enlace se ve en la tabla */
  }
}

onMounted(load);
onBeforeUnmount(() => { if (searchTimer) clearTimeout(searchTimer); });
</script>

<template>
  <section class="card">
    <h2 class="font-semibold text-slate-900">Invitaciones de clubes (beta cerrada)</h2>
    <p class="mb-3 text-xs text-slate-500">
      Cada código sirve para dar de alta un club una sola vez. Al crearla se copia el enlace de alta (/registro?beta=CÓDIGO) para mandárselo.
      Técnicos y jugadores no la necesitan: entran con el código que les da su club.
    </p>

    <form class="mb-4 flex flex-wrap items-end gap-3" @submit.prevent="create">
      <div class="relative min-w-[14rem] flex-1">
        <label class="label" for="invite-note">Club</label>
        <input
          id="invite-note"
          v-model="note"
          type="text"
          maxlength="200"
          autocomplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-controls="invite-teams"
          :aria-expanded="open"
          class="input"
          @input="onNoteInput"
          @keydown="onNoteKeydown"
          @focus="open = suggestions.length > 0"
          @blur="onNoteBlur"
        />
        <ul
          v-if="open"
          id="invite-teams"
          role="listbox"
          class="absolute inset-x-0 top-full z-20 mt-1 max-h-80 overflow-y-auto rounded-lg border border-line bg-surface py-1 shadow-card"
        >
          <li v-if="suggestions.length === 0" class="px-3 py-2 text-sm text-slate-500">
            Ningún club ni equipo se llama así: solo se puede invitar a los clubes de las ligas que sigue Tercer Tiempo.
          </li>
          <li
            v-for="(club, i) in suggestions"
            :key="club.teamId"
            role="option"
            :aria-selected="i === active"
            :aria-disabled="!!club.registeredAs"
            class="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            :class="[i === active ? 'bg-brand-500/15' : 'hover:bg-surface-2', club.registeredAs ? 'cursor-not-allowed opacity-60' : 'cursor-pointer']"
            @mousedown.prevent="choose(club)"
            @mouseenter="active = i"
          >
            <span class="min-w-0">
              <TeamName :name="club.name" :team-id="club.teamId" class="text-slate-900" size="sm" />
              <span class="block truncate text-xs text-slate-500">{{ teamsLine(club) }}</span>
            </span>
            <Badge :tone="clubState(club).tone" class="shrink-0">{{ clubState(club).label }}</Badge>
          </li>
        </ul>
        <p v-if="selected" class="mt-1 text-xs text-slate-500">
          La invitación será solo para {{ selected.name }}: en el alta irá fijado y no se podrá cambiar.
          <span v-if="selected.invitation?.status === 'available'" class="text-amber-700">Ya tiene una disponible ({{ selected.invitation.code }}); la nueva será otra más.</span>
        </p>
        <p v-else-if="note.trim().length >= 2 && !open" class="mt-1 text-xs text-amber-700">Elige el club de la lista.</p>
      </div>
      <label class="w-36">
        <span class="label">Caduca en (días)</span>
        <input v-model.number="days" type="number" min="1" max="365" placeholder="Nunca" class="input" />
      </label>
      <button type="submit" class="btn-primary" v-busy="creating" :disabled="creating || !selected">Crear invitación</button>
    </form>

    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>
    <p v-if="!loading && invitations.length === 0" class="text-sm text-slate-500">Todavía no hay invitaciones.</p>

    <div v-else-if="invitations.length" class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left">Código</th>
            <th class="px-3 py-2 text-left">Club</th>
            <th class="px-3 py-2 text-left">Estado</th>
            <th class="px-3 py-2 text-left">Creada</th>
            <th class="px-3 py-2 text-left">Caduca</th>
            <th class="px-3 py-2 text-right"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-for="invitation in invitations" :key="invitation.id">
            <td class="px-3 py-2 font-mono tracking-widest text-slate-900">{{ invitation.code }}</td>
            <td class="px-3 py-2 text-slate-700">
              <TeamName v-if="invitation.teamId" :name="invitation.note ?? 'Club'" :team-id="invitation.teamId" />
              <template v-else>{{ invitation.note ?? '—' }}</template>
              <span v-if="invitation.clubName" class="block text-xs text-slate-500">Alta: {{ invitation.clubName }}</span>
            </td>
            <td class="px-3 py-2"><Badge :tone="statusTone[invitation.status]">{{ statusLabels[invitation.status] }}</Badge></td>
            <td class="px-3 py-2 text-xs whitespace-nowrap text-slate-600">{{ formatKickoff(invitation.createdAt) }}</td>
            <td class="px-3 py-2 text-xs whitespace-nowrap text-slate-600">{{ invitation.expiresAt ? formatKickoff(invitation.expiresAt) : 'Nunca' }}</td>
            <td class="px-3 py-2 text-right whitespace-nowrap">
              <template v-if="invitation.status === 'available'">
                <button type="button" class="btn-ghost text-xs" @click="copy(invitation)">{{ copied === invitation.id ? 'Enlace copiado' : 'Copiar enlace' }}</button>
                <button type="button" class="btn-ghost text-xs text-red-600" @click="revoke(invitation)">Anular</button>
              </template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
