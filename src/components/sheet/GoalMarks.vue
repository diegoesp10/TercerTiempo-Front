<script setup lang="ts">
import BallIcon from '@/components/ui/BallIcon.vue';

const props = withDefaults(defineProps<{ goals: number; penaltyGoals?: number; ownGoals?: number }>(), { penaltyGoals: 0, ownGoals: 0 });

const balls = () => [
  ...Array.from({ length: props.goals }, () => ({ title: 'Gol', own: false })),
  ...Array.from({ length: props.penaltyGoals }, () => ({ title: 'Gol de penalti', own: false })),
  ...Array.from({ length: props.ownGoals }, () => ({ title: 'Gol en propia puerta', own: true })),
];
</script>

<template>
  <span v-if="goals + penaltyGoals + ownGoals > 0" class="inline-flex items-center justify-center gap-0.5 whitespace-nowrap">
    <BallIcon v-for="(ball, index) in balls()" :key="index" :title="ball.title" :own-goal="ball.own" />
  </span>
</template>
