<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import type { MatchSheetAccessDto } from '@/types/api';
import { passPrice } from '@/utils/format';

const props = defineProps<{
  open: boolean;
  squadId: string;
  matchId: string;
  teamName: string;
  access: MatchSheetAccessDto;
  /** Se abrió desde el vídeo: lo marca de entrada. */
  preferVideo?: boolean;
}>();
const emit = defineEmits<{ close: []; requested: [] }>();

const wantsSheet = ref(true);
const wantsVideo = ref(false);
const message = ref('');
const busy = ref(false);
const error = ref<string | null>(null);

watch(
  () => props.open,
  (open) => {
    if (!open) return;
    wantsSheet.value = !props.preferVideo;
    wantsVideo.value = props.access.hasVideo && (props.preferVideo ?? false);
    message.value = '';
    error.value = null;
  },
  { immediate: true },
);

// Lo que costaría con los precios que tiene puestos el club para este partido; al aprobarla puede ajustarlo.
const total = computed(() => (wantsSheet.value ? props.access.sheetPriceCents : 0) + (wantsVideo.value ? props.access.videoPriceCents : 0));

async function submit() {
  if (!wantsSheet.value && !wantsVideo.value) return;
  busy.value = true;
  error.value = null;
  try {
    await api.passes.request({
      squadId: props.squadId,
      matchId: props.matchId,
      wantsSheet: wantsSheet.value,
      wantsVideo: wantsVideo.value,
      message: message.value.trim() || null,
    });
    emit('requested');
    emit('close');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="`Solicitar acceso · ${teamName}`" size="md" @close="emit('close')">
    <p class="text-sm text-slate-600">
      Lo interno de este partido es privado. La solicitud le llega al club de <strong>{{ teamName }}</strong>; si la aprueba,
      te dará un código de un solo uso para verlo aquí, en Tercer Tiempo, con tu cuenta.
    </p>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>

    <form class="mt-4 space-y-3" @submit.prevent="submit">
      <fieldset class="space-y-2">
        <legend class="label">Qué quieres ver</legend>
        <label class="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm text-slate-800">
          <span class="flex items-center gap-2"><input v-model="wantsSheet" type="checkbox" class="h-4 w-4 accent-brand-500" />Acta interna (jugador a jugador)</span>
          <span class="tabular-nums text-slate-500">{{ passPrice(access.sheetPriceCents, access.currency) }}</span>
        </label>
        <label
          class="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2 text-sm"
          :class="access.hasVideo ? 'text-slate-800' : 'text-slate-400'"
          :title="access.hasVideo ? undefined : 'El club todavía no ha subido el vídeo de este partido'"
        >
          <span class="flex items-center gap-2"><input v-model="wantsVideo" type="checkbox" class="h-4 w-4 accent-brand-500" :disabled="!access.hasVideo" />Vídeo del partido</span>
          <span class="tabular-nums text-slate-500">{{ access.hasVideo ? passPrice(access.videoPriceCents, access.currency) : 'sin vídeo' }}</span>
        </label>
      </fieldset>

      <div>
        <label class="label" for="request-message">Mensaje para el club (opcional)</label>
        <textarea id="request-message" v-model="message" class="input min-h-20" maxlength="300" placeholder="Quién eres y para qué lo quieres" />
      </div>

      <p class="text-sm text-slate-600">
        Precio orientativo: <strong class="text-slate-900">{{ passPrice(total, access.currency) }}</strong>. El club puede ajustarlo al aprobarla; lo pagas al canjear el código.
      </p>

      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="emit('close')">Cancelar</button>
        <button type="submit" class="btn-primary" v-busy="busy" :disabled="busy || (!wantsSheet && !wantsVideo)">
          <Icon icon="ticket" class="mr-1.5 h-3.5 w-3.5" />Enviar solicitud
        </button>
      </div>
    </form>
  </Modal>
</template>
