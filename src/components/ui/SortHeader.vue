<script setup lang="ts">
import { computed } from 'vue';

/**
 * Cabecera de columna que ordena la tabla al pulsarla (con `useSort`). La flecha dice por cuál y en qué sentido.
 * Con `icon`, la cabecera es icono + palabra corta y el significado completo va en `title` (al pasar el ratón).
 */
const props = defineProps<{ label: string; title?: string; icon?: string; iconClass?: string; active: boolean; desc: boolean }>();
defineEmits<{ sort: [] }>();

const ariaSort = computed(() => (props.active ? (props.desc ? 'descending' : 'ascending') : 'none'));
const hint = computed(() => `${props.title ?? props.label}: ${props.active ? (props.desc ? 'de mayor a menor; pulsa para darle la vuelta' : 'de menor a mayor; pulsa para darle la vuelta') : 'pulsa para ordenar'}`);
</script>

<template>
  <th scope="col" :aria-sort="ariaSort">
    <!-- La letra de la cabecera es pequeña: un borde invisible alrededor del botón lo deja en unos 28 px de alto para el
         dedo, sin cambiar la fila (no llega a la primera fila de la tabla). -->
    <button
      type="button"
      class="relative inline-flex items-center gap-1 whitespace-nowrap uppercase tracking-wide transition after:absolute after:-inset-x-1 after:-inset-y-1.5 after:content-[''] hover:text-slate-800"
      :class="active ? 'text-brand-500' : ''"
      :title="hint"
      @click="$emit('sort')"
    >
      <Icon v-if="icon" :icon="icon" class="h-3 w-3 shrink-0" :class="iconClass" aria-hidden="true" />
      {{ label }}
      <Icon :icon="active ? (desc ? 'sort-down' : 'sort-up') : 'sort'" class="h-2.5 w-2.5" :class="active ? '' : 'opacity-40'" aria-hidden="true" />
    </button>
  </th>
</template>
