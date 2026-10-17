<script setup lang="ts">
defineProps<{ label?: string }>();
</script>

<template>
  <div class="flex items-center gap-3 py-8 text-sm text-slate-500">
    <span class="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" aria-hidden="true" />
    <span>{{ label ?? 'Cargando…' }}</span>
  </div>
</template>
