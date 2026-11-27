<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import { formatDurationMinutes } from '@/utils/format';
import AttendanceBar from './AttendanceBar.vue';
import AttendanceGroupRow from './AttendanceGroupRow.vue';
import AttendanceMisses from './AttendanceMisses.vue';
import { missesFor, rateText, type AttendanceGroup, type AttendanceRow, type MissFilter, type SortApi } from './attendance';

// Vista resumida: lo más destacado de la plantilla y una barra por jugador (vino, avisó, faltó, lesionado). Filtrando
// por faltas, debajo de cada uno sus faltas con el motivo.
const props = defineProps<{ groups: AttendanceGroup[]; all: AttendanceRow[]; sort: SortApi; filter: MissFilter }>();
defineEmits<{ pick: [row: AttendanceRow]; toggle: [key: string] }>();

const active = computed(() => props.all.filter((r) => r.player.active && r.player.sessions > 0));
const top = (list: AttendanceRow[], value: (r: AttendanceRow) => number) =>
  [...list].filter((r) => value(r) > 0).sort((a, b) => value(b) - value(a) || a.name.localeCompare(b.name, 'es')).slice(0, 3);

const highlights = computed(() => [
  {
    key: 'perfect',
    icon: 'circle-check',
    tone: 'text-success',
    title: 'Siempre vienen',
    empty: 'Nadie ha venido a todos.',
    items: active.value.filter((r) => r.player.attendanceRate === 100).map((r) => ({ row: r, value: `${r.player.attended}/${r.player.sessions}` })),
  },
  {
    key: 'missed',
    icon: 'triangle-exclamation',
    tone: 'text-danger',
    title: 'Más faltas',
    empty: 'Nadie ha faltado.',
    items: top(active.value, (r) => r.player.missed).map((r) => ({ row: r, value: `${r.player.missed} ${r.player.missed === 1 ? 'falta' : 'faltas'}` })),
  },
]);
</script>

<template>
  <div>
    <div class="mb-4 grid gap-3 md:grid-cols-2">
      <article v-for="h in highlights" :key="h.key" class="rounded-xl border border-line bg-surface-2/60 p-3">
        <p class="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Icon :icon="h.icon" class="h-3.5 w-3.5" :class="h.tone" />{{ h.title }}</p>
        <p v-if="!h.items.length" class="text-xs text-slate-500">{{ h.empty }}</p>
        <ul v-else class="space-y-1">
          <li v-for="item in h.items.slice(0, 3)" :key="item.row.id" class="flex items-center justify-between gap-2 text-sm">
            <button type="button" class="min-w-0 break-words text-left text-slate-800 hover:text-brand-500" @click="$emit('pick', item.row)">{{ item.row.name }}</button>
            <span class="shrink-0 text-xs font-semibold tabular-nums text-slate-600">{{ item.value }}</span>
          </li>
          <li v-if="h.items.length > 3" class="text-xs text-slate-500">y {{ h.items.length - 3 }} más</li>
        </ul>
      </article>
    </div>

    <div class="-mx-4 overflow-x-auto sm:mx-0">
      <table class="table-sticky w-full min-w-[36rem] text-sm">
        <thead class="text-xs text-slate-500">
          <tr class="border-b border-line text-left">
            <SortHeader class="px-2 py-2 font-semibold" label="Jugador" v-bind="sort.state('name')" @sort="sort.by('name')" />
            <SortHeader class="w-1/2 px-2 py-2 font-semibold" icon="percent" label="Asistencia" title="% de asistencia: entrenamientos a los que vino de los que le tocaban" v-bind="sort.state('rate')" @sort="sort.by('rate')" />
            <SortHeader class="px-2 py-2 text-right font-semibold [&>button]:justify-end" icon="check" icon-class="text-success" label="Vino" title="Días que entrenó: a cuántos vino de los que le tocaban" v-bind="sort.state('attended')" @sort="sort.by('attended')" />
            <SortHeader class="col-sm px-2 py-2 text-right font-semibold [&>button]:justify-end" icon="stopwatch" label="Tiempo" title="Tiempo entrenado: la duración de cada entrenamiento al que vino" v-bind="sort.state('minutes')" @sort="sort.by('minutes')" />
          </tr>
        </thead>
        <tbody v-for="g in groups" :key="g.key" class="divide-y divide-line">
          <AttendanceGroupRow v-if="g.label" :group="g" :colspan="4" @toggle="$emit('toggle', g.key)" />
          <template v-for="r in g.open ? g.rows : []" :key="r.id">
            <tr :class="[r.player.active ? '' : 'opacity-60', filter !== 'all' ? 'border-b-0' : '']">
              <td class="px-2 py-2">
                <button type="button" class="flex min-w-0 items-center gap-2 text-left font-medium text-slate-800 hover:text-brand-500" :title="`Ver todo lo de ${r.name}`" @click="$emit('pick', r)">
                  <span class="min-w-0 break-words">{{ r.name }}</span>
                  <Badge v-if="!r.player.active" tone="slate" title="Causó baja en la plantilla: sale con lo que entrenó mientras estuvo">De baja</Badge>
                </button>
              </td>
              <td class="px-2 py-2">
                <div class="flex items-center gap-3">
                  <AttendanceBar :player="r.player" class="flex-1" />
                  <span class="w-12 shrink-0 text-right font-semibold tabular-nums" :class="rateText(r.player.attendanceRate)">
                    {{ r.player.attendanceRate === null ? '—' : `${r.player.attendanceRate} %` }}
                  </span>
                </div>
              </td>
              <td class="whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700">
                <strong class="text-slate-900">{{ r.player.attended }}</strong> de {{ r.player.sessions }}
              </td>
              <td class="col-sm whitespace-nowrap px-2 py-2 text-right tabular-nums text-slate-700">{{ formatDurationMinutes(r.player.attendedMinutes) }}</td>
            </tr>
            <tr v-if="filter !== 'all'" :class="r.player.active ? '' : 'opacity-60'">
              <td :colspan="4" class="px-2 pb-2.5 pt-0">
                <div class="sticky left-0 max-w-[calc(100vw-3rem)]">
                  <AttendanceMisses :misses="missesFor(r, filter)" @more="$emit('pick', r)" />
                </div>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>
