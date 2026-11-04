<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import VideoPlayer from '@/components/videos/VideoPlayer.vue';
import VideoUploader from '@/components/videos/VideoUploader.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { MatchVideoDto } from '@/types/api';
import { formatBytes, formatKickoff, videoAccessLabels, videoPartLabels } from '@/utils/format';
import { confirmDialog } from '@/composables/useConfirm';
import TeamName from '@/components/teams/TeamName.vue';
import { useViewer } from '@/composables/useViewer';

const props = defineProps<{
  matchId: string;
  /** Plantilla desde la que se puede subir (solo si el usuario es de su cuerpo técnico o su club). */
  uploadSquadId?: string | null;
  canUpload?: boolean;
  /** Plantillas abiertas a solicitudes para este partido: solo en sus vídeos privados se ofrece pedir acceso. */
  requestable?: string[];
}>();

// Un vídeo privado de una plantilla abierta a solicitudes: quien lo ve puede pedir acceso al club (lo resuelve la página).
const emit = defineEmits<{ request: [squadId: string] }>();

const { signedIn } = useViewer();

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
defineExpose({ load });

// --- Subida (por trozos, en VideoUploader) ---
const myVideos = computed(() => videos.value.filter((v) => v.squadId === props.uploadSquadId));

// --- Reproducción y descarga ---
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

// La descarga va con su propio ticket (el de reproducción no sirve); el navegador guarda el archivo y puede reanudarlo.
async function download(video: MatchVideoDto) {
  busy.value = video.id;
  actionError.value = null;
  try {
    const ticket = await api.videos.downloadTicket(video.id);
    const link = document.createElement('a');
    link.href = api.videos.downloadUrl(ticket);
    link.download = video.fileName;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

async function remove(video: MatchVideoDto) {
  if (!(await confirmDialog({ title: `Eliminar «${video.title}»`, message: 'Nadie podrá verlo ni descargarlo, tampoco quien tenga un pase de este partido.', confirmLabel: 'Eliminar', danger: true }))) return;
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
  video.access === 'Owner' || video.access === 'Pass' || video.access === 'Admin' ? 'green' : video.access === 'Locked' ? 'amber' : 'slate';

const canUploadHere = computed(() => props.canUpload && !!props.uploadSquadId);
</script>

<template>
  <section class="card">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900">Vídeo del partido</h2>
        <p class="text-xs text-slate-500">
          Lo sube el club o el cuerpo técnico del equipo que grabó el partido, desde su acta interna y una vez jugado. Es
          privado: lo ve su plantilla y quien tenga un pase de este partido que le haya dado el club.
        </p>
      </div>
    </div>

    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>
    <Alert v-if="actionError" kind="error" class="mb-3">{{ actionError }}</Alert>

    <Spinner v-if="loading && videos.length === 0" />

    <template v-else>
      <p v-if="videos.length === 0" class="text-sm text-slate-500">No hay ningún vídeo de este partido que puedas ver.</p>

      <ul v-else class="divide-y divide-slate-100">
        <li v-for="video in videos" :key="video.id" class="py-3">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="font-medium text-slate-900">
                <Badge tone="slate" class="mr-2">{{ videoPartLabels[video.part] }}</Badge>{{ video.title }}
              </p>
              <p class="text-xs text-slate-500">
                <TeamName :name="video.teamName" :team-id="video.teamId" /> · subido por {{ video.uploadedBy }} el {{ formatKickoff(video.uploadedAt) }} · {{ formatBytes(video.sizeBytes) }}
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <Badge :tone="accessTone(video)">
                <Icon v-if="video.access === 'Locked'" icon="lock" class="mr-1 h-3 w-3" />
                <Icon v-else-if="video.access === 'Pass'" icon="ticket" class="mr-1 h-3 w-3" />{{ videoAccessLabels[video.access] }}
              </Badge>
              <button v-if="video.canWatch" type="button" class="btn-primary px-3 py-1 text-xs" v-busy="busy === video.id" :disabled="busy === video.id" @click="play(video)">
                <Icon icon="play" class="mr-1.5 h-3 w-3" />{{ playing === video.id ? 'Recargar' : 'Ver' }}
              </button>
              <button v-if="video.canDownload" type="button" class="btn-secondary px-3 py-1 text-xs" title="Descargar el archivo original" :disabled="busy === video.id" @click="download(video)">
                <Icon icon="download" class="mr-1.5 h-3 w-3" />Descargar
              </button>
              <template v-if="video.access === 'Locked' && requestable?.includes(video.squadId)">
                <button v-if="signedIn" type="button" class="btn-secondary px-3 py-1 text-xs" @click="emit('request', video.squadId)">
                  <Icon icon="ticket" class="mr-1.5 h-3 w-3" />Solicitar acceso
                </button>
                <span v-else class="text-xs text-slate-500">
                  <RouterLink to="/login" class="text-accent-400 hover:underline">Entra</RouterLink> para pedir acceso
                </span>
              </template>
              <button v-if="video.canDelete" type="button" class="btn-ghost px-3 py-1 text-xs text-red-600 hover:bg-red-50" v-busy="busy === video.id" :disabled="busy === video.id" @click="remove(video)">Eliminar</button>
            </div>
          </div>

          <VideoPlayer v-if="playing === video.id && streamUrl" :key="streamUrl" class="mt-3" :src="streamUrl" :type="video.contentType" :title="video.title" />
        </li>
      </ul>

      <p v-if="canUploadHere && myVideos.length > 0" class="mt-3 text-xs text-slate-500">
        <Icon icon="ticket" class="mr-1 h-3 w-3 text-accent-400" />Para que alguien de fuera lo vea o lo descargue, genera un pase en la pestaña <strong>Pases</strong>.
      </p>

      <VideoUploader v-if="canUploadHere && uploadSquadId" class="mt-4" :squad-id="uploadSquadId" :match-id="matchId" :existing="myVideos" @uploaded="load" />
    </template>
  </section>
</template>
