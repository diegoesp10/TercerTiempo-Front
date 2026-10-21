<script setup lang="ts">
import BrandMark from '@/components/layout/BrandMark.vue';

defineProps<{ label?: string }>();
</script>

<template>
  <!-- Indicador de carga: el logotipo con el anillo girando y la cruz latiendo. -->
  <div class="flex items-center gap-4 py-8 text-sm text-slate-500" role="status">
    <BrandMark :size="36" animated />
    <span class="font-medium tracking-wide">{{ label ?? 'Cargando…' }}</span>
  </div>
</template>
