<script setup lang="ts">
import { formatNumber } from '@/utils/format';

defineProps<{ label: string; value: number | null }>();
</script>

<template>
  <div>
    <div class="mb-1 flex items-center justify-between text-sm">
      <span class="text-slate-700">{{ label }}</span>
      <span class="font-medium text-slate-900">{{ value === null ? '—' : `P${formatNumber(value, 0)}` }}</span>
    </div>
    <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200">
      <div class="h-full rounded-full bg-emerald-500 transition-all" :style="{ width: `${value ?? 0}%` }" />
    </div>
  </div>
</template>
