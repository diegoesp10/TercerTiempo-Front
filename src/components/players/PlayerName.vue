<script setup lang="ts">
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';

/**
 * Nombre de un jugador siempre con su foto al lado (o sus iniciales si no tiene). Por defecto se recorta con «…» si no
 * cabe; con wrap parte línea (para listas estrechas en el móvil con nombres largos, como los de las actas oficiales).
 */
withDefaults(defineProps<{ name: string; photoUrl?: string | null; size?: 'xs' | 'sm' | 'md'; wrap?: boolean }>(), { photoUrl: null, size: 'xs', wrap: false });
</script>

<template>
  <span class="inline-flex min-w-0 max-w-full items-center gap-2 align-middle">
    <PlayerAvatar :src="photoUrl" :name="name" :size="size" class="shrink-0" />
    <span :class="wrap ? 'min-w-0 break-words leading-snug' : 'truncate'"><slot>{{ name }}</slot></span>
  </span>
</template>
