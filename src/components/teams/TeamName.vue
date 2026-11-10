<script setup lang="ts">
import { computed } from 'vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { crestFor } from '@/utils/crests';

/**
 * Nombre de un equipo siempre con su escudo al lado. Si el dato no trae la URL del escudo pero sí el id del equipo, se
 * pide a la API por el id; sin escudo, la insignia muestra las iniciales.
 */
const props = withDefaults(
  defineProps<{
    name: string;
    teamId?: string | null;
    crestUrl?: string | null;
    shortName?: string | null;
    size?: 'xs' | 'sm' | 'md';
    /** Texto delante del nombre (p. ej. "vs"). */
    prefix?: string;
  }>(),
  { teamId: null, crestUrl: null, shortName: null, size: 'xs', prefix: '' },
);

const src = computed(() => crestFor(props.crestUrl, props.teamId));
</script>

<template>
  <span class="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle">
    <span v-if="prefix" class="shrink-0">{{ prefix }}</span>
    <TeamCrest :src="src" :name="name" :short-name="shortName" :size="size" />
    <span class="truncate"><slot>{{ name }}</slot></span>
  </span>
</template>
