<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';
import Modal from '@/components/ui/Modal.vue';
import type VideoPlayerComponent from '@/components/videos/VideoPlayer.vue';
import {
  momentKindLabels,
  momentKindOrder,
  type MomentKind,
  type MomentSide,
  type MomentVideo,
  type VideoMoment,
} from '@/components/sheet/videoMoments';
import { formatVideoClock } from '@/utils/format';

// «Ver en el vídeo»: cada acción que vio el analizador, en el segundo del vídeo en que pasó. Empieza unos segundos antes
// para ver la jugada entera; la lista y «Anterior» / «Siguiente» saltan de una a otra sin volver a cargar el vídeo (si la
// acción es de la otra parte, se carga ese vídeo). El vídeo se pide como siempre, con su ticket: si no se puede ver, lo dice.
const props = defineProps<{
  open: boolean;
  title: string;
  subtitle?: string;
  moments: VideoMoment[];
  videos: MomentVideo[];
  /** Filtro con el que se abre (la acción en la que se hizo clic); sin él, todas. */
  kind?: MomentKind | null;
  /** En los datos de equipo: el nombre de cada uno, para filtrar por equipo. */
  sides?: Record<MomentSide, string> | null;
}>();
const emit = defineEmits<{ close: [] }>();

const LEAD_SECONDS = 4;

type KindFilter = MomentKind | 'all';
type SideFilter = MomentSide | 'all';
const kind = ref<KindFilter>('all');
const side = ref<SideFilter>('all');

const videoOrder = computed(() => new Map(props.videos.map((video, index) => [video.videoId, index])));
const sorted = computed(() =>
  [...props.moments].sort((a, b) => (videoOrder.value.get(a.videoId) ?? 0) - (videoOrder.value.get(b.videoId) ?? 0) || a.t - b.t));
const position = computed(() => new Map(sorted.value.map((moment, index) => [moment, index])));
const multipleVideos = computed(() => new Set(props.moments.map((m) => m.videoId)).size > 1);

const ofKind = (moment: VideoMoment) => kind.value === 'all' || moment.kinds.includes(kind.value);
const ofSide = (moment: VideoMoment) => side.value === 'all' || moment.side === side.value;
const visible = computed(() => sorted.value.filter((m) => ofKind(m) && ofSide(m)));

const kindOptions = computed(() => {
  const pool = sorted.value.filter(ofSide);
  const count = (k: MomentKind) => pool.filter((m) => m.kinds.includes(k)).length;
  return [
    { value: 'all' as KindFilter, label: `Todo (${pool.length})` },
    ...momentKindOrder
      .filter((k) => count(k) > 0 || k === kind.value)
      .map((k) => ({ value: k as KindFilter, label: `${momentKindLabels[k]} (${count(k)})` })),
  ];
});
const sideOptions = computed(() => {
  if (!props.sides) return [];
  const pool = sorted.value.filter(ofKind);
  const count = (s: MomentSide) => pool.filter((m) => m.side === s).length;
  return [
    { value: 'all' as SideFilter, label: `Los dos (${pool.length})` },
    { value: 'ours' as SideFilter, label: `${props.sides.ours} (${count('ours')})` },
    { value: 'rival' as SideFilter, label: `${props.sides.rival} (${count('rival')})` },
  ];
});

const current = ref<VideoMoment | null>(null);
/** Con un filtro distinto, «Siguiente» sigue desde la acción que se está viendo, aunque no salga en la lista. */
const previous = computed(() => {
  const at = current.value ? (position.value.get(current.value) ?? -1) : -1;
  return [...visible.value].reverse().find((m) => (position.value.get(m) ?? 0) < at) ?? null;
});
const next = computed(() => {
  const at = current.value ? (position.value.get(current.value) ?? -1) : -1;
  return visible.value.find((m) => (position.value.get(m) ?? 0) > at) ?? null;
});

const videoOf = (moment: VideoMoment) => props.videos.find((v) => v.videoId === moment.videoId);
const clock = (moment: VideoMoment) =>
  multipleVideos.value ? `${videoOf(moment)?.label ?? ''} · ${formatVideoClock(moment.t)}` : formatVideoClock(moment.t);

// --- El vídeo ---

// El reproductor se descarga al abrir la ventana con un vídeo, no con el acta.
const VideoPlayer = defineAsyncComponent(() => import('@/components/videos/VideoPlayer.vue'));
const player = ref<InstanceType<typeof VideoPlayerComponent> | null>(null);
const src = ref<string | null>(null);
const shownVideo = ref<string | null>(null);
const startAt = ref(0);
const loadingVideo = ref(false);
const videoError = ref<string | null>(null);
const shown = computed(() => props.videos.find((v) => v.videoId === shownVideo.value) ?? null);

let request = 0;
async function show(moment: VideoMoment) {
  current.value = moment;
  const at = Math.max(0, moment.t - LEAD_SECONDS);
  if (src.value && shownVideo.value === moment.videoId && player.value) {
    player.value.seek(at);
    return;
  }
  const mine = ++request;
  loadingVideo.value = true;
  videoError.value = null;
  try {
    const ticket = await api.videos.ticket(moment.videoId);
    if (mine !== request) return;
    startAt.value = at;
    shownVideo.value = moment.videoId;
    src.value = api.videos.streamUrl(ticket);
  } catch (e) {
    if (mine === request) videoError.value = errorMessage(e);
  } finally {
    if (mine === request) loadingVideo.value = false;
  }
}

watch(
  () => props.open,
  (open) => {
    request++;
    src.value = null;
    shownVideo.value = null;
    current.value = null;
    videoError.value = null;
    loadingVideo.value = false;
    if (!open) return;
    kind.value = props.kind ?? 'all';
    side.value = 'all';
    const first = visible.value[0];
    if (first) void show(first);
  },
  { immediate: true },
);

// La acción que se está viendo, siempre a la vista en la lista (sin mover el resto de la ventana).
const list = ref<HTMLElement | null>(null);
watch(current, () =>
  void nextTick(() => {
    const box = list.value;
    const row = box?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!box || !row) return;
    if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
  }));
</script>

<template>
  <Modal :open="open" :title="title" size="xl" @close="emit('close')">
    <template #header>
      <div class="min-w-0">
        <h2 class="break-words text-lg font-bold text-slate-900">{{ title }}</h2>
        <p v-if="subtitle" class="break-words text-xs text-slate-500">{{ subtitle }}</p>
      </div>
    </template>

    <div class="grid gap-x-4 gap-y-3 lg:grid-cols-[minmax(0,1fr)_19rem]">
      <!-- Los filtros: en el móvil, entre el vídeo y la lista; en pantalla ancha, encima de los dos y a lo ancho -->
      <div class="order-2 min-w-0 space-y-2 lg:order-first lg:col-span-2">
        <ChoiceToggle v-if="sideOptions.length" v-model="side" :options="sideOptions" label="De qué equipo" size="xs" min-item="8.5rem" />
        <ChoiceToggle v-model="kind" :options="kindOptions" label="Qué acciones" size="xs" min-item="8.5rem" />
      </div>

      <div class="order-1 min-w-0">
        <Alert v-if="videoError" kind="error">
          No se puede abrir el vídeo: {{ videoError }}
          <button v-if="current" type="button" class="btn-ghost ml-1 px-2 py-0.5 text-xs" @click="show(current)">Reintentar</button>
        </Alert>
        <VideoPlayer
          v-else-if="src"
          :key="src"
          ref="player"
          :src="src"
          :type="shown?.contentType ?? 'video/mp4'"
          :title="shown?.title"
          :start="startAt"
        />
        <div v-else class="flex aspect-video items-center justify-center rounded-xl bg-black px-4 text-center text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
          {{ loadingVideo ? 'Preparando el vídeo…' : 'Elige una acción de la lista' }}
        </div>

        <div class="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button type="button" class="btn-secondary px-3 py-1 text-xs" :disabled="!previous" @click="previous && show(previous)">
            <Icon icon="chevron-left" class="h-3 w-3" />Anterior
          </button>
          <p v-if="current" class="min-w-0 flex-1 basis-40 text-center text-sm text-slate-700" aria-live="polite">
            <strong class="break-words font-semibold text-slate-900">{{ current.label }}</strong>
            <template v-if="current.who"> · {{ current.who }}</template>
            · <span class="font-figures tabular-nums">{{ clock(current) }}</span>
          </p>
          <button type="button" class="btn-secondary px-3 py-1 text-xs" :disabled="!next" @click="next && show(next)">
            Siguiente<Icon icon="chevron-right" class="h-3 w-3" />
          </button>
        </div>
        <p class="mt-2 text-[11px] text-slate-500">
          El minuto es el del vídeo, no el del partido. Cada acción empieza {{ LEAD_SECONDS }} s antes para ver la jugada entera.
        </p>
      </div>

      <div class="order-3 min-w-0">
        <ul ref="list" class="relative max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-line lg:max-h-[min(55vh,30rem)]">
          <li v-for="moment in visible" :key="position.get(moment)">
            <button
              type="button"
              class="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-surface-2"
              :class="moment === current ? 'bg-brand-500/10' : ''"
              :aria-current="moment === current ? 'true' : undefined"
              @click="show(moment)"
            >
              <span class="w-16 shrink-0 font-figures text-sm font-semibold tabular-nums text-slate-900">{{ formatVideoClock(moment.t) }}</span>
              <span v-if="moment.color" class="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-line" :style="{ backgroundColor: moment.color }" aria-hidden="true" />
              <span class="min-w-0 flex-1 text-sm text-slate-700">
                <span class="break-words">{{ moment.label }}</span>
                <span v-if="moment.who || multipleVideos" class="block break-words text-[11px] text-slate-500">
                  {{ [moment.who, multipleVideos ? videoOf(moment)?.label : null].filter(Boolean).join(' · ') }}
                </span>
              </span>
              <span class="shrink-0 text-xs font-semibold text-brand-500">
                <Icon :icon="moment === current ? 'eye' : 'play'" class="mr-1 h-2.5 w-2.5" />{{ moment === current ? 'Viendo' : 'Ver' }}
              </span>
            </button>
          </li>
          <li v-if="visible.length === 0" class="px-3 py-4 text-center text-sm text-slate-500">El vídeo no ha visto ninguna.</li>
        </ul>
      </div>
    </div>
  </Modal>
</template>
