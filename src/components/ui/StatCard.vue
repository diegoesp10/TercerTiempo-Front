<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number | null | undefined;
  hint?: string;
  accent?: boolean;
}>();
</script>

<template>
  <div class="rounded-xl border p-4 shadow-sm" :class="accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'">
    <p class="text-xs font-medium uppercase tracking-wide text-slate-500">{{ label }}</p>
    <p class="mt-1 text-2xl font-semibold text-slate-900">{{ value ?? '—' }}</p>
    <p v-if="hint" class="mt-1 text-xs text-slate-500">{{ hint }}</p>
  </div>
</template>
