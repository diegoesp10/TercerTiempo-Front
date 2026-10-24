<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';
import Modal from '@/components/ui/Modal.vue';
import { confirmState, settleConfirm } from '@/composables/useConfirm';

// Sustituye al confirm() del navegador: mismo modal que el resto de la app, con el foco en el botón principal.
const primary = ref<HTMLButtonElement | null>(null);
watch(() => confirmState.open, (open) => { if (open) void nextTick(() => primary.value?.focus()); });
</script>

<template>
  <Modal :open="confirmState.open" :title="confirmState.title" size="md" @close="settleConfirm(false)">
    <template #header>
      <div class="flex items-start gap-3">
        <span class="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" :class="confirmState.danger ? 'bg-red-500/15 text-red-500' : 'bg-brand-500/15 text-brand-500'">
          <Icon :icon="confirmState.danger ? 'triangle-exclamation' : 'circle-info'" class="h-4 w-4" />
        </span>
        <h2 class="text-lg font-bold text-slate-900">{{ confirmState.title }}</h2>
      </div>
    </template>
    <p class="text-sm text-slate-600">{{ confirmState.message }}</p>
    <template #footer>
      <div class="flex justify-end gap-2">
        <button type="button" class="btn-ghost" @click="settleConfirm(false)">{{ confirmState.cancelLabel }}</button>
        <button
          ref="primary"
          type="button"
          :class="confirmState.danger ? 'btn-primary bg-red-600 hover:bg-red-500 shadow-none' : 'btn-primary'"
          @click="settleConfirm(true)"
        >
          {{ confirmState.confirmLabel }}
        </button>
      </div>
    </template>
  </Modal>
</template>
