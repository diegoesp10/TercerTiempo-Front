<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import { formatDurationMinutes } from '@/utils/format';
import {
  dayLong,
  monthLong,
  outcomeCell,
  outcomeIcons,
  outcomeLabels,
  rateOf,
  rateText,
  teamTally,
  time,
  weekdayShort,
  type AttendanceDay,
  type AttendanceGroup,
  type AttendanceRow,
  type AttendanceWeek,
  type SortApi,
} from './attendance';
import AttendanceGroupRow from './AttendanceGroupRow.vue';

// Vista por día: la hoja de asistencia de siempre, un entrenamiento por columna (agrupados por mes y separados por
// semana) y una casilla por jugador con lo que fue. Abajo, cuántos vinieron. Empieza por los más recientes.
const props = defineProps<{ groups: AttendanceGroup[]; all: AttendanceRow[]; days: AttendanceDay[]; weeks: AttendanceWeek[]; sort: SortApi }>();
defineEmits<{ pick: [row: AttendanceRow]; toggle: [key: string] }>();

const scroller = ref<HTMLElement | null>(null);
async function toLatest() {
  await nextTick();
  if (scroller.value) scroller.value.scrollLeft = scroller.value.scrollWidth;
}
onMounted(toLatest);
watch(() => props.days, toLatest);

const months = computed(() => {
  const list: { key: string; label: string; span: number }[] = [];
  for (const day of props.days) {
    const key = `${day.date.getFullYear()}-${day.date.getMonth()}`;
    const last = list[list.length - 1];
    if (last?.key === key) last.span++;
    else list.push({ key, label: monthLong(day.date), span: 1 });
  }
  return list;
});
const weekStarts = computed(() => new Set(props.weeks.map((w) => w.days[0]?.index)));
const team = computed(() => props.days.map((d) => teamTally(props.all, [d.index])));

const dayTitle = (d: AttendanceDay) => `${dayLong(d.date)}, ${time(d.date)} · ${d.title} (${formatDurationMinutes(d.durationMinutes)})`;

function cellTitle(row: AttendanceRow, d: AttendanceDay) {
  const outcome = row.outcomes[d.index];
  if (!outcome) return `${row.name} · ${dayTitle(d)}: no le tocaba (no era de la plantilla)`;
  const reason = row.player.reasons?.[d.sessionId];
  return `${row.name} · ${dayTitle(d)}: ${outcomeLabels[outcome]}${reason ? ` — ${reason}` : ''}`;
}
</script>

<template>
  <div ref="scroller" class="-mx-4 overflow-x-auto overscroll-x-contain sm:mx-0">
    <table class="w-max min-w-full border-separate border-spacing-0 text-sm">
      <thead class="text-xs text-slate-500">
        <tr>
          <th class="sticky left-0 z-20 w-32 min-w-32 max-w-32 bg-surface sm:w-48 sm:min-w-48 sm:max-w-48" />
          <th class="sticky left-32 z-20 w-16 min-w-16 border-r border-line bg-surface sm:left-48" />
          <th
            v-for="m in months"
            :key="m.key"
            :colspan="m.span"
            scope="colgroup"
            class="border-l border-line px-2 pb-1 pt-1 text-left font-semibold normal-case text-slate-700"
          >
            <span class="sticky left-[17rem] whitespace-nowrap">{{ m.label }}</span>
          </th>
        </tr>
        <tr>
          <SortHeader
            class="sticky left-0 z-20 w-32 min-w-32 max-w-32 border-b border-line bg-surface px-2 py-2 text-left font-semibold sm:w-48 sm:min-w-48 sm:max-w-48"
            label="Jugador"
            v-bind="sort.state('name')"
            @sort="sort.by('name')"
          />
          <SortHeader
            class="sticky left-32 z-20 w-16 min-w-16 border-b border-r border-line bg-surface px-2 py-2 text-right font-semibold sm:left-48 [&>button]:justify-end"
            icon="percent"
            label="Total"
            title="Total: % de asistencia en todo el periodo"
            v-bind="sort.state('rate')"
            @sort="sort.by('rate')"
          />
          <th
            v-for="d in days"
            :key="d.sessionId"
            scope="col"
            class="w-9 min-w-9 border-b border-line px-0.5 py-1 text-center font-normal"
            :class="weekStarts.has(d.index) ? 'border-l border-l-line' : ''"
            :title="dayTitle(d)"
          >
            <span class="block text-[10px] uppercase text-slate-400">{{ weekdayShort(d.date).slice(0, 2) }}</span>
            <span class="block font-semibold tabular-nums text-slate-700">{{ d.date.getDate() }}</span>
          </th>
        </tr>
      </thead>
      <tbody v-for="g in groups" :key="g.key">
        <AttendanceGroupRow v-if="g.label" :group="g" :colspan="days.length + 2" @toggle="$emit('toggle', g.key)" />
        <tr v-for="r in g.open ? g.rows : []" :key="r.id" class="group" :class="r.player.active ? '' : 'opacity-60'">
          <td class="sticky left-0 z-10 w-32 min-w-32 max-w-32 border-b border-line bg-surface px-2 py-1 group-hover:bg-surface-2 sm:w-48 sm:min-w-48 sm:max-w-48">
            <button type="button" class="flex w-full min-w-0 items-center gap-1.5 text-left font-medium text-slate-800 hover:text-brand-500" :title="`Ver todo lo de ${r.name}`" @click="$emit('pick', r)">
              <span class="min-w-0 break-words leading-snug">{{ r.name }}</span>
              <Badge v-if="!r.player.active" tone="slate" class="hidden sm:inline-flex" title="Causó baja en la plantilla: sale con lo que entrenó mientras estuvo">De baja</Badge>
            </button>
          </td>
          <td class="sticky left-32 z-10 border-b border-r border-line bg-surface px-2 py-1 text-right font-semibold tabular-nums group-hover:bg-surface-2 sm:left-48" :class="rateText(r.player.attendanceRate)">
            {{ r.player.attendanceRate === null ? '—' : `${r.player.attendanceRate} %` }}
          </td>
          <td
            v-for="d in days"
            :key="d.sessionId"
            class="border-b border-line px-0.5 py-1 group-hover:bg-surface-2/60"
            :class="weekStarts.has(d.index) ? 'border-l border-l-line' : ''"
          >
            <span
              v-if="r.outcomes[d.index]"
              class="relative mx-auto grid h-7 w-7 place-items-center rounded-md ring-1 ring-inset"
              :class="outcomeCell[r.outcomes[d.index]!]"
              :title="cellTitle(r, d)"
            >
              <Icon :icon="outcomeIcons[r.outcomes[d.index]!]" class="h-3 w-3" />
              <span v-if="r.player.reasons?.[d.sessionId]" class="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-slate-500" />
            </span>
            <span v-else class="mx-auto grid h-7 w-7 place-items-center text-slate-300" :title="cellTitle(r, d)">·</span>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="text-xs">
          <th scope="row" class="sticky left-0 z-10 bg-surface px-2 py-2 text-left font-semibold uppercase tracking-wide text-slate-500">Vinieron</th>
          <td class="sticky left-32 z-10 border-r border-line bg-surface sm:left-48" />
          <td
            v-for="(t, i) in team"
            :key="days[i]!.sessionId"
            class="px-0.5 py-2 text-center font-semibold tabular-nums"
            :class="[rateText(rateOf(t)), weekStarts.has(i) ? 'border-l border-l-line' : '']"
            :title="`${dayTitle(days[i]!)}: vinieron ${t.attended} de ${t.counted}${t.injured ? ` (${t.injured} lesionados)` : ''}`"
          >
            {{ t.attended }}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
