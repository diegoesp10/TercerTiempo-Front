<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import AttendanceGroupRow from './AttendanceGroupRow.vue';
import { rateHeat, rateOf, rateText, teamTally, type AttendanceGroup, type AttendanceRow, type AttendanceWeek, type SortApi, type Tally } from './attendance';

// Vista por semana: cada jugador, semana a semana, a cuántos entrenamientos vino de los que le tocaban, con el color
// del porcentaje. Abajo, el equipo. Empieza enseñando las semanas más recientes.
const props = defineProps<{ groups: AttendanceGroup[]; all: AttendanceRow[]; weeks: AttendanceWeek[]; sort: SortApi }>();
defineEmits<{ pick: [row: AttendanceRow]; toggle: [key: string] }>();

const scroller = ref<HTMLElement | null>(null);
async function toLatest() {
  await nextTick();
  if (scroller.value) scroller.value.scrollLeft = scroller.value.scrollWidth;
}
onMounted(toLatest);
watch(() => props.weeks, toLatest);

const team = (week: AttendanceWeek) => teamTally(props.all, week.days.map((d) => d.index));

function title(row: AttendanceRow, week: AttendanceWeek, t: Tally | undefined) {
  const head = `${row.name} · semana del ${week.label}`;
  if (!t || (t.counted === 0 && t.injured === 0)) return `${head}: no le tocaba ningún entrenamiento`;
  const parts = [`vino a ${t.attended} de ${t.counted}`];
  if (t.warned) parts.push(`faltó a ${t.warned} avisando`);
  if (t.missed - t.warned) parts.push(`faltó a ${t.missed - t.warned} sin avisar`);
  if (t.injured) parts.push(`${t.injured} lesionado`);
  return `${head}: ${parts.join(', ')}`;
}
</script>

<template>
  <div ref="scroller" class="-mx-4 overflow-x-auto overscroll-x-contain sm:mx-0">
    <table class="w-max min-w-full border-separate border-spacing-0 text-sm">
      <thead class="text-xs text-slate-500">
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
          <th v-for="w in weeks" :key="w.key" scope="col" class="border-b border-line px-1 py-2 text-center font-semibold" :title="`Semana del ${w.label}`">
            <span class="block whitespace-nowrap text-slate-700">{{ w.label }}</span>
            <span class="block font-normal normal-case text-slate-400">{{ w.days.length }} {{ w.days.length === 1 ? 'entreno' : 'entrenos' }}</span>
          </th>
        </tr>
      </thead>
      <tbody v-for="g in groups" :key="g.key">
        <AttendanceGroupRow v-if="g.label" :group="g" :colspan="weeks.length + 2" @toggle="$emit('toggle', g.key)" />
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
          <td v-for="w in weeks" :key="w.key" class="border-b border-line px-1 py-1 group-hover:bg-surface-2/60">
            <div
              class="relative mx-auto grid h-8 w-16 place-items-center rounded-md text-xs font-semibold tabular-nums"
              :class="r.weeks[w.key] && r.weeks[w.key]!.counted ? rateHeat(rateOf(r.weeks[w.key]!)) : 'bg-surface-2/50 text-slate-300'"
              :title="title(r, w, r.weeks[w.key])"
            >
              <template v-if="r.weeks[w.key]?.counted">{{ r.weeks[w.key]!.attended }}/{{ r.weeks[w.key]!.counted }}</template>
              <Icon v-else-if="r.weeks[w.key]?.injured" icon="user-injured" class="h-3 w-3 text-slate-400" />
              <template v-else>·</template>
              <span v-if="r.weeks[w.key]?.warned" class="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
              <Icon v-if="r.weeks[w.key]?.counted && r.weeks[w.key]?.injured" icon="user-injured" class="absolute bottom-0.5 right-0.5 h-2 w-2 text-slate-400" />
            </div>
          </td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="text-xs">
          <th scope="row" class="sticky left-0 z-10 bg-surface px-2 py-2 text-left font-semibold uppercase tracking-wide text-slate-500" colspan="1">Equipo</th>
          <td class="sticky left-32 z-10 border-r border-line bg-surface px-2 py-2 sm:left-48" />
          <td v-for="w in weeks" :key="w.key" class="px-1 py-2">
            <div
              class="mx-auto grid h-7 w-16 place-items-center rounded-md font-semibold tabular-nums"
              :class="rateHeat(rateOf(team(w)))"
              :title="`Semana del ${w.label}: ${team(w).attended} asistencias de ${team(w).counted} posibles`"
            >
              {{ rateOf(team(w)) === null ? '—' : `${rateOf(team(w))} %` }}
            </div>
          </td>
        </tr>
      </tfoot>
    </table>
  </div>
</template>
