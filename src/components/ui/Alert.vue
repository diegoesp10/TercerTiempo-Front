<script setup lang="ts">
withDefaults(defineProps<{ kind?: 'error' | 'info' | 'success' | 'warning' }>(), { kind: 'info' });

const styles = {
  error: 'border-danger-line bg-danger-soft text-danger-strong',
  info: 'border-info-line bg-info-soft text-info-strong',
  success: 'border-success-line bg-success-soft text-success-strong',
  warning: 'border-warning-line bg-warning-soft text-warning-strong',
};
</script>

<template>
  <div class="rounded-lg border px-4 py-3 text-sm leading-relaxed" :class="styles[kind]" role="alert">
    <slot />
  </div>
</template>
