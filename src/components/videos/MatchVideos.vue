<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAuthStore } from '@/stores/auth';
import type { MatchVideoDto } from '@/types/api';
import { formatBytes, formatKickoff, formatMoney, videoAccessLabels } from '@/utils/format';

const props = defineProps<{
  matchId: string;
  /** Plantilla desde la que se puede subir (solo si el usuario es de su cuerpo técnico). */
  uploadSquadId?: string | null;
  canUpload?: boolean;
}>();

const auth = useAuthStore();

const videos = shallowRef<MatchVideoDto[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    videos.value = await api.matches.videos(props.matchId);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(() => props.matchId, () => void load(), { immediate: true });

// --- Subida ---
const file = ref<File | null>(null);
const title = ref('');
const uploading = ref(false);
const uploadError = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  file.value = input.files?.[0] ?? null;
}

async function upload() {
  if (!file.value || !props.uploadSquadId) return;
  uploading.value = true;
  uploadError.value = null;
  fieldErrors.value = {};
  try {
    await api.squads.uploadVideo(props.uploadSquadId, props.matchId, file.value, title.value.trim() || null);
    file.value = null;
    title.value = '';
    await load();
  } catch (e) {
    uploadError.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    uploading.value = false;
  }
}

// --- Reproducción y compra ---
const playing = ref<string | null>(null);
const streamUrl = ref<string | null>(null);
const busy = ref<string | null>(null);
const actionError = ref<string | null>(null);

async function play(video: MatchVideoDto) {
  busy.value = video.id;
  actionError.value = null;
  try {
    const ticket = await api.videos.ticket(video.id);
    streamUrl.value = api.videos.streamUrl(ticket);
    playing.value = video.id;
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

async function purchase(video: MatchVideoDto) {
  if (!confirm(`¿Comprar el acceso a «${video.title}» por ${formatMoney(video.priceCents, video.currency)}?`)) return;
  busy.value = video.id;
  actionError.value = null;
  try {
    await api.videos.purchase(video.id);
    await load();
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

async function remove(video: MatchVideoDto) {
  if (!confirm(`¿Eliminar «${video.title}»? Quien lo haya comprado dejará de poder verlo.`)) return;
  busy.value = video.id;
  actionError.value = null;
  try {
    await api.videos.remove(video.id);
    if (playing.value === video.id) playing.value = null;
    await load();
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

const accessTone = (video: MatchVideoDto) =>
  video.access === 'Owner' || video.access === 'Purchased' || video.access === 'Free' ? 'green' : video.access === 'Locked' ? 'amber' : 'slate';

const canUploadHere = computed(() => props.canUpload && !!props.uploadSquadId);
</script>

<template>
  <section class="card">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900">Vídeo del partido</h2>
        <p class="text-xs text-slate-500">
          Lo sube el cuerpo técnico del equipo que grabó el partido. Su plantilla lo ve gratis; los técnicos de otras plantillas
          pueden comprar el acceso.
        </p>
      </div>
    </div>

    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>
    <Alert v-if="actionError" kind="error" class="mb-3">{{ actionError }}</Alert>

    <Spinner v-if="loading && videos.length === 0" />

    <template v-else>
      <p v-if="videos.length === 0" class="text-sm text-slate-500">Todavía nadie ha subido el vídeo de este partido.</p>

      <ul v-else class="divide-y divide-slate-100">
        <li v-for="video in videos" :key="video.id" class="py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium text-slate-900">{{ video.title }}</p>
              <p class="text-xs text-slate-500">
                {{ video.teamName }} · subido por {{ video.uploadedBy }} el {{ formatKickoff(video.uploadedAt) }} · {{ formatBytes(video.sizeBytes) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Badge :tone="accessTone(video)">{{ videoAccessLabels[video.access] }}<template v-if="video.access === 'Locked'"> · {{ formatMoney(video.priceCents, video.currency) }}</template></Badge>
              <button v-if="video.canWatch" type="button" class="btn-primary px-3 py-1 text-xs" :disabled="busy === video.id" @click="play(video)">
                {{ playing === video.id ? 'Recargar' : 'Ver' }}
              </button>
              <button v-else-if="video.access === 'Locked'" type="button" class="btn-secondary px-3 py-1 text-xs" :disabled="busy === video.id" @click="purchase(video)">
                {{ busy === video.id ? 'Comprando…' : `Comprar por ${formatMoney(video.priceCents, video.currency)}` }}
              </button>
              <span v-else-if="!auth.isAuthenticated" class="text-xs text-slate-500">
                <RouterLink to="/login" class="text-accent-400 hover:underline">Entra</RouterLink> para verlo
              </span>
              <button v-if="video.canDelete" type="button" class="btn-ghost px-3 py-1 text-xs text-red-600 hover:bg-red-50" :disabled="busy === video.id" @click="remove(video)">Eliminar</button>
            </div>
          </div>

          <video v-if="playing === video.id && streamUrl" :key="streamUrl" :src="streamUrl" controls preload="metadata" class="mt-3 w-full rounded-lg bg-black" style="max-height: 60vh">
            Tu navegador no reproduce este formato.
          </video>
        </li>
      </ul>

      <form v-if="canUploadHere" class="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4" @submit.prevent="upload">
        <div class="min-w-56 flex-1">
          <label class="label" for="video-file">Archivo de vídeo</label>
          <input id="video-file" type="file" accept="video/mp4,video/webm,video/quicktime,video/x-matroska,.mp4,.webm,.mov,.mkv" class="input px-2 py-1.5" @change="onFileChange" />
          <p v-if="fieldErrors['file.contentType'] || fieldErrors['file.length']" class="field-error">{{ (fieldErrors['file.contentType'] ?? fieldErrors['file.length'])?.[0] }}</p>
        </div>
        <div class="min-w-48 flex-1">
          <label class="label" for="video-title">Título (opcional)</label>
          <input id="video-title" v-model="title" type="text" maxlength="150" class="input" placeholder="Partido completo, primera parte…" />
        </div>
        <button type="submit" class="btn-primary" :disabled="uploading || !file">{{ uploading ? 'Subiendo…' : 'Subir vídeo' }}</button>
        <Alert v-if="uploadError" kind="error" class="w-full">{{ uploadError }}</Alert>
        <p v-if="uploading" class="w-full text-xs text-slate-500">La subida puede tardar varios minutos según el tamaño del archivo; no cierres la página.</p>
      </form>
    </template>
  </section>
</template>
