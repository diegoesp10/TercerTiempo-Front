<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { PassPreviewDto } from '@/types/api';
import { formatKickoff, passContents, passPrice, passStatusLabels } from '@/utils/format';

const props = defineProps<{ code?: string }>();
const router = useRouter();

const typed = ref('');
const preview = ref<PassPreviewDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const busy = ref(false);

watch(
  () => props.code,
  async (code) => {
    preview.value = null;
    error.value = null;
    if (!code) return;
    typed.value = code.toUpperCase();
    loading.value = true;
    try {
      preview.value = await api.passes.preview(code);
    } catch (e) {
      error.value = errorMessage(e);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function lookUp() {
  const code = typed.value.trim().toUpperCase();
  if (code) void router.push({ name: 'pass', params: { code } });
}

const fixture = computed(() => (preview.value ? `${preview.value.match.homeTeam.name} - ${preview.value.match.awayTeam.name}` : ''));

async function redeem() {
  const pass = preview.value;
  if (!pass) return;
  if (pass.priceCents > 0 && !(await confirmDialog({
    title: 'Canjear el pase',
    message: `Se te cobrará ${passPrice(pass.priceCents, pass.currency)} por ${passContents(pass.includesSheet, pass.includesVideo, pass.allowsDownload).toLowerCase()} del ${fixture.value}. El acceso queda en tu cuenta para siempre.`,
    confirmLabel: `Pagar ${passPrice(pass.priceCents, pass.currency)}`,
  }))) return;
  busy.value = true;
  error.value = null;
  try {
    const mine = await api.passes.redeem(pass.code);
    await router.push({ name: 'match', params: { matchId: mine.match.id }, query: { vista: 'visitante' } });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-xl">
    <PageHeader title="Canjear un pase" subtitle="El código que te da un club para ver el acta interna o el vídeo de uno de sus partidos." />

    <form v-if="!code || error" class="card mb-4 flex flex-wrap items-end gap-3" @submit.prevent="lookUp">
      <div class="min-w-48 flex-1">
        <label class="label" for="pass-code">Código del pase</label>
        <input
          id="pass-code"
          v-model="typed"
          type="text"
          required
          maxlength="16"
          autocomplete="off"
          spellcheck="false"
          placeholder="ABCD2345EFGH"
          class="input font-mono uppercase tracking-widest"
          @input="typed = typed.toUpperCase()"
        />
      </div>
      <button type="submit" class="btn-primary" :disabled="typed.trim().length < 6">Buscar</button>
    </form>

    <Alert v-if="error" kind="error" class="mb-4">{{ error }}</Alert>
    <Spinner v-if="loading" />

    <div v-else-if="preview" class="card">
      <div class="flex items-center gap-3">
        <TeamCrest :src="preview.match.homeTeam.crestUrl" :name="preview.match.homeTeam.name" :short-name="preview.match.homeTeam.shortName" size="md" />
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-slate-900">{{ fixture }}</p>
          <p class="text-xs text-slate-500">
            {{ formatKickoff(preview.match.kickoffAt) }}<template v-if="preview.match.status === 'Played'"> · {{ preview.match.homeGoals }} - {{ preview.match.awayGoals }}</template>
          </p>
        </div>
        <TeamCrest :src="preview.match.awayTeam.crestUrl" :name="preview.match.awayTeam.name" :short-name="preview.match.awayTeam.shortName" size="md" />
      </div>

      <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt class="text-slate-500">Lo da</dt>
        <dd class="text-slate-900">{{ preview.clubName }} ({{ preview.teamName }})</dd>
        <dt class="text-slate-500">Incluye</dt>
        <dd class="text-slate-900">{{ passContents(preview.includesSheet, preview.includesVideo, preview.allowsDownload) }}</dd>
        <dt class="text-slate-500">Precio</dt>
        <dd class="font-semibold text-slate-900">{{ passPrice(preview.priceCents, preview.currency) }}</dd>
        <dt class="text-slate-500">Estado</dt>
        <dd><Badge :tone="preview.status === 'Pending' ? 'blue' : preview.mine ? 'green' : 'slate'">{{ preview.mine ? 'Es tuyo' : passStatusLabels[preview.status] }}</Badge></dd>
      </dl>

      <div class="mt-5">
        <RouterLink v-if="preview.mine" :to="{ name: 'match', params: { matchId: preview.match.id }, query: { vista: 'visitante' } }" class="btn-primary">Ir al partido</RouterLink>
        <Alert v-else-if="preview.forSomeoneElse" kind="warning">Este pase es para la persona que lo solicitó: solo puede canjearlo su cuenta.</Alert>
        <Alert v-else-if="preview.status === 'Redeemed'" kind="warning">Este pase ya lo ha canjeado otra cuenta. Cada código vale una sola vez.</Alert>
        <Alert v-else-if="preview.status === 'Revoked'" kind="warning">El club ha revocado este pase.</Alert>
        <Alert v-else-if="preview.status === 'Expired'" kind="warning">Este pase caducó sin canjearse. Pídele al club uno nuevo.</Alert>
        <template v-else>
          <button type="button" class="btn-primary" v-busy="busy" :disabled="busy" @click="redeem">
            <Icon icon="ticket" class="mr-1.5 h-3.5 w-3.5" />{{ preview.priceCents > 0 ? `Pagar ${passPrice(preview.priceCents, preview.currency)} y canjear` : 'Canjear gratis' }}
          </button>
          <p class="mt-2 text-xs text-slate-500">
            Se canjea una sola vez y queda ligado a tu cuenta: lo verás en la página del partido. Canjeable hasta el {{ formatKickoff(preview.expiresAt) }}.
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
