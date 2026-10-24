<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import ShareVideoModal from '@/components/videos/ShareVideoModal.vue';
import VideoPlayer from '@/components/videos/VideoPlayer.vue';
import VideoUploader from '@/components/videos/VideoUploader.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAuthStore } from '@/stores/auth';
import type { MatchVideoDto } from '@/types/api';
import { formatBytes, formatKickoff, formatMoney, videoAccessLabels, videoPartLabels } from '@/utils/format';
import { confirmDialog } from '@/composables/useConfirm';
import TeamName from '@/components/teams/TeamName.vue';

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

// --- Subida (por trozos, en VideoUploader) ---
const myVideos = computed(() => videos.value.filter((v) => v.squadId === props.uploadSquadId));

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
  const parts = videos.value.filter((v) => v.squadId === video.squadId).length;
  if (!(await confirmDialog({
    title: `Comprar el vídeo de ${video.teamName}`,
    message: `El acceso cuesta ${formatMoney(video.priceCents, video.currency)}${parts > 1 ? ' e incluye todas las partes del partido' : ''}.`,
    confirmLabel: 'Comprar',
  }))) return;
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
  if (!(await confirmDialog({ title: `Eliminar «${video.title}»`, message: 'Quien lo haya comprado dejará de poder verlo.', confirmLabel: 'Eliminar', danger: true }))) return;
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

// Público/privado y enlaces compartidos: club propietario y cuerpo técnico vigente.
const sharing = ref<MatchVideoDto | null>(null);

async function toggleVisibility(video: MatchVideoDto) {
  busy.value = video.id;
  actionError.value = null;
  try {
    await api.videos.setVisibility(video.id, video.visibility === 'Public' ? 'Private' : 'Public');
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
              <p class="font-medium text-slate-900">
                <Badge tone="slate" class="mr-2">{{ videoPartLabels[video.part] }}</Badge>{{ video.title }}
                <Badge v-if="video.visibility === 'Public'" tone="green" class="ml-2" title="Cualquiera que llegue al partido puede verlo"><Icon icon="globe" class="mr-1 h-3 w-3" />Público</Badge>
              </p>
              <p class="text-xs text-slate-500">
                <TeamName :name="video.teamName" :team-id="video.teamId" /> · subido por {{ video.uploadedBy }} el {{ formatKickoff(video.uploadedAt) }} · {{ formatBytes(video.sizeBytes) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Badge :tone="accessTone(video)">{{ videoAccessLabels[video.access] }}<template v-if="video.access === 'Locked'"> · {{ formatMoney(video.priceCents, video.currency) }}</template></Badge>
              <button v-if="video.canWatch" type="button" class="btn-primary px-3 py-1 text-xs" v-busy="busy === video.id" :disabled="busy === video.id" @click="play(video)">
                {{ playing === video.id ? 'Recargar' : 'Ver' }}
              </button>
              <button v-else-if="video.access === 'Locked'" type="button" class="btn-secondary px-3 py-1 text-xs" v-busy="busy === video.id" :disabled="busy === video.id" @click="purchase(video)">
                {{ busy === video.id ? 'Comprando…' : `Comprar por ${formatMoney(video.priceCents, video.currency)}` }}
              </button>
              <span v-else-if="!auth.isAuthenticated" class="text-xs text-slate-500">
                <RouterLink to="/login" class="text-accent-400 hover:underline">Entra</RouterLink> para verlo
              </span>
              <template v-if="video.canDelete">
                <button type="button" class="btn-ghost px-3 py-1 text-xs" :title="video.visibility === 'Public' ? 'Volver a dejarlo solo para la plantilla, el club y quien lo compre' : 'Que cualquiera que llegue al partido lo vea sin pagar'" v-busy="busy === video.id" :disabled="busy === video.id" @click="toggleVisibility(video)">
                  <Icon :icon="video.visibility === 'Public' ? 'lock' : 'globe'" class="mr-1.5 h-3.5 w-3.5" />{{ video.visibility === 'Public' ? 'Hacer privado' : 'Hacer público' }}
                </button>
                <button type="button" class="btn-ghost px-3 py-1 text-xs" :disabled="busy === video.id" @click="sharing = video"><Icon icon="link" class="mr-1.5 h-3.5 w-3.5" />Compartir</button>
                <button type="button" class="btn-ghost px-3 py-1 text-xs text-red-600 hover:bg-red-50" v-busy="busy === video.id" :disabled="busy === video.id" @click="remove(video)">Eliminar</button>
              </template>
            </div>
          </div>

          <VideoPlayer v-if="playing === video.id && streamUrl" :key="streamUrl" class="mt-3" :src="streamUrl" :type="video.contentType" :title="video.title" />
        </li>
      </ul>

      <VideoUploader v-if="canUploadHere && uploadSquadId" class="mt-4" :squad-id="uploadSquadId" :match-id="matchId" :existing="myVideos" @uploaded="load" />

      <ShareVideoModal :video="sharing" @close="sharing = null" />
    </template>
  </section>
</template>
