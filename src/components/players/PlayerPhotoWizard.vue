<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import BrandMark from '@/components/layout/BrandMark.vue';
import PhotoEditor from '@/components/players/PhotoEditor.vue';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import { cutOutFigure, type CutOut } from '@/utils/figureCutout';
import type { CoachDto, PlayerDto } from '@/types/api';

/**
 * Asistente para que el jugador (o el técnico, con kind="coach") suba su foto como las de los profesionales: consejos para
 * hacerla, recorte automático de la figura en el propio navegador (la foto original no sale del dispositivo), un editor
 * para colocarla a mano dentro del marco de la ficha y retocar el recorte (`PhotoEditor`), y subida del resultado en PNG
 * con fondo transparente. Cada uno sube la suya: el jugador recibe su cuenta en «saved» y el técnico en «savedCoach».
 */
const props = withDefaults(defineProps<{ open: boolean; hasPhoto: boolean; kind?: 'player' | 'coach' }>(), { kind: 'player' });
const emit = defineEmits<{ close: []; saved: [player: PlayerDto]; savedCoach: [coach: CoachDto] }>();

const forCoach = computed(() => props.kind === 'coach');

async function upload(file: File) {
  if (forCoach.value) emit('savedCoach', await api.coaches.uploadPhoto(file));
  else emit('saved', await api.players.uploadPhoto(file));
}

type Step = 'tips' | 'working' | 'frame';
const step = ref<Step>('tips');
const error = ref<string | null>(null);
const busy = ref(false);
const cut = ref<CutOut | null>(null);
// Cada foto nueva abre un editor nuevo (sin los retoques ni el encuadre de la anterior).
const photoNumber = ref(0);
const editor = ref<InstanceType<typeof PhotoEditor> | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const cameraInput = ref<HTMLInputElement | null>(null);

watch(() => props.open, (open) => {
  if (!open) return;
  step.value = 'tips';
  error.value = null;
  cut.value = null;
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
    photoNumber.value++;
    step.value = 'frame';
    if (!cut.value.figureFound) {
      error.value = 'No hemos encontrado bien tu figura: puedes subirla sin quitar el fondo, recortarla tú con «Recuperar» o probar con otra foto con más luz y fondo liso.';
    }
  } catch (e) {
    step.value = 'tips';
    error.value = `No se ha podido preparar la foto: ${errorMessage(e)}`;
  }
}

const canSave = computed(() => step.value === 'frame' && cut.value !== null);

async function save() {
  if (!editor.value) return;
  busy.value = true;
  error.value = null;
  try {
    const blob = await editor.value.exportBlob();
    await upload(new File([blob], blob.type === 'image/png' ? 'foto.png' : 'foto.webp', { type: blob.type }));
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
    if (forCoach.value) emit('savedCoach', await api.coaches.deletePhoto());
    else emit('saved', await api.players.deletePhoto());
    emit('close');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

const tips = computed(() => [
  {
    icon: 'user',
    title: 'De cintura para arriba',
    text: forCoach.value ? 'Mirando a cámara, con el chándal o el polo del club si lo tienes a mano.' : 'Mirando a cámara, con la equipación si la tienes a mano.',
  },
  { icon: 'circle-info', title: 'Fondo liso y buena luz', text: 'Una pared clara y la luz de frente: el recorte sale mucho más limpio.' },
  { icon: 'camera', title: 'Sin gorra ni gafas de sol', text: 'Que se te vea bien la cara; puedes repetirla cuando quieras.' },
]);
</script>

<template>
  <Modal :open="open" :title="forCoach ? 'Tu foto de técnico' : 'Tu foto de jugador'" :size="step === 'frame' ? 'xl' : 'lg'" @close="emit('close')">
    <Alert v-if="error" kind="warning" class="mb-4">{{ error }}</Alert>

    <template v-if="step === 'tips'">
      <p class="text-sm text-slate-600">
        Haz la foto como en las fichas de los profesionales: recortamos tu figura automáticamente y la colocamos sobre el fondo de tu
        ficha. Después la mueves con el ratón o el dedo, la giras y, si el recorte se ha comido o dejado algo, lo retocas con el pincel o
        rodeándolo con el lazo.
        Todo se hace en tu dispositivo; solo se sube el resultado.
      </p>
      <ul class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
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
        <button v-if="hasPhoto" type="button" class="btn-ghost-danger ml-auto" v-busy="busy" :disabled="busy" @click="removePhoto">Quitar mi foto</button>
      </div>
    </template>

    <div v-else-if="step === 'working'" class="flex flex-col items-center gap-3 py-10 text-sm text-slate-600">
      <BrandMark :size="44" animated />
      <p>Recortando tu figura…</p>
      <p class="text-xs text-slate-400">La primera vez descarga el modelo de recorte (unos segundos).</p>
    </div>

    <template v-else-if="step === 'frame' && cut">
      <PhotoEditor ref="editor" :key="photoNumber" :cut="cut" />
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-ghost" @click="step = 'tips'">Elegir otra</button>
        <button type="button" class="btn-primary" v-busy="busy" :disabled="busy || !canSave" @click="save"><Icon icon="check" class="mr-1.5 h-3.5 w-3.5" />Guardar mi foto</button>
      </div>
    </template>
  </Modal>
</template>
