<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import BrandMark from '@/components/layout/BrandMark.vue';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import { cutOutFigure, type CutOut } from '@/utils/figureCutout';
import type { PlayerDto } from '@/types/api';

/**
 * Asistente para que el jugador suba su foto como las de los futbolistas profesionales: consejos para hacerla, recorte
 * automático de la figura en el propio navegador (la foto original no sale del dispositivo), encuadre con zoom y altura
 * sobre el fondo de la ficha, y subida del resultado en PNG con fondo transparente.
 */
const props = defineProps<{ open: boolean; hasPhoto: boolean }>();
const emit = defineEmits<{ close: []; saved: [player: PlayerDto] }>();

type Step = 'tips' | 'working' | 'frame';
const step = ref<Step>('tips');
const error = ref<string | null>(null);
const busy = ref(false);
const cut = ref<CutOut | null>(null);
const removeBackground = ref(true);
const zoom = ref(1);
const lift = ref(0);
const preview = ref<HTMLCanvasElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const cameraInput = ref<HTMLInputElement | null>(null);

const OUT_W = 800;
const OUT_H = 1000;

watch(() => props.open, (open) => {
  if (!open) return;
  step.value = 'tips';
  error.value = null;
  cut.value = null;
  zoom.value = 1;
  lift.value = 0;
  removeBackground.value = true;
});

async function onFile(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    error.value = 'Elige una imagen (JPG, PNG, HEIC convertida…).';
    return;
  }
  error.value = null;
  step.value = 'working';
  try {
    cut.value = await cutOutFigure(file);
    removeBackground.value = cut.value.figureFound;
    step.value = 'frame';
    requestAnimationFrame(draw);
    if (!cut.value.figureFound) error.value = 'No hemos encontrado bien tu figura; puedes subirla sin recortar o probar con otra foto con más luz y fondo liso.';
  } catch (e) {
    step.value = 'tips';
    error.value = `No se ha podido preparar la foto: ${errorMessage(e)}`;
  }
}

// Coloca la figura recortada en un lienzo 4:5, apoyada abajo como en las fichas profesionales.
function compose(target: HTMLCanvasElement, background: boolean) {
  const c = cut.value;
  if (!c) return;
  const ctx = target.getContext('2d')!;
  target.width = OUT_W;
  target.height = OUT_H;
  ctx.clearRect(0, 0, OUT_W, OUT_H);

  if (background) {
    const g = ctx.createLinearGradient(0, 0, OUT_W, OUT_H);
    g.addColorStop(0, '#16388a');
    g.addColorStop(1, '#0a1f4d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, OUT_W, OUT_H);
  }

  const source = removeBackground.value ? c.figure : c.original;
  const box = removeBackground.value ? c.box : { x: 0, y: 0, w: c.original.width, h: c.original.height };
  const scale = (OUT_H * 0.94 * zoom.value) / box.h;
  const w = box.w * scale;
  const h = box.h * scale;
  const x = (OUT_W - w) / 2;
  const y = OUT_H - h + (removeBackground.value ? 0 : (h - OUT_H) / 2) - lift.value * OUT_H * 0.25;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, box.x, box.y, box.w, box.h, x, y, w, h);
}

function draw() {
  if (preview.value) compose(preview.value, true);
}
watch([zoom, lift, removeBackground], () => requestAnimationFrame(draw));

const canSave = computed(() => step.value === 'frame' && cut.value !== null);

async function save() {
  if (!cut.value) return;
  busy.value = true;
  error.value = null;
  try {
    const out = document.createElement('canvas');
    compose(out, false);
    let blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
    if (blob && blob.size > 2.8 * 1024 * 1024) blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/webp', 0.9));
    if (!blob) throw new Error('el navegador no ha podido generar la imagen');
    const player = await api.players.uploadPhoto(new File([blob], blob.type === 'image/png' ? 'foto.png' : 'foto.webp', { type: blob.type }));
    emit('saved', player);
    emit('close');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function removePhoto() {
  busy.value = true;
  error.value = null;
  try {
    emit('saved', await api.players.deletePhoto());
    emit('close');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

const tips = [
  { icon: 'user', title: 'De cintura para arriba', text: 'Mirando a cámara, con la equipación si la tienes a mano.' },
  { icon: 'circle-info', title: 'Fondo liso y buena luz', text: 'Una pared clara y la luz de frente: el recorte sale mucho más limpio.' },
  { icon: 'camera', title: 'Sin gorra ni gafas de sol', text: 'Que se te vea bien la cara; puedes repetirla cuando quieras.' },
];
</script>

<template>
  <Modal :open="open" title="Tu foto de jugador" size="lg" @close="emit('close')">
    <Alert v-if="error" kind="warning" class="mb-4">{{ error }}</Alert>

    <template v-if="step === 'tips'">
      <p class="text-sm text-slate-600">
        Haz la foto como en las fichas de los profesionales: recortamos tu figura automáticamente y la colocamos sobre el fondo de tu
        ficha. El recorte se hace en tu dispositivo; solo se sube el resultado.
      </p>
      <ul class="mt-4 grid gap-3 sm:grid-cols-3">
        <li v-for="tip in tips" :key="tip.title" class="rounded-xl border border-line bg-surface-2 p-3">
          <Icon :icon="tip.icon" class="h-4 w-4 text-brand-500" />
          <p class="mt-2 text-sm font-semibold text-slate-900">{{ tip.title }}</p>
          <p class="mt-1 text-xs text-slate-500">{{ tip.text }}</p>
        </li>
      </ul>
      <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onFile" />
      <input ref="cameraInput" type="file" accept="image/*" capture="user" class="hidden" @change="onFile" />
      <div class="mt-5 flex flex-wrap items-center gap-2">
        <button type="button" class="btn-primary" @click="cameraInput?.click()"><Icon icon="camera" class="mr-1.5 h-3.5 w-3.5" />Hacer foto</button>
        <button type="button" class="btn-secondary" @click="fileInput?.click()"><Icon icon="cloud-arrow-up" class="mr-1.5 h-3.5 w-3.5" />Elegir de la galería</button>
        <button v-if="hasPhoto" type="button" class="btn-ghost ml-auto text-red-600" v-busy="busy" :disabled="busy" @click="removePhoto">Quitar mi foto</button>
      </div>
    </template>

    <div v-else-if="step === 'working'" class="flex flex-col items-center gap-3 py-10 text-sm text-slate-600">
      <BrandMark :size="44" animated />
      <p>Recortando tu figura…</p>
      <p class="text-xs text-slate-400">La primera vez descarga el modelo de recorte (unos segundos).</p>
    </div>

    <template v-else-if="step === 'frame' && cut">
      <div class="grid gap-5 sm:grid-cols-[minmax(0,15rem)_1fr]">
        <canvas ref="preview" class="mx-auto aspect-[4/5] w-full max-w-60 rounded-xl border border-line shadow-card" />
        <div class="space-y-4">
          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input v-model="removeBackground" type="checkbox" class="h-4 w-4 accent-brand-500" :disabled="!cut.figureFound" />
            Quitar el fondo
          </label>
          <div>
            <label class="label" for="photo-zoom">Tamaño</label>
            <input id="photo-zoom" v-model.number="zoom" type="range" min="0.6" max="1.5" step="0.01" class="w-full accent-brand-500" />
          </div>
          <div>
            <label class="label" for="photo-lift">Altura</label>
            <input id="photo-lift" v-model.number="lift" type="range" min="-0.6" max="0.6" step="0.01" class="w-full accent-brand-500" />
          </div>
          <p class="text-xs text-slate-500">Encuádrate de cintura para arriba con la cabeza cerca del borde superior, como en la vista previa de las fichas.</p>
        </div>
      </div>
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-ghost" @click="step = 'tips'">Elegir otra</button>
        <button type="button" class="btn-primary" v-busy="busy" :disabled="busy || !canSave" @click="save"><Icon icon="check" class="mr-1.5 h-3.5 w-3.5" />Guardar mi foto</button>
      </div>
    </template>
  </Modal>
</template>
