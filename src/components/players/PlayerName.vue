<script setup lang="ts">
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';

/**
 * Nombre de un jugador siempre con su foto al lado (o sus iniciales si no tiene). Si no cabe, baja de línea (nunca «…»);
 * `truncate` solo para huecos de alto fijo.
 */
withDefaults(defineProps<{ name: string; photoUrl?: string | null; size?: 'xs' | 'sm' | 'md'; truncate?: boolean }>(), { photoUrl: null, size: 'xs', truncate: false });
</script>

<template>
  <span class="inline-flex min-w-0 max-w-full items-center gap-2 align-middle">
    <PlayerAvatar :src="photoUrl" :name="name" :size="size" class="shrink-0" />
    <span :class="truncate ? 'truncate' : 'min-w-0 break-words leading-snug'"><slot>{{ name }}</slot></span>
  </span>
</template>
