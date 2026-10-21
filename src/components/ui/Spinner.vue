<script setup lang="ts">
import BallLoader from '@/components/ui/BallLoader.vue';

defineProps<{ label?: string }>();
</script>

<template>
  <div class="flex items-center gap-4 py-8 text-sm text-slate-500" role="status">
    <BallLoader :size="34" />
    <span class="font-medium tracking-wide">{{ label ?? 'Cargando…' }}</span>
  </div>
</template>
