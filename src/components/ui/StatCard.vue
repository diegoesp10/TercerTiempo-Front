<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  accent?: boolean;
}>();
</script>

<template>
  <!-- Cifra con etiqueta: borde superior de color cuando es la que importa, sin rellenos de color. -->
  <div class="relative rounded-xl border border-line bg-surface px-4 pb-4 pt-3.5 shadow-card">
    <span v-if="accent" class="absolute inset-x-4 top-0 h-0.5 rounded-b bg-brand-500" aria-hidden="true" />
    <p class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{{ label }}</p>
    <p class="mt-1.5 font-figures text-[2.1rem] font-extrabold leading-none tabular-nums text-slate-900">{{ value ?? '—' }}</p>
    <p v-if="hint" class="mt-1.5 text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
