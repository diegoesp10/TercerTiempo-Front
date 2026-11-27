<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { closeLayer, isTopLayer, layerZIndex, openLayer } from '@/composables/useModalStack';

const props = withDefaults(defineProps<{ open: boolean; title: string; size?: 'md' | 'lg' | 'xl' }>(), { size: 'lg' });
const emit = defineEmits<{ close: [] }>();

const widths = { md: 'max-w-lg', lg: 'max-w-3xl', xl: 'max-w-5xl' };

// Un modal abierto desde otro (la confirmación de borrar, por ejemplo) queda siempre encima del que lo abrió.
const layer = ref<number | null>(null);
const zIndex = computed(() => layerZIndex(layer.value));

function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open && isTopLayer(layer.value)) emit('close');
}

watch(
  () => props.open,
  (open) => {
    if (open && layer.value === null) layer.value = openLayer();
    else if (!open && layer.value !== null) {
      closeLayer(layer.value);
      layer.value = null;
    }
  },
  { immediate: true },
);

onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  closeLayer(layer.value);
  layer.value = null;
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="fixed inset-0 flex items-end justify-center bg-scrim/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" :style="{ zIndex }" @click.self="emit('close')">
        <div
          class="flex max-h-[95vh] w-full flex-col rounded-t-2xl border border-line bg-surface shadow-card sm:max-h-[90vh] sm:rounded-2xl"
          :class="widths[size]"
          role="dialog"
          aria-modal="true"
          :aria-label="title"
        >
          <div class="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
            <slot name="header">
              <h2 class="text-lg font-bold text-slate-900">{{ title }}</h2>
            </slot>
            <button type="button" class="btn-ghost -mr-2 -mt-1 px-2 py-1" aria-label="Cerrar" @click="emit('close')">
              <Icon icon="xmark" class="h-4 w-4" />
            </button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto px-5 py-4">
            <slot />
          </div>
          <div v-if="$slots.footer" class="border-t border-line px-5 py-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.18s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
