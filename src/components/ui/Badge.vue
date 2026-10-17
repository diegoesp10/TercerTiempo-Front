<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'green' | 'amber' | 'red' | 'blue' | 'slate' }>(), { tone: 'slate' });

const tones = {
  green: 'bg-emerald-100 text-emerald-800',
  amber: 'bg-amber-100 text-amber-800',
  red: 'bg-red-100 text-red-800',
  blue: 'bg-sky-100 text-sky-800',
  slate: 'bg-slate-100 text-slate-700',
};
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" :class="tones[tone]">
    <slot />
  </span>
</template>
