<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <div class="mb-8 flex flex-wrap items-end justify-between gap-4">
    <div class="min-w-0">
      <h1 class="break-words text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1.5 max-w-2xl text-sm text-slate-500">{{ subtitle }}</p>
    </div>
    <div class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:max-w-full">
      <slot name="actions" />
    </div>
  </div>
</template>
