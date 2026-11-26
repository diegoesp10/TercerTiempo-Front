<script setup lang="ts" generic="T extends string">
import { computed, ref } from 'vue';
import { useFit } from '@/composables/useFit';
import type { ChoiceOption } from '@/components/ui/choice';

// Elegir una entre pocas opciones (un ajuste, un filtro, el estado de una fila): en fila si caben todas enteras; si no,
// en una rejilla de casillas iguales que pasan su nombre a la línea siguiente. Nunca se sale ni corta con «…», y todas
// las opciones siguen a un toque (las pestañas, en cambio, se pliegan en un menú).
const props = withDefaults(
  defineProps<{
    options: readonly ChoiceOption<T>[];
    modelValue: T | null;
    label: string;
    look?: 'box' | 'pill';
    size?: 'sm' | 'xs';
    tone?: 'action' | 'brand';
    disabled?: boolean;
    busy?: boolean;
    /** Ancho mínimo de cada casilla en rejilla; más ancho cuando algún nombre lleva una palabra larga («Recuperaciones»), para no partirla. */
    minItem?: string;
  }>(),
  { look: 'box', size: 'sm', tone: 'action', disabled: false, busy: false, minItem: '5rem' },
);
const emit = defineEmits<{ 'update:modelValue': [value: T] }>();

const root = ref<HTMLElement | null>(null);
useFit(root, [['row'], []]);

const pill = computed(() => props.look === 'pill');
const itemClass = computed(() => {
  // En rejilla, menos relleno lateral: la casilla es estrecha y el reclamo tiene que caber en una línea.
  if (pill.value) return 'rounded-xl px-2 py-1.5 text-sm font-semibold group-data-[row]/choice:rounded-full group-data-[row]/choice:px-4';
  return props.size === 'xs' ? 'rounded-md px-2.5 py-1 text-xs font-medium' : 'rounded-md px-3 py-1 text-sm font-medium';
});
const onClass = computed(() => {
  if (props.tone === 'brand') return 'bg-action text-white';
  return pill.value ? 'bg-action text-white shadow-sm' : 'bg-action text-white shadow-glow';
});
const offClass = computed(() => (pill.value ? 'text-slate-600 hover:text-slate-900' : 'text-slate-600 hover:bg-surface-2 hover:text-slate-900'));

function choose(value: T) {
  if (value !== props.modelValue) emit('update:modelValue', value);
}
</script>

<template>
  <div
    ref="root"
    class="group/choice grid w-full min-w-0 max-w-full grid-cols-[repeat(auto-fit,minmax(min(100%,var(--choice-min)),1fr))] gap-0.5 border border-line data-[row]:inline-flex data-[row]:w-auto"
    :class="pill ? 'rounded-2xl bg-surface-2 p-1 data-[row]:rounded-full' : 'rounded-lg p-0.5'"
    :style="{ '--choice-min': minItem }"
    role="radiogroup"
    :aria-label="label"
  >
    <button
      v-for="option in options"
      :key="option.value"
      v-busy="busy"
      type="button"
      role="radio"
      :aria-checked="option.value === modelValue"
      :disabled="disabled || option.disabled"
      :title="option.title"
      class="flex cursor-pointer flex-wrap items-center justify-center gap-x-2 gap-y-1 break-words text-center leading-snug transition disabled:cursor-not-allowed group-data-[row]/choice:shrink-0 group-data-[row]/choice:flex-nowrap group-data-[row]/choice:whitespace-nowrap"
      :class="[itemClass, option.value === modelValue ? onClass : offClass, option.disabled ? 'opacity-50' : '']"
      @click="choose(option.value)"
    >
      <!-- En rejilla el icono va encima del nombre: al lado, la casilla estrecha partiría la palabra. -->
      <span v-if="option.icon" class="flex min-w-0 flex-col items-center gap-1 group-data-[row]/choice:flex-row group-data-[row]/choice:gap-1.5">
        <Icon :icon="option.icon" class="h-3.5 w-3.5 shrink-0" />
        <span class="min-w-0">{{ option.label }}</span>
      </span>
      <span v-else class="min-w-0">{{ option.label }}</span>
      <span v-if="option.count !== undefined" class="tabular-nums opacity-70">{{ option.count }}</span>
      <span
        v-if="option.badge"
        class="rounded-full px-2 py-0.5 text-2xs font-bold"
        :class="option.value === modelValue ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-700'"
      >{{ option.badge }}</span>
    </button>
  </div>
</template>
