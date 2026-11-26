<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue';
import { useAuthImage } from '@/composables/useAuthImage';

// Foto del jugador servida por la API (con la sesión: son de menores); sin foto, sin permiso o si falla, sus iniciales.
// `decorative`: va dentro de un enlace que ya dice quién es (la cabecera), así que no lleva título ni texto alternativo.
const props = withDefaults(
  defineProps<{ src: string | null | undefined; name: string; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; decorative?: boolean }>(),
  { size: 'md', decorative: false },
);

const failed = ref(false);
watch(() => props.src, () => { failed.value = false; });

const box = ref<HTMLElement | null>(null);
const loaded = useAuthImage(toRef(props, 'src'), box);
const url = computed(() => (failed.value ? null : loaded.value));

const initials = computed(() => {
  const words = props.name.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || '?';
});

const sizeClasses: Record<NonNullable<typeof props.size>, string> = {
  xs: 'h-6 w-6 text-[9px]',
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-16 w-16 text-base',
  xl: 'h-28 w-28 text-2xl',
};
</script>

<template>
  <span ref="box" class="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-2 ring-1 ring-line" :class="sizeClasses[size]" :title="decorative ? undefined : name">
    <img v-if="url" :src="url" :alt="decorative ? '' : name" class="h-full w-full object-cover" loading="lazy" @error="failed = true" />
    <span v-else class="font-display font-bold tracking-wide text-slate-500" aria-hidden="true">{{ initials }}</span>
  </span>
</template>
