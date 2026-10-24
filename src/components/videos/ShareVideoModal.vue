<script setup lang="ts">
import { ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { MatchVideoDto, VideoShareLinkDto } from '@/types/api';
import { formatKickoff } from '@/utils/format';

// Enlaces públicos con caducidad para ver un vídeo sin cuenta: quien lo generó elige cuánto duran y puede revocarlos.
const props = defineProps<{ video: MatchVideoDto | null }>();
const emit = defineEmits<{ close: [] }>();

const links = shallowRef<VideoShareLinkDto[]>([]);
const loading = ref(false);
const busy = ref(false);
const error = ref<string | null>(null);
const created = ref<VideoShareLinkDto | null>(null);
const copied = ref<string | null>(null);

const durations = [
  { value: 6, label: '6 horas' },
  { value: 24, label: '1 día' },
  { value: 72, label: '3 días' },
  { value: 168, label: '1 semana' },
  { value: 720, label: '30 días' },
];
const hours = ref<number>(24);

watch(
  () => props.video,
  async (video) => {
    links.value = [];
    created.value = null;
    error.value = null;
    if (!video) return;
    loading.value = true;
    try {
      links.value = await api.videos.shares(video.id);
    } catch (e) {
      error.value = errorMessage(e);
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

const url = (link: VideoShareLinkDto) => `${window.location.origin}/ver/${link.token}`;

async function create() {
  if (!props.video) return;
  busy.value = true;
  error.value = null;
  try {
    created.value = await api.videos.createShare(props.video.id, hours.value);
    links.value = [created.value, ...links.value];
    await copy(created.value);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function copy(link: VideoShareLinkDto) {
  try {
    await navigator.clipboard.writeText(url(link));
    copied.value = link.id;
    setTimeout(() => { if (copied.value === link.id) copied.value = null; }, 2500);
  } catch { /* sin portapapeles: la URL queda visible para copiarla a mano */ }
}

async function revoke(link: VideoShareLinkDto) {
  if (!props.video) return;
  if (!(await confirmDialog({ title: 'Revocar el enlace', message: 'Quien lo tenga dejará de poder ver el vídeo con él.', confirmLabel: 'Revocar', danger: true }))) return;
  busy.value = true;
  error.value = null;
  try {
    links.value = await api.videos.revokeShare(props.video.id, link.id);
    if (created.value?.id === link.id) created.value = null;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="video !== null" title="Compartir el vídeo" size="lg" @close="emit('close')">
    <p class="text-sm text-slate-600">
      Genera un enlace para que alguien sin cuenta vea <strong>{{ video?.title }}</strong> en el visor de Tercer Tiempo. Caduca solo y lo puedes revocar cuando quieras.
    </p>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>

    <form class="mt-4 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface-2 p-3" @submit.prevent="create">
      <div class="w-44">
        <label class="label" for="share-hours">Validez</label>
        <SearchSelect id="share-hours" :model-value="hours" :options="durations" @update:model-value="hours = Number($event ?? 24)" />
      </div>
      <button type="submit" class="btn-primary" v-busy="busy"><Icon icon="link" class="mr-1.5 h-3.5 w-3.5" />Generar enlace</button>
    </form>

    <div v-if="created" class="mt-4 rounded-lg border border-emerald-300/40 bg-emerald-100 p-3 text-sm text-emerald-800">
      <p class="font-semibold">Enlace listo{{ copied === created.id ? ' y copiado al portapapeles' : '' }}</p>
      <div class="mt-2 flex flex-wrap items-center gap-2">
        <code class="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 text-xs text-slate-800">{{ url(created) }}</code>
        <button type="button" class="btn-secondary px-3 py-1 text-xs" @click="copy(created)">{{ copied === created.id ? 'Copiado ✓' : 'Copiar' }}</button>
      </div>
      <p class="mt-1 text-xs">Válido hasta el {{ formatKickoff(created.expiresAt) }}.</p>
    </div>

    <h3 class="mt-5 text-sm font-semibold text-slate-900">Enlaces generados</h3>
    <Spinner v-if="loading" />
    <p v-else-if="links.length === 0" class="mt-1 text-sm text-slate-500">Todavía no has generado ninguno.</p>
    <ul v-else class="mt-2 divide-y divide-slate-100 text-sm">
      <li v-for="link in links" :key="link.id" class="flex flex-wrap items-center justify-between gap-2 py-2">
        <div class="min-w-0">
          <code class="block truncate text-xs text-slate-700">{{ url(link) }}</code>
          <p class="text-xs text-slate-500">Creado el {{ formatKickoff(link.createdAt) }} · {{ link.active ? `caduca el ${formatKickoff(link.expiresAt)}` : 'caducado o revocado' }}</p>
        </div>
        <div class="flex items-center gap-2">
          <Badge :tone="link.active ? 'green' : 'slate'">{{ link.active ? 'Vigente' : 'Inactivo' }}</Badge>
          <button v-if="link.active" type="button" class="btn-ghost px-2 py-1 text-xs" @click="copy(link)">{{ copied === link.id ? 'Copiado ✓' : 'Copiar' }}</button>
          <button v-if="link.active" type="button" class="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50" v-busy="busy" :disabled="busy" @click="revoke(link)">Revocar</button>
        </div>
      </li>
    </ul>
  </Modal>
</template>
