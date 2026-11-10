<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import Modal from '@/components/ui/Modal.vue';

/**
 * Notas de un jugador en el acta interna, con sitio para escribir: en la tabla solo cabe un trozo y una casilla de texto
 * cortaba lo escrito. Sin permiso de edición solo se leen. La nota pasa a la línea del jugador y se guarda con el acta.
 */
const props = defineProps<{
  open: boolean;
  playerName: string;
  photoUrl?: string | null;
  /** «Jornada 7 · vs Nalón CF». */
  context?: string;
  note: string | null;
  readonly?: boolean;
}>();
const emit = defineEmits<{ close: []; save: [note: string | null] }>();

const MAX_LENGTH = 1000;
const draft = ref('');
const field = ref<HTMLTextAreaElement | null>(null);

watch(() => props.open, async (open) => {
  if (!open) return;
  draft.value = props.note ?? '';
  await nextTick();
  if (!props.readonly) field.value?.focus();
});

const hadNote = computed(() => !!props.note?.trim());
const nearLimit = computed(() => draft.value.length > MAX_LENGTH - 100);

function apply() {
  emit('save', draft.value.trim() ? draft.value.trim() : null);
}
</script>

<template>
  <Modal :open="open" :title="`Notas de ${playerName}`" size="md" @close="emit('close')">
    <template #header>
      <div class="flex min-w-0 items-center gap-3">
        <PlayerAvatar :src="photoUrl" :name="playerName" size="lg" />
        <div class="min-w-0">
          <p class="eyebrow flex items-center gap-1.5"><Icon icon="comment-dots" class="text-[11px]" />Notas del partido</p>
          <h2 class="truncate text-lg font-bold text-slate-900">{{ playerName }}</h2>
          <p v-if="context" class="text-xs text-slate-500">{{ context }}</p>
        </div>
      </div>
    </template>

    <template v-if="readonly">
      <p v-if="hadNote" class="whitespace-pre-line rounded-lg bg-surface-2 px-4 py-3 text-sm leading-relaxed text-slate-800">{{ note }}</p>
      <p v-else class="text-sm text-slate-500">Sin notas en este partido.</p>
    </template>
    <template v-else>
      <label for="player-note" class="label">Qué destacar de su partido</label>
      <textarea
        id="player-note"
        ref="field"
        v-model="draft"
        rows="7"
        :maxlength="MAX_LENGTH"
        class="input resize-y leading-relaxed"
        placeholder="Por ejemplo: «Muy bien en la presión tras pérdida; le costó en los balones a la espalda. Trabajar el perfil defensivo.»"
        @keydown.ctrl.enter.prevent="apply"
        @keydown.meta.enter.prevent="apply"
      />
      <div class="mt-1 flex justify-between gap-3 text-xs text-slate-500">
        <span>Ctrl + Enter para aplicarla. Se guarda con el acta al pulsar «Guardar acta».</span>
        <span class="shrink-0 tabular-nums" :class="nearLimit ? 'font-semibold text-amber-600' : ''">{{ draft.length }}/{{ MAX_LENGTH }}</span>
      </div>
    </template>

    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <button v-if="!readonly && hadNote" type="button" class="btn-ghost text-red-600" @click="emit('save', null)">
          <Icon icon="trash" class="text-xs" />Quitar la nota
        </button>
        <span v-else />
        <div class="flex gap-2">
          <button type="button" class="btn-secondary" @click="emit('close')">{{ readonly ? 'Cerrar' : 'Cancelar' }}</button>
          <button v-if="!readonly" type="button" class="btn-primary" @click="apply"><Icon icon="check" class="text-xs" />Aplicar a la línea</button>
        </div>
      </div>
    </template>
  </Modal>
</template>
