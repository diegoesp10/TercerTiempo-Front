<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  accent?: boolean;
}>();
</script>

<template>
  <div class="rounded-xl border p-4 shadow-card" :class="accent ? 'border-brand-400/50 bg-brand-500/10' : 'border-line bg-surface'">
    <p class="font-display text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{{ label }}</p>
    <p class="mt-1 font-display text-4xl font-bold tabular-nums text-slate-900">{{ value ?? '—' }}</p>
    <p v-if="hint" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
