<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { ClubInvitationDto, ClubInvitationStatus } from '@/types/api';
import { formatKickoff } from '@/utils/format';

/**
 * Invitaciones de la beta cerrada: cada código sirve para que un club se dé de alta una sola vez. Se comparte el enlace
 * /registro?beta=CODIGO, que abre el alta de club con el código puesto.
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

async function load() {
  loading.value = true;
  const result = await guard(() => adminApi.invitations(props.token));
  if (result) invitations.value = result;
  loading.value = false;
}

async function create() {
  creating.value = true;
  const created = await guard(() => adminApi.createInvitation(props.token, note.value.trim() || null, days.value || null));
  if (created) {
    invitations.value = [created, ...invitations.value];
    note.value = '';
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
</script>

<template>
  <section class="card">
    <h2 class="font-semibold text-slate-900">Invitaciones de clubes (beta cerrada)</h2>
    <p class="mb-3 text-xs text-slate-500">
      Cada código sirve para dar de alta un club una sola vez. Al crearla se copia el enlace de alta (/registro?beta=CÓDIGO) para mandárselo.
      Técnicos y jugadores no la necesitan: entran con el código que les da su club.
    </p>

    <form class="mb-4 flex flex-wrap items-end gap-3" @submit.prevent="create">
      <label class="min-w-[14rem] flex-1">
        <span class="label">Para quién (solo lo ves tú)</span>
        <input v-model="note" type="text" maxlength="200" placeholder="CD Vallobín" class="input" />
      </label>
      <label class="w-36">
        <span class="label">Caduca en (días)</span>
        <input v-model.number="days" type="number" min="1" max="365" placeholder="Nunca" class="input" />
      </label>
      <button type="submit" class="btn-primary" v-busy="creating" :disabled="creating">Crear invitación</button>
    </form>

    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>
    <p v-if="!loading && invitations.length === 0" class="text-sm text-slate-500">Todavía no hay invitaciones.</p>

    <div v-else-if="invitations.length" class="overflow-x-auto rounded-lg border border-slate-200">
      <table class="min-w-full text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th class="px-3 py-2 text-left">Código</th>
            <th class="px-3 py-2 text-left">Para</th>
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
              {{ invitation.note ?? '—' }}
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
