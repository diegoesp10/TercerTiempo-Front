<script setup lang="ts">
import CardIcon from '@/components/ui/CardIcon.vue';

const props = defineProps<{ yellowCards: number; redCard: boolean }>();

// Dos amarillas ya son la expulsión: la roja solo se dibuja cuando fue directa.
const directRed = () => props.redCard && props.yellowCards < 2;
</script>

<template>
  <span v-if="yellowCards > 0 || redCard" class="inline-flex items-center justify-center gap-0.5">
    <CardIcon v-for="index in yellowCards" :key="index" kind="yellow" :title="yellowCards === 2 && index === 2 ? 'Segunda amarilla' : 'Tarjeta amarilla'" />
    <CardIcon v-if="directRed()" kind="red" title="Tarjeta roja" />
  </span>
</template>
