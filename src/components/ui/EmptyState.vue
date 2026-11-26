<script setup lang="ts">
// Lo que se enseña cuando no hay nada que enseñar, igual en toda la app: un recuadro discontinuo con un icono, un título,
// la explicación y, si hay algo que hacer, sus botones. compact: solo la explicación (una lista filtrada sin nadie, una
// tabla vacía). titleTag: h2/h3 cuando el vacío ocupa el sitio de una sección con su encabezado.
withDefaults(defineProps<{ icon?: string; title?: string; titleTag?: 'p' | 'h2' | 'h3'; compact?: boolean }>(), {
  icon: undefined,
  title: undefined,
  titleTag: 'p',
  compact: false,
});
</script>

<template>
  <div v-if="compact" class="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-slate-500">
    <Icon v-if="icon" :icon="icon" class="mx-auto mb-2 block h-5 w-5" />
    <slot />
  </div>
  <div v-else class="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-line px-6 py-10 text-center">
    <span v-if="icon" class="mb-1 grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-slate-500"><Icon :icon="icon" class="h-5 w-5" /></span>
    <component :is="titleTag" v-if="title" class="font-semibold text-slate-900">{{ title }}</component>
    <div class="max-w-md text-sm text-slate-600"><slot /></div>
    <div v-if="$slots.actions" class="mt-2 flex flex-wrap justify-center gap-2"><slot name="actions" /></div>
  </div>
</template>
