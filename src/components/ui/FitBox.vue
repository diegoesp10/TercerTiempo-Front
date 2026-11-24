<script setup lang="ts">
import { ref } from 'vue';
import { useFit } from '@/composables/useFit';

/**
 * Caja que prueba sus formas en orden (cada una, un juego de marcas data-*) y se queda la primera con la que nada se sale
 * de su ancho, como los menús. Lo de dentro decide qué cambia en cada forma con group-data-[…]: pásale la clase
 * `group/<nombre>`. Sirve para lo que se pinta cuando ya hay datos, porque mide al montarse.
 */
const props = defineProps<{ steps: readonly (readonly string[])[] }>();
const root = ref<HTMLElement | null>(null);
const { step } = useFit(root, props.steps);
</script>

<template>
  <div ref="root"><slot :step="step" /></div>
</template>
