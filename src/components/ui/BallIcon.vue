<script setup lang="ts">
withDefaults(defineProps<{ title?: string; ownGoal?: boolean }>(), { title: 'Gol', ownGoal: false });
</script>

<template>
  <!-- Balón de Font Awesome; en propia puerta se tiñe de rojo. -->
  <Icon icon="futbol" class="inline-block h-4 w-4 align-[-3px]" :class="ownGoal ? 'text-red-500' : 'text-slate-900'" :title="title" :aria-label="title" role="img" />
</template>
