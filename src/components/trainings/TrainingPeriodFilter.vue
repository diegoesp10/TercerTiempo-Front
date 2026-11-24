<script setup lang="ts">
import { computed } from 'vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';
import { toDateKey } from '@/utils/format';

// Periodo para contar entrenamientos: toda la temporada (sin fechas), atajos habituales o dos fechas a mano.
const from = defineModel<string | null>('from', { default: null });
const to = defineModel<string | null>('to', { default: null });
const props = defineProps<{ min?: string | null; max?: string | null; allLabel?: string }>();

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return toDateKey(date);
}

const presets = computed(() => {
  const today = new Date();
  return [
    { key: 'all', label: props.allLabel ?? 'Toda la temporada', from: null, to: null },
    { key: 'month', label: 'Este mes', from: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: toDateKey(today) },
    { key: '30', label: 'Últimos 30 días', from: daysAgo(29), to: toDateKey(today) },
    { key: '7', label: 'Última semana', from: daysAgo(6), to: toDateKey(today) },
  ];
});

const presetOptions = computed(() => presets.value.map((p) => ({ value: p.key, label: p.label })));
const active = computed(() => presets.value.find((p) => p.from === from.value && p.to === to.value)?.key ?? null);

function pickKey(key: string) {
  const preset = presets.value.find((p) => p.key === key);
  if (!preset) return;
  from.value = preset.from;
  to.value = preset.to;
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-xs">
    <slot />
    <ChoiceToggle :model-value="active" :options="presetOptions" label="Periodo" size="xs" tone="brand" @update:model-value="pickKey" />
    <label class="flex items-center gap-1 text-slate-500">
      Del
      <input :value="from ?? ''" type="date" class="input px-2 py-1 text-xs" :min="min ?? undefined" :max="to ?? max ?? undefined" aria-label="Desde" @change="from = ($event.target as HTMLInputElement).value || null" />
    </label>
    <label class="flex items-center gap-1 text-slate-500">
      al
      <input :value="to ?? ''" type="date" class="input px-2 py-1 text-xs" :min="from ?? min ?? undefined" :max="max ?? undefined" aria-label="Hasta" @change="to = ($event.target as HTMLInputElement).value || null" />
    </label>
  </div>
</template>
