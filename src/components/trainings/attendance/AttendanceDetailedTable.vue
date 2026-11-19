<script setup lang="ts">
import InjuryNote from '@/components/trainings/InjuryNote.vue';
import Badge from '@/components/ui/Badge.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import PlayerName from '@/components/players/PlayerName.vue';
import { formatDurationMinutes } from '@/utils/format';
import AttendanceGroupRow from './AttendanceGroupRow.vue';
import AttendanceMisses from './AttendanceMisses.vue';
import { dayShort, missesFor, outcomeBar, outcomeLabels, rateText, time, type AttendanceGroup, type AttendanceRow, type MissFilter, type SortApi, type SortKey } from './attendance';

// Vista ampliada: todas las cifras de cada jugador, su última falta y sus últimos diez entrenamientos. Las cabeceras
// son un icono y una palabra; el significado completo sale al pasar el ratón. Filtrando por faltas, debajo de cada uno
// sus faltas con el motivo.
defineProps<{ groups: AttendanceGroup[]; sort: SortApi; photos?: Record<string, string | null>; filter: MissFilter }>();
defineEmits<{ pick: [row: AttendanceRow]; toggle: [key: string] }>();

const columns: { key: SortKey; icon: string; tone?: string; label: string; title: string }[] = [
  { key: 'sessions', icon: 'calendar-days', label: 'Días', title: 'Días de entrenamiento: los acabados que le tocaban (estaba en la plantilla); los que se perdió lesionado no cuentan' },
  { key: 'attended', icon: 'check', tone: 'text-emerald-500', label: 'Vino', title: 'Días que entrenó: entrenamientos a los que vino' },
  { key: 'missed', icon: 'xmark', tone: 'text-red-500', label: 'Faltó', title: 'Días que no entrenó: faltó, avisando o sin avisar' },
  { key: 'warned', icon: 'bell', tone: 'text-amber-500', label: 'Avisó', title: 'Avisó: de los que faltó, en cuántos avisó antes' },
  { key: 'rate', icon: 'percent', label: 'Asist.', title: '% de asistencia: días que entrenó sobre los días de entrenamiento' },
  { key: 'minutes', icon: 'stopwatch', label: 'Tiempo', title: 'Tiempo entrenado: la duración de cada entrenamiento al que vino' },
  { key: 'injured', icon: 'user-injured', tone: 'text-red-400', label: 'Lesión', title: 'Lesionado: entrenamientos que se perdió lesionado; no cuentan como días de entrenamiento ni como faltas' },
  { key: 'lastMiss', icon: 'calendar-xmark', label: 'Últ. falta', title: 'Última falta: el último entrenamiento al que faltó' },
];
</script>

<template>
  <div class="-mx-4 overflow-x-auto sm:mx-0">
    <table class="table-sticky w-full min-w-[52rem] text-sm">
      <thead class="text-xs text-slate-500">
        <tr class="border-b border-line text-left">
          <SortHeader class="px-2 py-2 align-bottom font-semibold" label="Jugador" v-bind="sort.state('name')" @sort="sort.by('name')" />
          <SortHeader
            v-for="c in columns"
            :key="c.key"
            class="px-2 py-2 text-right align-bottom font-semibold [&>button]:justify-end"
            :icon="c.icon"
            :icon-class="c.tone"
            :label="c.label"
            :title="c.title"
            v-bind="sort.state(c.key)"
            @sort="sort.by(c.key)"
          />
          <th class="whitespace-nowrap px-2 py-2 align-bottom font-semibold uppercase tracking-wide" title="Últimos 10: los últimos diez entrenamientos que le tocaban, del más antiguo al más reciente">
            <Icon icon="clock-rotate-left" class="mr-1 h-3 w-3" aria-hidden="true" />Últ. 10
          </th>
        </tr>
      </thead>
      <tbody v-for="g in groups" :key="g.key" class="divide-y divide-line">
        <AttendanceGroupRow v-if="g.label" :group="g" :colspan="columns.length + 2" @toggle="$emit('toggle', g.key)" />
        <template v-for="r in g.open ? g.rows : []" :key="r.id">
          <tr :class="[r.player.active ? '' : 'opacity-60', filter !== 'all' ? 'border-b-0' : '']">
            <td class="px-2 py-1.5">
              <button type="button" class="flex min-w-0 items-center gap-2 text-left hover:text-brand-500" :title="`Ver todo lo de ${r.name}`" @click="$emit('pick', r)">
                <PlayerName :name="r.name" :photo-url="photos?.[r.id] ?? null" class="min-w-0" />
                <Badge v-if="!r.player.active" tone="slate">Ya no está</Badge>
              </button>
              <p v-for="i in r.player.injuries ?? []" :key="i.id" class="mt-0.5 flex items-start gap-1.5 pl-9">
                <Icon icon="user-injured" class="mt-0.5 h-3 w-3 shrink-0 text-red-500" />
                <InjuryNote :injury="i" :badge="false" />
              </p>
            </td>
            <td class="px-2 py-1.5 text-right tabular-nums text-slate-700">{{ r.player.sessions }}</td>
            <td class="px-2 py-1.5 text-right font-semibold tabular-nums text-slate-900">{{ r.player.attended }}</td>
            <td class="px-2 py-1.5 text-right tabular-nums text-slate-700">{{ r.player.missed }}</td>
            <td class="px-2 py-1.5 text-right tabular-nums" :class="r.player.warned ? 'text-amber-600' : 'text-slate-400'">{{ r.player.warned || '—' }}</td>
            <td class="px-2 py-1.5 text-right font-semibold tabular-nums" :class="rateText(r.player.attendanceRate)">
              {{ r.player.attendanceRate === null ? '—' : `${r.player.attendanceRate} %` }}
            </td>
            <td class="whitespace-nowrap px-2 py-1.5 text-right tabular-nums text-slate-700">{{ formatDurationMinutes(r.player.attendedMinutes) }}</td>
            <td class="px-2 py-1.5 text-right tabular-nums" :class="r.player.injured ? 'text-red-600' : 'text-slate-400'">{{ r.player.injured || '—' }}</td>
            <td class="whitespace-nowrap px-2 py-1.5 text-right text-slate-700">
              <span v-if="r.lastMiss" :title="`${r.lastMiss.title}, ${time(r.lastMiss.date)}`">{{ dayShort(r.lastMiss.date) }}</span>
              <span v-else class="text-slate-400">Nunca</span>
            </td>
            <td class="px-2 py-1.5">
              <div class="flex gap-0.5" role="img" :aria-label="`Últimos entrenamientos de ${r.name}`">
                <span
                  v-for="x in r.recent"
                  :key="x.day.sessionId"
                  class="h-3.5 w-2.5 rounded-sm"
                  :class="outcomeBar[x.outcome]"
                  :title="`${dayShort(x.day.date)}, ${time(x.day.date)} · ${outcomeLabels[x.outcome]}`"
                />
                <span v-if="!r.recent.length" class="text-xs text-slate-400">—</span>
              </div>
            </td>
          </tr>
          <tr v-if="filter !== 'all'" :class="r.player.active ? '' : 'opacity-60'">
            <td :colspan="columns.length + 2" class="px-2 pb-2.5 pt-0">
              <div class="sticky left-0 max-w-[calc(100vw-3rem)] pl-9">
                <AttendanceMisses :misses="missesFor(r, filter)" @more="$emit('pick', r)" />
              </div>
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>
