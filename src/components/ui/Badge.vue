<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'green' | 'amber' | 'red' | 'blue' | 'slate' }>(), { tone: 'slate' });

const tones = {
  green: 'border-emerald-300/40 bg-emerald-100 text-emerald-700',
  amber: 'border-amber-400/40 bg-amber-100 text-amber-800',
  red: 'border-red-600/40 bg-red-100 text-red-800',
  blue: 'border-brand-400/40 bg-sky-100 text-sky-800',
  slate: 'border-white/10 bg-slate-100 text-slate-700',
};
</script>

<template>
  <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide" :class="tones[tone]">
    <slot />
  </span>
</template>
