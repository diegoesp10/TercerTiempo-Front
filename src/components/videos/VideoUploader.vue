<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { useDropZone } from '@vueuse/core';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import { uploadVideoChunk } from '@/api/videoUpload';
import Alert from '@/components/ui/Alert.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import type { MatchVideoDto, VideoPart, VideoUploadDto } from '@/types/api';
import { formatBytes, videoPartLabels } from '@/utils/format';

// Subida de un vídeo de partido por trozos: progreso real, reintentos por trozo y reanudación (también tras recargar
// la página, mientras la sesión de subida no caduque en la API).
const props = defineProps<{ squadId: string; matchId: string; existing: MatchVideoDto[] }>();
const emit = defineEmits<{ uploaded: [video: MatchVideoDto] }>();

const MAX_BYTES = 4 * 1024 ** 3;
const ALLOWED = new Map<string, string>([['mp4', 'video/mp4'], ['m4v', 'video/mp4'], ['webm', 'video/webm']]);
const MAX_RETRIES = 4;

const parts: VideoPart[] = ['Full', 'FirstHalf', 'SecondHalf'];
const taken = computed(() => new Set(props.existing.map((v) => v.part)));
const partOptions = computed<SelectOption[]>(() =>
  parts.map((part) => ({
    value: part,
    label: videoPartLabels[part],
    hint: taken.value.has(part) ? 'ya subido' : taken.value.size > 0 && (part === 'Full' || taken.value.has('Full')) ? 'no se mezcla con lo subido' : undefined,
    disabled: taken.value.has(part) || (taken.value.size > 0 && (part === 'Full' || taken.value.has('Full'))),
  })),
);
const defaultPart = (): VideoPart | null => partOptions.value.find((o) => !o.disabled)?.value as VideoPart | undefined ?? null;
const part = ref<VideoPart | null>(defaultPart());
watch(taken, () => { if (!part.value || partOptions.value.find((o) => o.value === part.value)?.disabled) part.value = defaultPart(); });

const file = ref<File | null>(null);
const title = ref('');
const fileError = ref<string | null>(null);

const contentTypeOf = (f: File) => ALLOWED.get(f.name.split('.').pop()?.toLowerCase() ?? '') ?? (ALLOWED.has(f.type.replace('video/', '')) ? f.type : null);

// Zona de arrastre (useDropZone de VueUse) y selector clásico: los dos pasan por la misma validación.
const dropRef = ref<HTMLElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const { isOverDropZone } = useDropZone(dropRef, { onDrop: (files) => pick(files?.[0] ?? null), multiple: false, preventDefaultForUnhandled: true });

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  pick(input.files?.[0] ?? null);
  input.value = '';
}

function pick(picked: File | null) {
  fileError.value = null;
  file.value = null;
  if (!picked) return;
  if (!contentTypeOf(picked)) {
    fileError.value = 'Solo se admiten vídeos MP4 o WebM. Si lo tienes en MOV o MKV, expórtalo a MP4 (H.264) antes de subirlo.';
    return;
  }
  if (picked.size > MAX_BYTES) {
    fileError.value = `El archivo ocupa ${formatBytes(picked.size)} y el máximo son 4 GB. Reexpórtalo a 720p con 2–3 Mbps o súbelo en dos partes.`;
    return;
  }
  file.value = picked;
}

// --- Estado de la subida ---
type Status = 'idle' | 'uploading' | 'paused' | 'finishing' | 'done';
const status = ref<Status>('idle');
const session = ref<VideoUploadDto | null>(null);
const sentBytes = ref(0);
const speed = ref(0);
const error = ref<string | null>(null);
let controller: AbortController | null = null;
let operation = 0;
let disposed = false;

const percent = computed(() => (file.value ? Math.min(100, Math.round((sentBytes.value / file.value.size) * 100)) : 0));
const remainingSeconds = computed(() => (file.value && speed.value > 0 ? Math.round((file.value.size - sentBytes.value) / speed.value) : null));
const formatDuration = (seconds: number) => (seconds >= 3600 ? `${Math.floor(seconds / 3600)} h ${Math.round((seconds % 3600) / 60)} min` : seconds >= 60 ? `${Math.round(seconds / 60)} min` : `${seconds} s`);

const storageKey = () => `tt.video-upload.${props.squadId}.${props.matchId}`;
const remember = (s: VideoUploadDto | null) => {
  try {
    if (s) localStorage.setItem(storageKey(), JSON.stringify({ uploadId: s.uploadId, fileName: s.fileName, sizeBytes: s.sizeBytes, part: s.part }));
    else localStorage.removeItem(storageKey());
  } catch { /* sin almacenamiento local */ }
};
const remembered = (): { uploadId: string; fileName: string; sizeBytes: number; part: VideoPart } | null => {
  try { return JSON.parse(localStorage.getItem(storageKey()) ?? 'null'); } catch { return null; }
};

// Si hay una subida a medias del mismo archivo (mismo nombre y tamaño), se continúa donde se quedó.
async function resumableSession(f: File): Promise<VideoUploadDto | null> {
  const saved = remembered();
  if (!saved || saved.fileName !== f.name || saved.sizeBytes !== f.size) return null;
  try {
    const s = await api.squads.videoUpload(props.squadId, saved.uploadId);
    return s;
  } catch {
    remember(null);
    return null;
  }
}

async function start() {
  if (status.value === 'uploading' || status.value === 'finishing') return;
  const currentOperation = ++operation;
  const f = file.value;
  if (!f || !part.value) return;
  error.value = null;
  status.value = 'uploading';
  try {
    let s = await resumableSession(f);
    if (s) part.value = s.part;
    else {
      s = await api.squads.beginVideoUpload(props.squadId, props.matchId, {
        part: part.value,
        title: title.value.trim() || null,
        fileName: f.name,
        contentType: contentTypeOf(f)!,
        sizeBytes: f.size,
      });
      remember(s);
    }
    session.value = s;
    sentBytes.value = s.receivedBytes;
    if (disposed || currentOperation !== operation) return;
    await sendChunks(f, s);
  } catch (e) {
    if (disposed || currentOperation !== operation) return;
    if ((e as DOMException)?.name === 'AbortError') return;
    error.value = errorMessage(e);
    status.value = session.value ? 'paused' : 'idle';
  }
}

async function sendChunks(f: File, s: VideoUploadDto) {
  const uploadController = new AbortController();
  controller = uploadController;
  let index = s.nextChunk;
  let lastTick = performance.now();
  let lastBytes = sentBytes.value;

  while (sentBytes.value < f.size) {
    const startByte = index * s.chunkSize;
    const chunk = f.slice(startByte, Math.min(startByte + s.chunkSize, f.size));
    let attempt = 0;
    for (;;) {
      try {
        uploadController.signal.throwIfAborted();
        const result = await uploadVideoChunk(props.squadId, s.uploadId, index, chunk, (loaded) => {
          sentBytes.value = startByte + loaded;
          const now = performance.now();
          if (now - lastTick > 800) {
            speed.value = ((sentBytes.value - lastBytes) * 1000) / (now - lastTick);
            lastTick = now;
            lastBytes = sentBytes.value;
          }
        }, uploadController.signal);
        sentBytes.value = result.receivedBytes;
        index = result.nextChunk;
        break;
      } catch (e) {
        if ((e as DOMException)?.name === 'AbortError') throw e;
        // Un trozo fuera de orden significa que la API ya lo tenía (respuesta perdida): se pregunta por dónde va.
        if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) {
          const current = await api.squads.videoUpload(props.squadId, s.uploadId);
          if (current.nextChunk !== index) { sentBytes.value = current.receivedBytes; index = current.nextChunk; break; }
          throw e;
        }
        if (++attempt > MAX_RETRIES) throw e;
        await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      }
    }
  }

  uploadController.signal.throwIfAborted();
  status.value = 'finishing';
  const video = await api.squads.completeVideoUpload(props.squadId, s.uploadId);
  remember(null);
  status.value = 'done';
  emit('uploaded', video);
  reset(false);
}

function pause() {
  operation += 1;
  controller?.abort();
  status.value = 'paused';
}

async function cancel() {
  operation += 1;
  controller?.abort();
  if (session.value) {
    try { await api.squads.cancelVideoUpload(props.squadId, session.value.uploadId); } catch { /* ya no existía */ }
  }
  remember(null);
  reset(true);
}

function reset(clearFile: boolean) {
  session.value = null;
  sentBytes.value = 0;
  speed.value = 0;
  error.value = null;
  controller = null;
  if (clearFile) {
    file.value = null;
    title.value = '';
    status.value = 'idle';
  } else {
    file.value = null;
    title.value = '';
    part.value = defaultPart();
  }
}

onBeforeUnmount(() => { disposed = true; operation += 1; controller?.abort(); });
</script>

<template>
  <div class="border-t border-slate-100 pt-4">
    <div class="mb-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-xs text-slate-600">
      <p class="font-semibold text-slate-800"><Icon icon="circle-info" class="mr-1.5 h-3.5 w-3.5 text-accent-400" />Antes de subir</p>
      <ul class="mt-1 list-disc space-y-0.5 pl-5">
        <li>Formato <strong>MP4 (H.264)</strong> o WebM; MOV y MKV no se reproducen en el navegador.</li>
        <li>Exporta a <strong>720p con 2–3 Mbps</strong>: un partido entero queda en 2–3 GB y se ve perfectamente para analizar.</li>
        <li>Máximo <strong>4 GB por archivo</strong>. Si pesa más, súbelo en dos partes (1ª y 2ª parte).</li>
        <li>La subida va por trozos: si se corta, vuelve a elegir el mismo archivo y continúa donde se quedó.</li>
      </ul>
    </div>

    <form v-if="status === 'idle' || status === 'done'" class="flex flex-wrap items-end gap-3" @submit.prevent="start">
      <div class="w-48">
        <label class="label" for="video-part">Qué subes</label>
        <SearchSelect id="video-part" placeholder="Elige" :model-value="part" :options="partOptions" @update:model-value="part = ($event as VideoPart | null)" />
      </div>
      <div class="min-w-56 flex-1 basis-full">
        <span class="label">Archivo de vídeo</span>
        <div
          ref="dropRef"
          class="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center transition"
          :class="isOverDropZone ? 'border-brand-400 bg-brand-500/10' : file ? 'border-emerald-400/60 bg-emerald-500/5' : 'border-line bg-surface-2 hover:border-brand-400'"
          role="button"
          tabindex="0"
          aria-label="Elegir o arrastrar el archivo de vídeo"
          @click="fileInput?.click()"
          @keydown.enter.prevent="fileInput?.click()"
          @keydown.space.prevent="fileInput?.click()"
        >
          <input id="video-file" ref="fileInput" type="file" accept="video/mp4,video/webm,.mp4,.m4v,.webm" class="hidden" @change="onFileChange" />
          <Icon icon="cloud-arrow-up" class="h-7 w-7" :class="isOverDropZone ? 'text-brand-500' : 'text-slate-400'" />
          <template v-if="file">
            <p class="text-sm font-medium text-slate-800">{{ file.name }}</p>
            <p class="text-xs text-slate-500">{{ formatBytes(file.size) }} · haz clic o arrastra otro para cambiarlo</p>
          </template>
          <template v-else>
            <p class="text-sm font-medium text-slate-800">{{ isOverDropZone ? 'Suéltalo aquí' : 'Arrastra el vídeo aquí o haz clic para elegirlo' }}</p>
            <p class="text-xs text-slate-500">MP4 o WebM, hasta 4 GB</p>
          </template>
        </div>
        <p v-if="fileError" class="field-error">{{ fileError }}</p>
      </div>
      <div class="min-w-48 flex-1">
        <label class="label" for="video-title">Título (opcional)</label>
        <input id="video-title" v-model="title" type="text" maxlength="150" class="input" placeholder="Cámara fija desde la grada…" />
      </div>
      <button type="submit" class="btn-primary" :disabled="!file || !part"><Icon icon="arrow-up-from-bracket" class="mr-1.5 h-3.5 w-3.5" />Subir vídeo</button>
      <Alert v-if="error" kind="error" class="w-full">{{ error }}</Alert>
    </form>

    <div v-else class="rounded-lg border border-line bg-surface-2 p-4">
      <div class="flex flex-wrap items-center justify-between gap-2 text-sm">
        <p class="font-medium text-slate-800">
          {{ status === 'finishing' ? 'Guardando el vídeo…' : status === 'paused' ? 'Subida en pausa' : 'Subiendo' }}
          <span class="text-slate-500">· {{ part ? videoPartLabels[part] : '' }} · {{ file?.name }}</span>
        </p>
        <p class="tabular-nums text-slate-600">{{ formatBytes(sentBytes) }} / {{ file ? formatBytes(file.size) : '' }} · {{ percent }} %</p>
      </div>
      <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-200/60" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
        <div class="h-full rounded-full bg-brand-500 transition-[width] duration-300" :style="{ width: `${percent}%` }" />
      </div>
      <p class="mt-2 text-xs text-slate-500">
        <template v-if="status === 'uploading' && speed > 0">{{ formatBytes(speed) }}/s<template v-if="remainingSeconds !== null"> · quedan unos {{ formatDuration(remainingSeconds) }}</template> · mantén esta página abierta hasta terminar; si sales, podrás reanudar eligiendo el mismo archivo.</template>
        <template v-else-if="status === 'paused'">Reanuda cuando quieras: continúa desde el último trozo recibido.</template>
        <template v-else-if="status === 'finishing'">Comprobando el archivo y publicándolo.</template>
      </p>
      <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>
      <div class="mt-3 flex gap-2">
        <button v-if="status === 'uploading'" type="button" class="btn-secondary px-3 py-1 text-xs" :disabled="!session" @click="pause">Pausar</button>
        <button v-else-if="status === 'paused'" type="button" class="btn-primary px-3 py-1 text-xs" @click="start">Reanudar</button>
        <button v-if="status !== 'finishing'" type="button" class="btn-ghost px-3 py-1 text-xs text-red-600 hover:bg-red-50" :disabled="!session" @click="cancel">Cancelar subida</button>
      </div>
    </div>
  </div>
</template>
