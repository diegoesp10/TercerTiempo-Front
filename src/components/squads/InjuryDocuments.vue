<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { InjuryDocumentDto, InjuryDocumentKind, InjuryDto } from '@/types/api';
import { formatBytes, formatDate, injuryDocumentKindLabels } from '@/utils/format';

/**
 * Pruebas e informes de una lesión (radiografías, resonancias, informes del hospital...). Los adjunta el club o el cuerpo
 * técnico; los abren ellos y el propio jugador. El administrador ve que existen pero no los abre.
 */
const props = defineProps<{ squadId: string; injury: InjuryDto; canManage: boolean; canOpen: boolean }>();
const emit = defineEmits<{ updated: [injuries: InjuryDto[]] }>();

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_DOCUMENTS = 10;
const ACCEPT = '.pdf,application/pdf,image/jpeg,image/png,image/webp';
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

const documents = computed(() => props.injury.documents ?? []);
const full = computed(() => documents.value.length >= MAX_DOCUMENTS);

const busy = ref(false);
const error = ref<string | null>(null);
const formOpen = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);
const form = reactive<{ kind: InjuryDocumentKind; note: string; file: File | null }>({ kind: 'Imaging', note: '', file: null });
const kinds = Object.entries(injuryDocumentKindLabels) as [InjuryDocumentKind, string][];

function openForm() {
  form.kind = 'Imaging';
  form.note = '';
  form.file = null;
  error.value = null;
  formOpen.value = true;
}

function pick(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0] ?? null;
  error.value = null;
  if (file && !TYPES.includes(file.type)) {
    error.value = 'Formato no admitido: sube un PDF o una imagen (JPG, PNG o WebP).';
    form.file = null;
  } else if (file && file.size > MAX_BYTES) {
    error.value = 'Cada documento puede ocupar como mucho 15 MB.';
    form.file = null;
  } else {
    form.file = file;
  }
}

async function upload() {
  if (!form.file) return;
  busy.value = true;
  error.value = null;
  try {
    emit('updated', await api.squads.uploadInjuryDocument(props.squadId, props.injury.id, form.file, form.kind, form.note.trim() || null));
    formOpen.value = false;
    if (fileInput.value) fileInput.value.value = '';
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

async function remove(document: InjuryDocumentDto) {
  if (!(await confirmDialog({ title: `Quitar «${document.fileName}»`, message: 'Se borra el fichero y no se puede recuperar.', confirmLabel: 'Quitar', danger: true }))) return;
  busy.value = true;
  error.value = null;
  try {
    emit('updated', await api.squads.deleteInjuryDocument(document));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = false;
  }
}

// Se pide con la sesión (un enlace normal no manda el token) y se abre en otra pestaña desde memoria. La pestaña se abre
// antes de pedirlo para que el navegador no la tome por una ventana emergente.
async function open(document: InjuryDocumentDto, download = false) {
  const tab = download ? null : window.open('', '_blank');
  error.value = null;
  try {
    const blob = await api.squads.injuryDocumentFile(document);
    const url = URL.createObjectURL(new Blob([blob], { type: document.contentType }));
    if (tab) {
      tab.location.href = url;
    } else {
      const link = window.document.createElement('a');
      link.href = url;
      link.download = document.fileName;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    tab?.close();
    error.value = errorMessage(e);
  }
}

const iconOf = (document: InjuryDocumentDto) => (document.contentType === 'application/pdf' ? 'file-pdf' : 'file-image');
</script>

<template>
  <div v-if="documents.length > 0 || canManage" class="mt-2">
    <ul v-if="documents.length > 0" class="space-y-1">
      <li v-for="document in documents" :key="document.id" class="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-xs">
        <Icon :icon="iconOf(document)" class="h-3.5 w-3.5 shrink-0 text-slate-500" />
        <div class="min-w-0 flex-1">
          <button v-if="canOpen" type="button" class="block max-w-full text-left font-medium text-slate-800 [overflow-wrap:anywhere] hover:text-accent-400" :title="`Abrir ${document.fileName}`" @click="open(document)">
            {{ document.fileName }}
          </button>
          <span v-else class="block font-medium text-slate-800 [overflow-wrap:anywhere]">{{ document.fileName }}</span>
          <span class="block break-words text-slate-500">
            {{ document.kindLabel }} · {{ formatBytes(document.sizeBytes) }} · {{ formatDate(document.uploadedAt) }}<template v-if="document.note"> · {{ document.note }}</template>
          </span>
        </div>
        <span class="flex shrink-0 gap-0.5">
          <button v-if="canOpen" type="button" class="btn-ghost px-1.5 py-1" aria-label="Descargar" title="Descargar" @click="open(document, true)"><Icon icon="download" class="h-3 w-3" /></button>
          <button v-if="canManage" type="button" class="btn-ghost-danger px-1.5 py-1" v-busy="busy" :disabled="busy" aria-label="Quitar el documento" title="Quitar" @click="remove(document)">
            <Icon icon="trash" class="h-3 w-3" />
          </button>
        </span>
      </li>
    </ul>

    <Alert v-if="error && !formOpen" kind="error" class="mt-2">{{ error }}</Alert>

    <template v-if="canManage">
      <button v-if="!formOpen" type="button" class="btn-ghost btn-sm mt-1 px-2" :disabled="busy || full" :title="full ? 'Una lesión admite como mucho 10 documentos' : undefined" @click="openForm">
        <Icon icon="paperclip" class="mr-1 h-3 w-3" />Adjuntar radiografía o informe
      </button>

      <form v-else class="mt-2 space-y-2 rounded-lg border border-line bg-surface-2 p-3" @submit.prevent="upload">
        <Alert v-if="error" kind="error">{{ error }}</Alert>
        <div class="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo de documento">
          <button
            v-for="[kind, label] in kinds"
            :key="kind"
            type="button"
            role="radio"
            :aria-checked="form.kind === kind"
            class="rounded-full border px-2.5 py-1 text-xs"
            :class="form.kind === kind ? 'border-accent-500 bg-accent-500/10 font-semibold text-accent-400' : 'border-line text-slate-600 hover:bg-surface-3'"
            @click="form.kind = kind"
          >
            {{ label }}
          </button>
        </div>
        <input ref="fileInput" type="file" :accept="ACCEPT" class="block w-full text-xs text-slate-600 file:mr-2 file:cursor-pointer file:rounded-md file:border-0 file:bg-surface-3 file:px-2.5 file:py-1.5 file:text-xs file:font-medium" @change="pick" />
        <input v-model="form.note" type="text" maxlength="200" class="input text-xs" placeholder="Nota opcional: resonancia del 12 de noviembre, informe de urgencias…" />
        <p class="text-2xs text-slate-500">PDF o imagen (JPG, PNG o WebP), hasta 15 MB. Solo lo abren el club, el cuerpo técnico y el propio jugador.</p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost btn-sm" @click="formOpen = false">Cancelar</button>
          <button type="submit" class="btn-primary btn-sm" v-busy="busy" :disabled="busy || !form.file"><Icon icon="cloud-arrow-up" class="mr-1 h-3 w-3" />Subir</button>
        </div>
      </form>
    </template>
  </div>
</template>
