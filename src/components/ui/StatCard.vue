<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  accent?: boolean;
}>();
</script>

<template>
  <div
    class="relative overflow-hidden rounded-2xl border p-4 shadow-card"
    :class="accent ? 'border-brand-400/40 bg-gradient-to-br from-brand-600/40 to-navy-900' : 'border-white/8 bg-surface/80'"
  >
    <span v-if="accent" class="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-accent-400/30 blur-2xl" />
    <p class="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{{ label }}</p>
    <p class="mt-1 font-display text-3xl font-bold tabular-nums text-white">{{ value ?? '—' }}</p>
    <p v-if="hint" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
