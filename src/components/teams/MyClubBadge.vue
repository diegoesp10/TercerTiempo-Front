<script setup lang="ts">
import { MY_CLUB_GROUP } from '@/composables/useMyClub';
</script>

<template>
  <!-- Distingue a tu club en clasificaciones, jornadas y listados de equipos. -->
  <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-400/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent-400">
    <Icon icon="star" class="h-2.5 w-2.5" />{{ MY_CLUB_GROUP }}
  </span>
</template>
