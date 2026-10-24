<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useSeasonStore } from '@/stores/season';

/** Temporada que se está viendo, siempre a la vista en la cabecera; desde aquí se cambia para toda la app. */
withDefaults(defineProps<{ compact?: boolean }>(), { compact: false });

const season = useSeasonStore();
const open = ref(false);
const root = ref<HTMLElement | null>(null);

function choose(id: string) {
  season.select(id);
  open.value = false;
}

function onDocumentClick(event: MouseEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('click', onDocumentClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocumentClick));
</script>

<template>
  <div v-if="season.selected" ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold"
      :class="season.isCurrent ? 'border-line text-slate-700 hover:border-brand-400/60' : 'border-amber-400/70 bg-amber-500/10 text-amber-700'"
      :aria-expanded="open"
      aria-haspopup="listbox"
      :title="season.isCurrent ? 'Temporada actual' : 'Temporada pasada: solo consulta'"
      @click="open = !open"
    >
      <Icon icon="calendar-check" class="h-3.5 w-3.5" />
      <span v-if="!compact" class="hidden text-xs font-medium text-slate-500 lg:inline">Temporada</span>
      <span class="tabular-nums">{{ season.selected.label }}</span>
      <Icon icon="chevron-down" class="h-3 w-3 transition-transform" :class="open ? 'rotate-180' : ''" />
    </button>

    <ul
      v-if="open"
      role="listbox"
      class="absolute right-0 z-30 mt-2 min-w-[12rem] overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-card"
    >
      <li
        v-for="item in season.seasons"
        :key="item.id"
        role="option"
        :aria-selected="item.id === season.selected?.id"
        class="flex cursor-pointer items-center justify-between gap-3 px-3 py-2 text-sm"
        :class="item.id === season.selected?.id ? 'bg-brand-500/15 text-slate-900' : 'text-slate-700 hover:bg-surface-2'"
        @click="choose(item.id)"
      >
        <span class="tabular-nums font-medium">{{ item.label }}</span>
        <span v-if="item.isCurrent" class="text-xs text-emerald-600">Actual</span>
        <span v-else class="text-xs text-slate-400">Consulta</span>
      </li>
    </ul>
  </div>
</template>
