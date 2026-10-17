<script setup lang="ts">
withDefaults(defineProps<{ kind?: 'error' | 'info' | 'success' | 'warning' }>(), { kind: 'info' });

const styles = {
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-sky-200 bg-sky-50 text-sky-800',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
};
</script>

<template>
  <div class="rounded-lg border px-4 py-3 text-sm" :class="styles[kind]" role="alert">
    <slot />
  </div>
</template>
