<script setup lang="ts">
import { computed } from 'vue';
import { passwordChecks } from '@/utils/password';

/** Requisitos de la contraseña que se está escribiendo, en verde los que ya cumple. */
const props = defineProps<{ password: string; email?: string | null }>();
const checks = computed(() => passwordChecks(props.password, props.email));
</script>

<template>
  <ul class="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2" aria-label="Requisitos de la contraseña">
    <li v-for="check in checks" :key="check.label" class="flex items-center gap-1.5" :class="check.ok ? 'text-emerald-600' : 'text-slate-500'">
      <Icon :icon="check.ok ? 'circle-check' : 'circle-xmark'" class="h-3.5 w-3.5 shrink-0" :class="check.ok ? '' : 'opacity-50'" />
      <span>{{ check.label }}</span>
      <span class="sr-only">{{ check.ok ? '(cumplido)' : '(pendiente)' }}</span>
    </li>
  </ul>
</template>
