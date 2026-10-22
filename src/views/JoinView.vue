<script setup lang="ts">
import { onMounted, ref, shallowRef, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAuthStore } from '@/stores/auth';
import type { SquadInviteDto } from '@/types/api';
import { positionLabels } from '@/utils/format';

const props = defineProps<{ code?: string }>();
const auth = useAuthStore();
const router = useRouter();
const code = ref((props.code ?? '').toUpperCase());
const checkedCode = ref('');
const loading = ref(false);
const joining = ref(false);
const error = ref<string | null>(null);
const invite = shallowRef<SquadInviteDto | null>(null);

watch(code, () => {
  invite.value = null;
  checkedCode.value = '';
  error.value = null;
}, { flush: 'sync' });

async function lookup() {
  if (loading.value || joining.value) return;
  const submittedCode = code.value;
  loading.value = true;
  error.value = null;
  invite.value = null;
  try {
    const result = await api.players.invite(submittedCode);
    if (code.value === submittedCode) {
      invite.value = result;
      checkedCode.value = submittedCode;
    }
  } catch (e) {
    if (code.value === submittedCode) error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

async function joinAsPlayer() {
  if (!invite.value || !checkedCode.value || joining.value) return;
  joining.value = true;
  error.value = null;
  try {
    auth.setPlayer(await api.players.joinSquad({ inviteCode: checkedCode.value }));
    await auth.refreshAccount();
    await router.push({ name: 'home' });
  } catch (e) {
    error.value = errorMessage(e);
    invite.value = null;
    checkedCode.value = '';
  } finally {
    joining.value = false;
  }
}

onMounted(() => {
  if (auth.isPlayer && code.value && !auth.playerSquad) void lookup();
});
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PageHeader title="Vincula tu ficha de jugador" subtitle="Tu club o entrenador genera un código personal para tu ficha y te lo entrega. Con él, tu cuenta pasa a ser esa ficha." />

    <Alert v-if="auth.isCoach" kind="info">
      Los códigos personales de jugador son para los jugadores. Tu club te entrega un
      <RouterLink to="/codigo-acceso" class="font-medium underline">código de acceso para el cuerpo técnico</RouterLink>.
    </Alert>
    <Alert v-else-if="auth.isPlayer && auth.playerSquad" kind="info" class="mb-4">
      Ya estás vinculado a <strong>{{ auth.playerSquad.teamName }}</strong>. Para cambiar de plantilla, desvincúlate primero desde
      <RouterLink to="/" class="font-medium underline">tu panel</RouterLink> y pide un código personal nuevo.
    </Alert>

    <div v-else-if="auth.isPlayer" class="card">
      <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>
      <form class="flex flex-wrap items-end gap-3" @submit.prevent="lookup">
        <div class="min-w-48 flex-1">
          <label class="label" for="code">Tu código personal de invitación</label>
          <input id="code" v-model="code" type="text" required maxlength="20" autocomplete="off"
            spellcheck="false" placeholder="ABCD2345EFGH" class="input font-mono uppercase tracking-widest"
            :disabled="joining" @input="code = code.toUpperCase()" />
        </div>
        <button type="submit" class="btn-primary" v-busy="loading" :disabled="loading || joining || code.trim().length < 4">
          {{ loading ? 'Comprobando…' : 'Comprobar mi código' }}
        </button>
      </form>
      <p class="mt-3 text-xs text-slate-500">El código solo sirve para una ficha y se usa una vez. Tu cuenta pasará a llamarse como la ficha.</p>

      <template v-if="invite">
        <div class="mt-6 rounded-lg bg-slate-50 p-4">
          <p class="font-semibold text-slate-900">{{ invite.teamName }}</p>
          <p class="text-sm text-slate-500">{{ invite.competitionName }} · {{ invite.seasonLabel }}</p>
        </div>
        <div class="mt-4 rounded-xl border border-accent-400/40 bg-brand-500/10 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Tu ficha de jugador</p>
          <p class="mt-1 text-lg font-semibold text-slate-900">{{ invite.player.fullName }}</p>
          <p class="mt-1 text-sm text-slate-500">
            <span v-if="invite.player.shirtNumber">Dorsal {{ invite.player.shirtNumber }}</span>
            <span v-if="invite.player.shirtNumber && invite.player.position"> · </span>
            <span v-if="invite.player.position">{{ positionLabels[invite.player.position] }}</span>
          </p>
          <button type="button" class="btn-primary mt-4" v-busy="joining" :disabled="joining" @click="joinAsPlayer">
            {{ joining ? 'Vinculando…' : 'Vincular mi ficha' }}
          </button>
        </div>
      </template>
    </div>
    <Alert v-else kind="info">Las invitaciones a una plantilla son para cuentas de jugador.</Alert>
  </div>
</template>
