<script setup lang="ts">
import { MY_CLUB_GROUP } from '@/composables/useMyClub';

/** `compact`: en el móvil solo la estrella (tablas estrechas); la palabra queda para los lectores de pantalla. */
defineProps<{ compact?: boolean }>();
</script>

<template>
  <!-- Distingue a tu club en clasificaciones, jornadas y listados de equipos. -->
  <span
    class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-accent-400/15 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide text-accent-400"
    :class="compact ? 'max-sm:px-1.5' : ''"
    :title="compact ? MY_CLUB_GROUP : undefined"
  >
    <Icon icon="star" class="h-2.5 w-2.5" /><span :class="compact ? 'max-sm:sr-only' : ''">{{ MY_CLUB_GROUP }}</span>
  </span>
</template>
