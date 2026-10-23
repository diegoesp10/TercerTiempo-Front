<script setup lang="ts">
import BrandMark from '@/components/layout/BrandMark.vue';
import { useSyncStore } from '@/stores/sync';
import { formatKickoff } from '@/utils/format';

/** Banda bajo la cabecera mientras la API sincroniza datos (al arrancar, cada día): liga en curso y progreso. */
const sync = useSyncStore();
</script>

<template>
  <Transition name="sync">
    <div v-if="sync.running" class="border-b border-sky-200 bg-sky-50" role="status" aria-live="polite">
      <div class="mx-auto flex w-full max-w-[1760px] items-center gap-4 px-4 py-2 sm:px-6 lg:px-10">
        <BrandMark :size="30" animated />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-slate-900">
            Actualizando partidos, resultados y plantillas<span v-if="sync.status?.current" class="text-slate-500"> · {{ sync.status.current }}</span>
          </p>
          <div class="mt-1 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-line">
            <div class="h-full rounded-full bg-brand-500 transition-[width] duration-700" :style="{ width: `${Math.max(4, sync.progress)}%` }"></div>
          </div>
        </div>
        <span v-if="sync.status && sync.status.total > 0" class="shrink-0 font-display text-sm font-bold text-brand-500">{{ sync.status.done }}/{{ sync.status.total }}</span>
      </div>
    </div>
    <div v-else-if="sync.justFinished" class="border-b border-emerald-200 bg-emerald-50" role="status">
      <div class="mx-auto flex w-full max-w-[1760px] items-center gap-3 px-4 py-2 text-sm text-slate-800 sm:px-6 lg:px-10">
        <Icon icon="check" class="h-3.5 w-3.5 text-emerald-600" />
        <span>Datos actualizados<span v-if="sync.status?.lastSummary">: {{ sync.status.lastSummary }}</span><span v-if="sync.status?.lastFinishedAt" class="text-slate-500"> · {{ formatKickoff(sync.status.lastFinishedAt) }}</span></span>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.sync-enter-active,
.sync-leave-active {
  transition: opacity 0.3s ease;
}
.sync-enter-from,
.sync-leave-to {
  opacity: 0;
}
</style>
