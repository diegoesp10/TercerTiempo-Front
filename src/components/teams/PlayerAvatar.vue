<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { apiBaseUrl } from '@/api/http';

// Foto del jugador servida por la API; sin foto (o si falla) se muestran sus iniciales.
const props = withDefaults(defineProps<{ src: string | null | undefined; name: string; size?: 'sm' | 'md' | 'lg' | 'xl' }>(), { size: 'md' });

const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });

const url = computed(() => {
  if (!props.src || failed.value) return null;
  return props.src.startsWith('/') ? `${apiBaseUrl}${props.src}` : props.src;
});

const initials = computed(() => {
  const words = props.name.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?';
});

const sizeClasses: Record<NonNullable<typeof props.size>, string> = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-16 w-16 text-base',
  xl: 'h-28 w-28 text-2xl',
};
</script>

<template>
  <span class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 ring-1 ring-line" :class="sizeClasses[size]" :title="name">
    <img v-if="url" :src="url" :alt="name" class="h-full w-full object-cover" loading="lazy" @error="failed = true" />
    <span v-else class="font-display font-bold tracking-wide text-slate-500" aria-hidden="true">{{ initials }}</span>
  </span>
</template>
