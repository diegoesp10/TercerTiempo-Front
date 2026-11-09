<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import VideoPlayer from '@/components/videos/VideoPlayer.vue';
import VideoUploader from '@/components/videos/VideoUploader.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { MatchVideoDto } from '@/types/api';
import { formatBytes, formatKickoff, formatMinutes, videoAccessLabels, videoPartLabels } from '@/utils/format';
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
  /** El partido ya se jugó y quien mira puede llevar el acta interna: en sus vídeos se ofrece ir a analizarlos. */
  analyzable?: boolean;
}>();

// request: un vídeo privado de una plantilla abierta a solicitudes, quien lo ve pide acceso al club (lo resuelve la
// página). share: quien lo subió quiere darle un pase a alguien de fuera (la página abre la pestaña de pases).
// analyze: quien lo subió quiere analizarlo (la página abre la sección «Del vídeo» del acta interna).
const emit = defineEmits<{ request: [squadId: string]; share: [video: MatchVideoDto]; analyze: [] }>();

const { signedIn } = useViewer();

const videos = shallowRef<MatchVideoDto[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);

// silent: sondeo mientras un vídeo se comprime; no enciende la barra de carga ni pisa lo que ya se ve si falla.
async function load(silent = false) {
  if (!silent) {
    loading.value = true;
    error.value = null;
  }
  try {
    videos.value = await api.matches.videos(props.matchId, silent);
  } catch (e) {
    if (!silent) error.value = errorMessage(e);
  } finally {
    if (!silent) loading.value = false;
  }
}

watch(() => props.matchId, () => void load(), { immediate: true });
defineExpose({ load });

// Mientras algún vídeo esté en cola o comprimiéndose se vuelve a preguntar cada pocos segundos: el avance y el
// tamaño final aparecen sin recargar la página.
const POLL_MS = 10_000;
const compressing = computed(() => videos.value.some((v) => v.status === 'Uploaded' || v.status === 'Processing'));
let poll: ReturnType<typeof setInterval> | null = null;
watch(compressing, (active) => {
  if (active && !poll) poll = setInterval(() => void load(true), POLL_MS);
  else if (!active && poll) {
    clearInterval(poll);
    poll = null;
  }
}, { immediate: true });
onBeforeUnmount(() => { if (poll) clearInterval(poll); });

// --- Subida (por trozos, en VideoUploader) ---
const canUploadHere = computed(() => props.canUpload && !!props.uploadSquadId);
const mine = (video: MatchVideoDto) => canUploadHere.value && video.squadId === props.uploadSquadId;
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

function close() {
  playing.value = null;
  streamUrl.value = null;
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
    if (playing.value === video.id) close();
    await load();
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

const accessTone = (video: MatchVideoDto) =>
  video.access === 'Owner' || video.access === 'Pass' || video.access === 'Admin' ? 'green' : video.access === 'Locked' ? 'amber' : 'slate';
const accessIcon = (video: MatchVideoDto) => (video.access === 'Locked' ? 'lock' : video.access === 'Pass' ? 'ticket' : video.access === 'Owner' ? 'users' : null);
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="font-semibold text-slate-900">Vídeo del partido</h2>
        <p class="mt-1 max-w-2xl text-xs text-slate-500">
          Lo sube el club o el cuerpo técnico del equipo que grabó el partido, una vez jugado. Es privado: lo ve su
          plantilla y quien tenga un pase de este partido que le haya dado el club.
        </p>
      </div>
      <Badge v-if="videos.length > 0" tone="slate">{{ videos.length === 1 ? '1 vídeo' : `${videos.length} vídeos` }}</Badge>
    </div>

    <Alert v-if="error" kind="error" class="mt-4">{{ error }}</Alert>
    <Alert v-if="actionError" kind="error" class="mt-4">{{ actionError }}</Alert>

    <Spinner v-if="loading && videos.length === 0" class="mt-4" />

    <template v-else>
      <div v-if="videos.length === 0" class="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-line bg-surface-2 px-4 py-5 text-sm text-slate-500">
        <Icon icon="video" class="h-5 w-5 shrink-0 text-slate-400" />
        <p>
          No hay ningún vídeo de este partido que puedas ver.
          <template v-if="canUploadHere"> Súbelo desde aquí abajo, entero o en dos partes.</template>
        </p>
      </div>

      <ul v-else class="mt-4 space-y-4">
        <li v-for="video in videos" :key="video.id" class="overflow-hidden rounded-xl border border-line bg-surface-2">
          <div class="flex flex-col gap-4 p-4 lg:flex-row lg:items-start lg:justify-between">
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <Badge tone="blue">{{ videoPartLabels[video.part] }}</Badge>
                <Badge :tone="accessTone(video)">
                  <Icon v-if="accessIcon(video)" :icon="accessIcon(video)!" class="mr-1 h-3 w-3" />{{ videoAccessLabels[video.access] }}
                </Badge>
                <Badge v-if="video.status === 'Processing'" tone="blue">
                  <Icon icon="rotate-right" class="mr-1 h-3 w-3 animate-spin" />Comprimiendo · {{ video.progress }} %
                </Badge>
                <Badge v-else-if="video.status === 'Uploaded'" tone="slate">
                  <Icon icon="clock" class="mr-1 h-3 w-3" />En cola para comprimir
                </Badge>
                <Badge v-else-if="video.status === 'Failed' && mine(video)" tone="amber">
                  <Icon icon="triangle-exclamation" class="mr-1 h-3 w-3" />Sin comprimir
                </Badge>
                <Badge v-else-if="video.height" tone="slate">{{ video.height }}p</Badge>
              </div>
              <p class="mt-2 truncate font-semibold text-slate-900" :title="video.title">{{ video.title }}</p>
              <p class="mt-1 text-xs text-slate-500">
                <TeamName :name="video.teamName" :team-id="video.teamId" />
                <span class="mx-1.5 text-slate-300">·</span>subido por {{ video.uploadedBy }}
                <span class="mx-1.5 text-slate-300">·</span>{{ formatKickoff(video.uploadedAt) }}
                <span class="mx-1.5 text-slate-300">·</span>{{ formatBytes(video.sizeBytes) }}<template v-if="video.originalSizeBytes"> (antes {{ formatBytes(video.originalSizeBytes) }})</template>
                <template v-if="video.durationSeconds"><span class="mx-1.5 text-slate-300">·</span>{{ formatMinutes(video.durationSeconds) }}</template>
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
              <button v-if="video.canWatch && playing !== video.id" type="button" class="btn-primary px-3 py-1.5 text-xs" v-busy="busy === video.id" :disabled="busy === video.id" @click="play(video)">
                <Icon icon="play" class="mr-1.5 h-3 w-3" />Ver
              </button>
              <template v-else-if="video.canWatch">
                <button type="button" class="btn-secondary px-3 py-1.5 text-xs" title="Pide un enlace nuevo si el vídeo dejó de cargar" v-busy="busy === video.id" :disabled="busy === video.id" @click="play(video)">
                  <Icon icon="rotate-right" class="mr-1.5 h-3 w-3" />Recargar
                </button>
                <button type="button" class="btn-secondary px-3 py-1.5 text-xs" @click="close">
                  <Icon icon="xmark" class="mr-1.5 h-3 w-3" />Cerrar
                </button>
              </template>
              <button v-if="video.canDownload" type="button" class="btn-secondary px-3 py-1.5 text-xs" title="Descargar el archivo" :disabled="busy === video.id" @click="download(video)">
                <Icon icon="download" class="mr-1.5 h-3 w-3" />Descargar
              </button>
              <template v-if="video.access === 'Locked' && requestable?.includes(video.squadId)">
                <button v-if="signedIn" type="button" class="btn-secondary px-3 py-1.5 text-xs" @click="emit('request', video.squadId)">
                  <Icon icon="ticket" class="mr-1.5 h-3 w-3" />Solicitar acceso
                </button>
                <span v-else class="text-xs text-slate-500">
                  <RouterLink to="/login" class="text-accent-400 hover:underline">Entra</RouterLink> para pedir acceso
                </span>
              </template>
              <span v-if="video.canDelete" class="lg:ml-1 lg:border-l lg:border-line lg:pl-3">
                <button type="button" class="btn-ghost px-3 py-1.5 text-xs text-red-600 hover:bg-red-50" v-busy="busy === video.id" :disabled="busy === video.id" @click="remove(video)">
                  <Icon icon="trash" class="mr-1.5 h-3 w-3" />Eliminar
                </button>
              </span>
            </div>
          </div>

          <div v-if="mine(video)" class="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 text-xs text-slate-600">
            <div class="min-w-0 space-y-1">
              <p v-if="video.status === 'Uploaded' || video.status === 'Processing'">
                <Icon icon="circle-info" class="mr-1.5 h-3 w-3 text-accent-400" />Se comprime en el servidor sin bajar de 1080p para que ocupe la mitad o menos; mientras tanto se ve y se descarga tal cual se subió.
              </p>
              <p v-else-if="video.status === 'Failed'">
                <Icon icon="triangle-exclamation" class="mr-1.5 h-3 w-3 text-amber-500" />No se pudo comprimir<template v-if="video.processingError">: {{ video.processingError }}</template>. Se sirve tal cual se subió.
              </p>
              <p><Icon icon="lock" class="mr-1.5 h-3 w-3 text-slate-400" />Solo lo ve tu plantilla. Para que alguien de fuera lo vea o lo descargue, dale un pase de este partido.</p>
              <p v-if="analyzable">
                <Icon icon="magnifying-glass" class="mr-1.5 h-3 w-3 text-accent-400" />El analizador saca del vídeo una propuesta para el acta interna (tiros, posesión, quién jugó); tarda más o menos lo que dura el vídeo.
              </p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <button v-if="analyzable" type="button" class="btn-secondary px-3 py-1.5 text-xs" :disabled="video.status === 'Uploaded' || video.status === 'Processing'" :title="video.status === 'Uploaded' || video.status === 'Processing' ? 'Cuando termine de comprimirse' : 'Ir a la sección «Del vídeo» del acta interna'" @click="emit('analyze')">
                <Icon icon="magnifying-glass" class="mr-1.5 h-3 w-3" />Analizar el vídeo
              </button>
              <button type="button" class="btn-secondary px-3 py-1.5 text-xs" @click="emit('share', video)">
                <Icon icon="ticket" class="mr-1.5 h-3 w-3" />Generar un pase
              </button>
            </div>
          </div>

          <div v-if="playing === video.id && streamUrl" class="border-t border-line p-3">
            <VideoPlayer :key="streamUrl" :src="streamUrl" :type="video.contentType" :title="video.title" />
          </div>
        </li>
      </ul>

      <VideoUploader v-if="canUploadHere && uploadSquadId" class="mt-5" :squad-id="uploadSquadId" :match-id="matchId" :existing="myVideos" @uploaded="load()" @share="emit('share', $event)" />
    </template>
  </section>
</template>
