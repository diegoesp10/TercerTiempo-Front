<script setup lang="ts">
import { computed, ref } from 'vue';

/** Elegir una nota de 0 a 10 con cinco estrellas: la mitad izquierda de cada una es el impar y la derecha, el par. */
const props = defineProps<{ disabled?: boolean }>();
const model = defineModel<number | null>({ required: true });

const hover = ref<number | null>(null);
const shown = computed(() => hover.value ?? model.value ?? 0);

function fill(star: number) {
  const value = shown.value;
  if (star * 2 <= value) return '100%';
  if (star * 2 - 1 === value) return '50%';
  return '0%';
}

const valueOf = (star: number, half: number) => star * 2 - 2 + half;
</script>

<template>
  <div class="inline-flex flex-wrap items-center gap-3">
    <div class="inline-flex" role="radiogroup" aria-label="Nota de 0 a 10" @mouseleave="hover = null">
      <span v-for="star in 5" :key="star" class="relative h-7 w-7">
        <Icon icon="star" class="h-7 w-7 text-slate-400/30" aria-hidden="true" />
        <span class="absolute inset-y-0 left-0 overflow-hidden text-amber-400" :style="{ width: fill(star) }" aria-hidden="true">
          <Icon icon="star" class="h-7 w-7" />
        </span>
        <button
          v-for="half in 2"
          :key="half"
          type="button"
          role="radio"
          class="absolute inset-y-0 w-1/2 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent-400 disabled:cursor-not-allowed"
          :class="half === 1 ? 'left-0' : 'right-0'"
          :aria-label="`Nota ${valueOf(star, half)}`"
          :aria-checked="model === valueOf(star, half)"
          :disabled="props.disabled"
          @mouseenter="hover = valueOf(star, half)"
          @focus="hover = valueOf(star, half)"
          @blur="hover = null"
          @click="model = valueOf(star, half)"
        />
      </span>
    </div>
    <button
      type="button"
      class="rounded-md border px-2 py-0.5 text-xs font-semibold transition"
      :class="model === 0 ? 'border-red-400/60 bg-red-500/10 text-red-500' : 'border-line text-slate-500 hover:border-red-400/60'"
      :aria-pressed="model === 0"
      :disabled="props.disabled"
      title="Un cero"
      @click="model = 0"
    >0</button>
    <span class="font-figures text-lg font-extrabold text-slate-900">{{ hover ?? model ?? '–' }}<span class="text-sm font-medium text-slate-500">/10</span></span>
  </div>
</template>
