<script setup lang="ts">
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';

/** Nombre de un jugador siempre con su foto al lado (o sus iniciales si no tiene). */
withDefaults(defineProps<{ name: string; photoUrl?: string | null; size?: 'xs' | 'sm' | 'md' }>(), { photoUrl: null, size: 'xs' });
</script>

<template>
  <span class="inline-flex min-w-0 max-w-full items-center gap-2 align-middle">
    <PlayerAvatar :src="photoUrl" :name="name" :size="size" />
    <span class="truncate"><slot>{{ name }}</slot></span>
  </span>
</template>
