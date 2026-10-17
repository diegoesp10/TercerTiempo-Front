<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAuthStore } from '@/stores/auth';
import type { SquadInviteDto, StaffRole } from '@/types/api';
import { positionLabels, staffRoleOptions } from '@/utils/format';

const props = defineProps<{ code?: string }>();

const auth = useAuthStore();
const router = useRouter();

const code = ref((props.code ?? '').toUpperCase());
const role = ref<StaffRole>('AssistantCoach');
const loading = ref(false);
const joining = ref<string | null>(null);
const error = ref<string | null>(null);
const invite = shallowRef<SquadInviteDto | null>(null);

/** Misma normalización que la API: minúsculas, sin tildes, separadores colapsados. */
const normalize = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[\s\-._]+/g, ' ').trim();

const suggested = computed(() => {
  const mine = auth.player ? normalize(auth.player.displayName) : '';
  return invite.value?.unlinkedPlayers.find((p) => normalize(p.fullName) === mine) ?? null;
});

const others = computed(() => invite.value?.unlinkedPlayers.filter((p) => p.id !== suggested.value?.id) ?? []);

async function lookup() {
  loading.value = true;
  error.value = null;
  invite.value = null;
  try {
    invite.value = await api.players.invite(code.value);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function joinAsPlayer(squadPlayerId: string) {
  joining.value = squadPlayerId;
  error.value = null;
  try {
    auth.setPlayer(await api.players.joinSquad({ inviteCode: code.value, squadPlayerId }));
    await router.push({ name: 'home' });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    joining.value = null;
  }
}

async function joinAsStaff() {
  loading.value = true;
  error.value = null;
  try {
    const squad = await api.squads.joinStaff({ inviteCode: code.value, role: role.value });
    await auth.refreshAccount();
    await router.push({ name: 'squad', params: { squadId: squad.summary.id } });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (auth.isPlayer && code.value && !auth.playerSquad) void lookup();
});
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PageHeader
      :title="auth.isPlayer ? 'Vincúlate a tu plantilla' : 'Únete a un cuerpo técnico'"
      :subtitle="auth.isPlayer
        ? 'Tu cuerpo técnico te facilita el código de invitación de la plantilla.'
        : 'Con el código de invitación que te da el cuerpo técnico actual de la plantilla.'"
    />

    <Alert v-if="auth.isPlayer && auth.playerSquad" kind="info" class="mb-4">
      Ya estás vinculado a <strong>{{ auth.playerSquad.teamName }}</strong>. Para cambiar de plantilla, desvincúlate primero desde
      <RouterLink to="/" class="font-medium underline">tu panel</RouterLink>.
    </Alert>

    <div v-else class="card">
      <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>

      <form class="flex flex-wrap items-end gap-3" @submit.prevent="auth.isPlayer ? lookup() : joinAsStaff()">
        <div class="min-w-48 flex-1">
          <label class="label" for="code">Código de invitación</label>
          <input
            id="code"
            v-model="code"
            type="text"
            required
            maxlength="12"
            autocomplete="off"
            spellcheck="false"
            placeholder="ABCD2345"
            class="input font-mono uppercase tracking-widest"
            @input="code = code.toUpperCase()"
          />
        </div>
        <div v-if="auth.isCoach" class="min-w-48">
          <label class="label" for="role">Tu rol en la plantilla</label>
          <select id="role" v-model="role" class="input">
            <option v-for="option in staffRoleOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
          </select>
        </div>
        <button type="submit" class="btn-primary" :disabled="loading || code.trim().length < 4">
          {{ loading ? 'Comprobando…' : auth.isPlayer ? 'Buscar mi plantilla' : 'Unirme al cuerpo técnico' }}
        </button>
      </form>

      <template v-if="auth.isPlayer && invite">
        <div class="mt-6 rounded-lg bg-slate-50 p-4">
          <p class="font-semibold text-slate-900">{{ invite.teamName }}</p>
          <p class="text-sm text-slate-500">{{ invite.competitionName }} · {{ invite.seasonLabel }}</p>
        </div>

        <div v-if="suggested" class="mt-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Parece que esta es tu ficha</p>
            <p class="font-medium text-slate-900">
              <span v-if="suggested.shirtNumber" class="mr-1 text-slate-400">{{ suggested.shirtNumber }}</span>{{ suggested.fullName }}
              <span v-if="suggested.position" class="ml-1 text-sm text-slate-500">· {{ positionLabels[suggested.position] }}</span>
            </p>
          </div>
          <button type="button" class="btn-primary" :disabled="joining !== null" @click="joinAsPlayer(suggested.id)">
            {{ joining === suggested.id ? 'Vinculando…' : 'Soy yo' }}
          </button>
        </div>

        <div class="mt-4">
          <h2 class="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {{ suggested ? 'Otras fichas sin vincular' : 'Fichas sin vincular' }}
          </h2>
          <p v-if="others.length === 0" class="text-sm text-slate-500">No quedan fichas libres en esta plantilla.</p>
          <ul v-else class="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            <li v-for="entry in others" :key="entry.id" class="flex items-center justify-between gap-3 px-4 py-2">
              <div class="text-sm">
                <span v-if="entry.shirtNumber" class="mr-1 text-slate-400">{{ entry.shirtNumber }}</span>
                <span class="font-medium text-slate-800">{{ entry.fullName }}</span>
                <span v-if="entry.position" class="ml-1 text-slate-500">· {{ positionLabels[entry.position] }}</span>
                <Badge v-if="!entry.fromRoster" class="ml-2">Añadido a mano</Badge>
              </div>
              <button type="button" class="btn-secondary px-3 py-1 text-xs" :disabled="joining !== null" @click="joinAsPlayer(entry.id)">
                {{ joining === entry.id ? 'Vinculando…' : 'Soy yo' }}
              </button>
            </li>
          </ul>
          <p class="mt-3 text-xs text-slate-500">
            ¿No apareces? Pide a tu cuerpo técnico que añada tu ficha a la plantilla y vuelve a buscar.
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
