<script setup lang="ts">
// Esqueleto de carga con la forma de lo que va a llegar: tarjetas de equipo, filas de una tabla o una lista de
// partidos. Ocupa el mismo sitio que el contenido, así la página no salta cuando llegan los datos.
withDefaults(defineProps<{ variant?: 'cards' | 'table' | 'list'; count?: number; label?: string }>(), {
  variant: 'list',
  count: 6,
  label: 'Cargando…',
});
</script>

<template>
  <div role="status" :aria-label="label" aria-busy="true">
    <div v-if="variant === 'cards'" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="n in count" :key="n" class="card flex items-center gap-4">
        <span class="skeleton h-14 w-14 shrink-0 rounded-full" />
        <span class="flex-1 space-y-2">
          <span class="skeleton block h-4" :style="{ width: `${60 + ((n * 13) % 30)}%` }" />
          <span class="skeleton block h-3 w-2/5" />
        </span>
      </div>
    </div>

    <div v-else-if="variant === 'table'" class="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div class="h-9 bg-slate-50" />
      <div v-for="n in count" :key="n" class="flex items-center gap-3 border-t border-line px-3 py-2.5">
        <span class="skeleton h-3 w-5" />
        <span class="skeleton h-5 w-5 rounded-full" />
        <span class="skeleton h-3.5" :style="{ width: `${30 + ((n * 17) % 25)}%` }" />
        <span class="ml-auto flex gap-4">
          <span v-for="c in 4" :key="c" class="skeleton h-3 w-5" />
        </span>
      </div>
    </div>

    <div v-else class="space-y-2">
      <div v-for="n in count" :key="n" class="flex items-center gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <span class="skeleton h-3 w-10" />
        <span class="skeleton h-3.5 flex-1" :style="{ maxWidth: `${40 + ((n * 11) % 35)}%` }" />
        <span class="skeleton ml-auto h-5 w-12" />
      </div>
    </div>
    <span class="sr-only">{{ label }}</span>
  </div>
</template>
