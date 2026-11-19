<script setup lang="ts">
import type { GroundDto } from '@/types/api';

/**
 * Un campo de la liga con su dirección y el enlace al mapa (al punto exacto si OpenStreetMap lo tiene; si no, a la
 * búsqueda por nombre). Si la cita es en un sitio escrito a mano, se enseña ese texto y también se puede buscar.
 */
const props = withDefaults(defineProps<{ ground?: GroundDto | null; place?: string | null; compact?: boolean; home?: boolean }>(), {
  ground: null,
  place: null,
  compact: false,
  home: false,
});

const placeMapsUrl = (text: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
const detail = () => props.ground?.address ?? props.ground?.locality ?? null;
</script>

<template>
  <div v-if="ground" class="flex min-w-0 items-start gap-2">
    <Icon icon="location-dot" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-500" />
    <div class="min-w-0 flex-1">
      <p class="font-medium text-slate-900" :class="compact ? 'text-sm' : ''">
        {{ ground.name }}
        <span v-if="home" class="ml-1 rounded bg-brand-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand-500">En casa</span>
      </p>
      <p v-if="detail()" class="text-xs text-slate-500">{{ detail() }}</p>
      <p v-else class="text-xs text-slate-400">Sin dirección exacta: el mapa lo busca por su nombre.</p>
      <p v-if="!compact && ground.homeTeams.length" class="text-xs text-slate-400">Campo de {{ ground.homeTeams.join(', ') }}</p>
      <a :href="ground.mapsUrl" target="_blank" rel="noopener noreferrer" class="mt-0.5 inline-flex items-center text-xs font-medium text-accent-400 hover:underline">
        <Icon icon="map" class="mr-1 h-3 w-3" />{{ ground.located ? 'Ver en el mapa' : 'Buscar en el mapa' }}
      </a>
    </div>
  </div>
  <div v-else-if="place" class="flex min-w-0 items-start gap-2">
    <Icon icon="location-dot" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
    <div class="min-w-0 flex-1">
      <p class="font-medium text-slate-900" :class="compact ? 'text-sm' : ''">{{ place }}</p>
      <p class="text-xs text-slate-500">Sitio alternativo (no es uno de los campos de la liga)</p>
      <a :href="placeMapsUrl(place)" target="_blank" rel="noopener noreferrer" class="mt-0.5 inline-flex items-center text-xs font-medium text-accent-400 hover:underline">
        <Icon icon="map" class="mr-1 h-3 w-3" />Buscar en el mapa
      </a>
    </div>
  </div>
</template>
