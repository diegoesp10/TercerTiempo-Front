<script setup lang="ts">
import { computed } from 'vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import InjuryNote from '@/components/trainings/InjuryNote.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import { formatDurationMinutes, toDateKey } from '@/utils/format';
import AttendanceBar from './AttendanceBar.vue';
import { dayLong, dayShort, mondayOf, monthShort, outcomeBar, outcomeCell, outcomeIcons, outcomeLabels, rateText, time, type AttendanceDay, type AttendanceRow, type Outcome } from './attendance';

// Todo lo de un jugador junto, en una ventana que se abre al pulsar su nombre (la lista no se mueve): su porcentaje, sus
// cifras, su calendario de entrenamientos (una casilla por día), sus faltas con el motivo y sus lesiones.
const props = defineProps<{ row: AttendanceRow | null; days: AttendanceDay[]; squadId: string; photoUrl: string | null }>();
defineEmits<{ close: [] }>();

const p = computed(() => props.row?.player ?? null);

// Lo peor del día manda en la casilla si hubo dos entrenamientos.
const severity: Record<Outcome, number> = { Missed: 3, Warned: 2, Injured: 1, Attended: 0 };
const weekdayInitials = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const calendar = computed(() => {
  const row = props.row;
  const days = props.days;
  if (!row || !days.length) return [];
  const byKey = new Map<string, AttendanceDay[]>();
  for (const d of days) byKey.set(d.key, [...(byKey.get(d.key) ?? []), d]);
  const last = mondayOf(days[days.length - 1]!.date);
  const weeks: { key: string; month: string; cells: { key: string; date: Date; sessions: { day: AttendanceDay; outcome: Outcome | null }[]; worst: Outcome | null }[] }[] = [];
  let previousMonth = -1;
  for (const monday = mondayOf(days[0]!.date); monday <= last; monday.setDate(monday.getDate() + 7)) {
    const cells = weekdayInitials.map((_, i) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      const key = toDateKey(date);
      const sessions = (byKey.get(key) ?? []).map((day) => ({ day, outcome: row.outcomes[day.index] ?? null }));
      const outcomes = sessions.map((s) => s.outcome).filter((o): o is Outcome => o !== null);
      const worst = outcomes.length ? outcomes.reduce((a, b) => (severity[b] > severity[a] ? b : a)) : null;
      return { key, date, sessions, worst };
    });
    // El mes de la semana es el de su jueves: así cada semana cae en un solo mes.
    const thursday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 3);
    const month = thursday.getMonth() !== previousMonth ? monthShort(thursday) : '';
    previousMonth = thursday.getMonth();
    weeks.push({ key: toDateKey(monday), month, cells });
  }
  return weeks;
});

function cellClass(cell: { sessions: unknown[]; worst: Outcome | null }) {
  if (cell.worst) return outcomeBar[cell.worst];
  if (cell.sessions.length) return 'bg-transparent ring-1 ring-inset ring-line';
  return 'bg-surface-2';
}

function cellTitle(cell: { date: Date; sessions: { day: AttendanceDay; outcome: Outcome | null }[] }) {
  if (!cell.sessions.length) return `${dayLong(cell.date)}: sin entrenamiento`;
  return cell.sessions
    .map((s) => {
      const reason = props.row?.player.reasons?.[s.day.sessionId];
      const what = s.outcome ? outcomeLabels[s.outcome] : 'no le tocaba';
      return `${dayLong(s.day.date)}, ${time(s.day.date)} · ${s.day.title}: ${what}${reason ? ` — ${reason}` : ''}`;
    })
    .join('\n');
}

const stats = computed(() => {
  const x = p.value;
  if (!x || !props.row) return [];
  return [
    { label: 'Entrenó', value: `${x.attended} de ${x.sessions}`, tone: 'text-slate-900' },
    { label: 'Tiempo', value: formatDurationMinutes(x.attendedMinutes), tone: 'text-slate-900' },
    { label: 'Faltas', value: `${x.missed}`, hint: x.missed ? `${x.warned} avisando` : null, tone: x.missed ? 'text-red-600' : 'text-slate-900' },
    { label: 'Lesionado', value: x.injured ? `${x.injured}` : '—', hint: x.injured ? 'no cuentan' : null, tone: x.injured ? 'text-slate-900' : 'text-slate-400' },
    { label: 'Última falta', value: props.row.lastMiss ? dayShort(props.row.lastMiss.date) : 'Nunca', tone: props.row.lastMiss ? 'text-slate-900' : 'text-emerald-600' },
  ];
});
</script>

<template>
  <Modal :open="row !== null" :title="row ? `Asistencia de ${row.name}` : 'Asistencia'" size="lg" @close="$emit('close')">
    <template v-if="row && p" #header>
      <div class="flex min-w-0 flex-1 items-center gap-3">
        <PlayerAvatar :src="photoUrl" :name="row.name" size="md" />
        <div class="min-w-0 flex-1">
          <p class="flex flex-wrap items-center gap-2">
            <span class="min-w-0 break-words text-lg font-bold leading-tight text-slate-900">{{ row.name }}</span>
            <Badge v-if="!p.active" tone="slate" title="Causó baja en la plantilla: sale con lo que entrenó mientras estuvo">De baja</Badge>
          </p>
          <RouterLink :to="{ name: 'squad-player', params: { squadId, squadPlayerId: row.id } }" class="text-xs font-medium text-brand-500 hover:underline">
            Ver su ficha <Icon icon="chevron-right" class="ml-0.5 h-2.5 w-2.5" />
          </RouterLink>
        </div>
        <div class="shrink-0 pr-2 text-right">
          <p class="font-figures text-3xl font-bold leading-none" :class="rateText(p.attendanceRate)">{{ p.attendanceRate === null ? '—' : `${p.attendanceRate} %` }}</p>
          <p class="mt-1 text-[11px] text-slate-500">de asistencia</p>
        </div>
      </div>
    </template>

    <div v-if="row && p" class="space-y-5">
      <AttendanceBar :player="p" tall />

      <dl class="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5">
        <div v-for="s in stats" :key="s.label">
          <dt class="text-[11px] font-medium uppercase tracking-wide text-slate-500">{{ s.label }}</dt>
          <dd class="font-semibold tabular-nums" :class="s.tone">
            {{ s.value }}<span v-if="s.hint" class="ml-1 text-xs font-normal text-slate-500">{{ s.hint }}</span>
          </dd>
        </div>
      </dl>

      <!-- Faltas con su motivo, lo primero que se busca -->
      <section v-if="row.misses.length">
        <p class="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Faltas · {{ row.misses.length }}</p>
        <ul class="divide-y divide-line overflow-hidden rounded-xl border border-line">
          <li v-for="m in row.misses" :key="m.day.sessionId" class="flex items-start gap-3 px-3 py-2.5">
            <span class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md ring-1 ring-inset" :class="outcomeCell[m.outcome]">
              <Icon :icon="outcomeIcons[m.outcome]" class="h-3 w-3" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
                <span class="font-semibold text-slate-900">{{ dayShort(m.day.date) }}</span>
                <span class="text-xs text-slate-500">{{ time(m.day.date) }} · {{ m.day.title }}</span>
                <Badge :tone="m.outcome === 'Warned' ? 'amber' : 'red'">{{ m.outcome === 'Warned' ? 'Avisó' : 'Sin avisar' }}</Badge>
              </p>
              <p v-if="m.reason" class="mt-1 flex items-start gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 text-sm text-slate-800">
                <Icon icon="comment-dots" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{{ m.reason }}
              </p>
              <p v-else class="mt-0.5 text-xs italic text-slate-400">Sin motivo apuntado</p>
            </div>
          </li>
        </ul>
      </section>
      <p v-else-if="p.sessions" class="flex items-center gap-2 text-sm text-emerald-600"><Icon icon="circle-check" class="h-3.5 w-3.5" />No ha faltado a ninguno.</p>

      <section v-if="calendar.length">
        <p class="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">Calendario</p>
        <div class="overflow-x-auto pb-1">
          <div class="inline-flex gap-[3px]">
            <div class="mr-1 grid grid-rows-[auto_repeat(7,0.875rem)] gap-[3px] text-[9px] leading-[0.875rem] text-slate-400">
              <span class="h-3" />
              <span v-for="(d, i) in weekdayInitials" :key="d">{{ i % 2 === 0 ? d : '' }}</span>
            </div>
            <div v-for="w in calendar" :key="w.key" class="grid grid-rows-[auto_repeat(7,0.875rem)] gap-[3px]">
              <span class="h-3 whitespace-nowrap text-[9px] leading-3 text-slate-400">{{ w.month }}</span>
              <span v-for="c in w.cells" :key="c.key" class="h-3.5 w-3.5 rounded-[3px]" :class="cellClass(c)" :title="cellTitle(c)" />
            </div>
          </div>
        </div>
      </section>

      <section v-if="p.injuries?.length">
        <p class="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Lesiones</p>
        <p v-for="i in p.injuries" :key="i.id" class="flex items-start gap-1.5 text-sm">
          <Icon icon="user-injured" class="mt-0.5 h-3 w-3 shrink-0 text-danger" />
          <InjuryNote :injury="i" :badge="false" />
        </p>
      </section>
    </div>
  </Modal>
</template>
