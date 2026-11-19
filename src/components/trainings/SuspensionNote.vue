<script setup lang="ts">
import Badge from '@/components/ui/Badge.vue';
import CardIcon from '@/components/ui/CardIcon.vue';
import type { SuspensionBriefDto } from '@/types/api';

/**
 * Por qué un jugador no puede jugar un partido de liga: «Sancionado» y el porqué («5.ª amarilla en la jornada 7»,
 * «Roja directa en la jornada 8»…) con la tarjeta que lo causó.
 */
withDefaults(defineProps<{ suspension: SuspensionBriefDto | null; badge?: boolean }>(), { badge: true });
</script>

<template>
  <span class="inline-flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs">
    <Badge v-if="badge" tone="red"><Icon icon="ban" class="mr-1 h-2.5 w-2.5" />Sancionado</Badge>
    <span v-if="suspension" class="inline-flex items-center gap-1 text-slate-600">
      <CardIcon :kind="suspension.cause === 'YellowCards' ? 'yellow' : 'red'" />{{ suspension.reason }}
    </span>
  </span>
</template>
