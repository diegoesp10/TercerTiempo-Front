<script setup lang="ts">
/** Número de licencias de técnico con botones de restar y sumar (y escribiendo la cifra). */
const props = withDefaults(defineProps<{ min?: number; max: number; disabled?: boolean; label?: string }>(), { min: 0, disabled: false, label: 'Técnicos' });
const seats = defineModel<number>({ required: true });

const clamp = (value: number) => Math.min(props.max, Math.max(props.min, Number.isFinite(value) ? Math.round(value) : props.min));
</script>

<template>
  <div class="inline-flex items-center rounded-xl border border-line bg-surface" role="group" :aria-label="label">
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-l-xl text-slate-600 transition hover:bg-surface-2 disabled:opacity-40"
      :disabled="disabled || seats <= min"
      :aria-label="`Quitar un técnico (${label})`"
      @click="seats = clamp(seats - 1)"
    >
      <Icon icon="minus" class="h-3 w-3" />
    </button>
    <input
      :value="seats"
      type="number"
      inputmode="numeric"
      :min="min"
      :max="max"
      class="h-9 w-14 border-x border-line bg-transparent text-center font-figures font-semibold text-slate-900 outline-none"
      :disabled="disabled"
      :aria-label="label"
      @change="seats = clamp(Number(($event.target as HTMLInputElement).value))"
    />
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-r-xl text-slate-600 transition hover:bg-surface-2 disabled:opacity-40"
      :disabled="disabled || seats >= max"
      :aria-label="`Añadir un técnico (${label})`"
      @click="seats = clamp(seats + 1)"
    >
      <Icon icon="plus" class="h-3 w-3" />
    </button>
  </div>
</template>
