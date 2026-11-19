<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue';
import FullCalendar, { type CalendarOptions, type DateClickInfo, type DatesSetInfo, type EventClickInfo, type EventInput } from '@fullcalendar/vue3';
import dayGridPlugin from '@fullcalendar/vue3/daygrid';
import interactionPlugin from '@fullcalendar/vue3/interaction';
import listPlugin from '@fullcalendar/vue3/list';
import esLocale from '@fullcalendar/vue3/locales/es';
import breezyTheme from '@fullcalendar/vue3/themes/breezy';
import timeGridPlugin from '@fullcalendar/vue3/timegrid';
import '@fullcalendar/vue3/skeleton.css';
import '@fullcalendar/vue3/themes/breezy/theme.css';
import './calendar-theme.css';
import MatchResultPill from '@/components/matches/MatchResultPill.vue';
import { outcomeFor, outcomeLabels, resultStyle, resultText } from '@/components/matches/matchResult';
import Badge from '@/components/ui/Badge.vue';
import TeamName from '@/components/teams/TeamName.vue';
import { unavailableOf, unavailableSummary } from '@/components/trainings/unavailable';
import type { MatchDto, SquadAgendaItemDto, TrainingSummaryDto } from '@/types/api';
import { opponentOf } from '@/utils/crests';
import { formatDurationMinutes, formatTime, toDateKey } from '@/utils/format';

/**
 * Calendario de la plantilla con FullCalendar (tema Breezy con los colores de la app) en cuatro vistas: el mes entero,
 * la semana y el día por horas, y la semana en lista (la cómoda en el móvil). El padre carga la agenda del rango que se
 * ve (`range`) y decide qué pasa al pulsar un hueco, una sesión o un partido.
 *
 * Los partidos van rellenos y con balón; los entrenamientos, con borde del color de su tipo. Lo ya realizado se atenúa
 * y lleva un check, para distinguirlo de un vistazo de lo pendiente; el partido jugado, en cambio, se pinta del color de
 * su resultado (verde si se ganó, amarillo si se empató y rojo si se perdió) con la letra y el marcador.
 */
const props = withDefaults(
  defineProps<{
    items: SquadAgendaItemDto[];
    /** Equipo de la plantilla, para saber quién es el rival. */
    teamId: string;
    canPlan?: boolean;
    selectedId?: string | null;
  }>(),
  { canPlan: false, selectedId: null },
);
const emit = defineEmits<{
  select: [session: TrainingSummaryDto];
  match: [match: MatchDto];
  /** Día pulsado y, en las vistas por horas, la hora del hueco. */
  plan: [dateKey: string, time: string | null];
  /** Días que se ven (de `from` a `to`, ambos incluidos): el padre carga su agenda. */
  range: [range: { from: string; to: string }];
}>();

type ViewKey = 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';
const views: { key: ViewKey; label: string; icon: string; hint: string }[] = [
  { key: 'dayGridMonth', label: 'Mes', icon: 'calendar-days', hint: 'El mes entero de un vistazo' },
  { key: 'timeGridWeek', label: 'Semana', icon: 'calendar-week', hint: 'La semana por horas' },
  { key: 'timeGridDay', label: 'Día', icon: 'calendar-day', hint: 'Un día por horas, con todo el detalle' },
  { key: 'listWeek', label: 'Lista', icon: 'table-list', hint: 'La semana en lista' },
];

// La vista elegida se recuerda en el dispositivo; sin elegir, el mes en pantallas anchas y la lista en el móvil.
const VIEW_STORAGE = 'tt.calendar.view';
function savedView(): ViewKey {
  try {
    const saved = localStorage.getItem(VIEW_STORAGE);
    if (views.some((v) => v.key === saved)) return saved as ViewKey;
  } catch {
    // Sin almacenamiento (modo privado): se usa la vista por defecto.
  }
  return window.matchMedia('(max-width: 639px)').matches ? 'listWeek' : 'dayGridMonth';
}

const view = ref<ViewKey>(savedView());
const startView = view.value;
const title = ref('');
const showingToday = ref(true);
const calendar = shallowRef<InstanceType<typeof FullCalendar> | null>(null);
const api = () => calendar.value?.getApi();

function changeView(key: ViewKey) {
  api()?.changeView(key);
  try {
    localStorage.setItem(VIEW_STORAGE, key);
  } catch {
    // Sin almacenamiento: la vista vale para esta visita.
  }
}

const MATCH_MINUTES = 105;
const minutesOf = (item: SquadAgendaItemDto) => (item.kind === 'Match' ? MATCH_MINUTES : item.training!.durationMinutes);
const itemKey = (item: SquadAgendaItemDto) => (item.kind === 'Match' ? `m:${item.match!.id}` : `t:${item.training!.id}`);
const rival = (match: MatchDto) => opponentOf(match, props.teamId);
const score = (match: MatchDto) => (match.homeGoals !== null && match.awayGoals !== null ? `${match.homeGoals}-${match.awayGoals}` : null);
// Resultado del partido ya jugado para el equipo de la plantilla; null en lo demás (también si aún no hay marcador).
const result = (item: SquadAgendaItemDto) => (item.kind === 'Match' && item.done ? outcomeFor(item.match!, props.teamId) : null);
const pad = (n: number) => String(n).padStart(2, '0');

function plainTitle(item: SquadAgendaItemDto) {
  const state = item.done ? ' · ya realizado' : '';
  if (item.kind === 'Match') {
    const played = item.done ? resultText(item.match!, props.teamId) : null;
    const missing = unavailableSummary(unavailableOf(item));
    return `J${item.match!.matchday} vs ${rival(item.match!).name} · ${formatTime(item.startsAt)}${played ? ` · ${played.toLowerCase()}` : state}${missing ? ` · ${missing}` : ''}`;
  }
  return `${item.training!.title} · ${item.training!.kindLabel} · ${formatTime(item.startsAt)}${state}`;
}

const events = computed<EventInput[]>(() =>
  props.items.map((item) => {
    const start = new Date(item.startsAt);
    return { id: itemKey(item), title: plainTitle(item), start, end: new Date(start.getTime() + minutesOf(item) * 60_000), extendedProps: { item } };
  }),
);

// Horas de las vistas por horas: de 9 a 22 como poco, ampliadas si algo empieza antes o acaba después.
const hours = computed(() => {
  let min = 9;
  let max = 22;
  for (const item of props.items) {
    const start = new Date(item.startsAt);
    const end = new Date(start.getTime() + minutesOf(item) * 60_000);
    min = Math.min(min, start.getHours());
    max = Math.max(max, end.getDate() !== start.getDate() ? 24 : end.getHours() + (end.getMinutes() ? 1 : 0));
  }
  return { min: `${pad(min)}:00:00`, max: `${pad(max)}:00:00`, slots: (max - min) * 2 };
});

// Alto de cada media hora en Semana y Día (más que el del tema, para que una sesión de 45 minutos enseñe hora, título y
// tipo). Se fija el alto del contenido y las filas se estiran hasta llenarlo; HEADER_PX es la fila de los días.
const SLOT_PX = 40;
const HEADER_PX = 60;
// El mes entero tiene que caber en la pantalla sin desplazar: seis semanas de alto fijo, con sitio para dos cosas por día
// (un partido y un entrenamiento); si hay más, «+N más».
const MONTH_ROW_PX = 90;
const MONTH_HEADER_PX = 36;

function onDatesSet(info: DatesSetInfo) {
  view.value = info.view.type as ViewKey;
  title.value = info.view.title.charAt(0).toUpperCase() + info.view.title.slice(1);
  const now = new Date();
  showingToday.value = info.view.currentStart <= now && now < info.view.currentEnd;
  const last = new Date(info.end);
  last.setDate(last.getDate() - 1);
  emit('range', { from: toDateKey(info.start), to: toDateKey(last) });
}

function open(item: SquadAgendaItemDto) {
  if (item.kind === 'Match') emit('match', item.match!);
  else emit('select', item.training!);
}

function onEventClick(info: EventClickInfo) {
  info.jsEvent.preventDefault();
  open(info.event.extendedProps.item as SquadAgendaItemDto);
}

function onDateClick(info: DateClickInfo) {
  if (!props.canPlan) return;
  const byHours = info.view.type.startsWith('timeGrid');
  emit('plan', toDateKey(info.date), byHours ? `${pad(info.date.getHours())}:${pad(info.date.getMinutes())}` : null);
}

const options = computed<CalendarOptions>(() => ({
  plugins: [breezyTheme, dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
  locale: esLocale,
  initialView: startView,
  headerToolbar: false,
  firstDay: 1,
  height: 'auto',
  views: {
    dayGridMonth: { height: undefined, contentHeight: 6 * MONTH_ROW_PX + MONTH_HEADER_PX, expandRows: true, dayMaxEvents: true },
    timeGrid: { height: undefined, contentHeight: hours.value.slots * SLOT_PX + HEADER_PX, expandRows: true },
    timeGridWeek: { titleFormat: { day: 'numeric', month: 'long', year: 'numeric' } },
  },
  allDaySlot: false,
  nowIndicator: true,
  navLinks: true,
  navLinkDayClick: 'timeGridDay',
  dayMaxEvents: 3,
  eventDisplay: 'block',
  eventColor: 'transparent',
  slotDuration: '00:30:00',
  slotMinTime: hours.value.min,
  slotMaxTime: hours.value.max,
  slotHeaderFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  eventTimeFormat: { hour: '2-digit', minute: '2-digit', hour12: false },
  noEventsText: 'Nada preparado en estos días.',
  events: events.value,
  datesSet: onDatesSet,
  eventClick: onEventClick,
  dateClick: onDateClick,
}));

// Aspecto de cada elemento: partido relleno, entrenamiento con el color de su tipo y lo realizado apagado.
const kindClass: Record<TrainingSummaryDto['kind'], string> = {
  Season: 'border-brand-500/40 bg-brand-500/10 text-brand-600',
  Preseason: 'border-amber-400/50 bg-amber-400/10 text-amber-700',
  Recovery: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-700',
  MatchPreparation: 'border-accent-400/50 bg-accent-400/10 text-accent-500',
  Other: 'border-slate-300 bg-surface-2 text-slate-600',
};
const kindBar: Record<TrainingSummaryDto['kind'], string> = {
  Season: 'border-l-brand-500',
  Preseason: 'border-l-amber-400',
  Recovery: 'border-l-emerald-400',
  MatchPreparation: 'border-l-accent-400',
  Other: 'border-l-slate-400',
};
const doneClass = 'border-dashed border-slate-300 bg-surface-2/70 text-slate-500';
const matchClass = 'border-brand-500 bg-brand-500 text-white shadow-sm';
const matchDoneClass = 'border-dashed border-brand-500/40 bg-brand-500/10 text-slate-500';

function chipClass(item: SquadAgendaItemDto) {
  const r = result(item);
  if (r) return `${resultStyle[r].tint} ${resultStyle[r].bar} border-l-[3px] text-slate-700`;
  if (item.kind === 'Match') return item.done ? matchDoneClass : matchClass;
  return item.done ? doneClass : kindClass[item.training!.kind];
}

const legendResults = ['win', 'draw', 'loss'] as const;
const isSelected = (item: SquadAgendaItemDto) => item.kind === 'Training' && item.training!.id === props.selectedId;
const itemOf = (arg: { event: { extendedProps: Record<string, unknown> } }) => arg.event.extendedProps.item as SquadAgendaItemDto;
const endTime = (item: SquadAgendaItemDto) => formatTime(new Date(new Date(item.startsAt).getTime() + minutesOf(item) * 60_000).toISOString());
</script>

<template>
  <div class="tt-calendar">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-1">
        <button type="button" class="btn-ghost px-2" aria-label="Anterior" title="Anterior" @click="api()?.prev()"><Icon icon="chevron-left" class="h-4 w-4" /></button>
        <button type="button" class="btn-ghost px-2" aria-label="Siguiente" title="Siguiente" @click="api()?.next()"><Icon icon="chevron-right" class="h-4 w-4" /></button>
        <button type="button" class="btn-ghost px-2 text-xs" :disabled="showingToday" @click="api()?.today()">Hoy</button>
        <h2 class="ml-1 truncate text-lg font-semibold text-slate-900" aria-live="polite">{{ title }}</h2>
      </div>
      <div class="flex max-w-full overflow-x-auto rounded-lg border border-line text-xs" role="tablist" aria-label="Vista del calendario">
        <button
          v-for="v in views"
          :key="v.key"
          type="button"
          role="tab"
          class="flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-medium transition first:rounded-l-lg last:rounded-r-lg"
          :class="view === v.key ? 'bg-brand-500 text-white' : 'text-slate-600 hover:bg-surface-2'"
          :aria-selected="view === v.key"
          :title="v.hint"
          @click="changeView(v.key)"
        >
          <Icon :icon="v.icon" class="h-3 w-3" />{{ v.label }}
        </button>
      </div>
    </div>

    <div class="overflow-hidden rounded-xl border border-line bg-surface text-sm" :class="`tt-calendar--${view}`">
      <FullCalendar ref="calendar" :options="options">
        <template #eventContent="arg">
          <!-- Lista: una línea con todo lo importante -->
          <div v-if="arg.view.type === 'listWeek'" class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1" :title="arg.event.title">
            <span class="w-full shrink-0 text-xs font-semibold tabular-nums text-slate-500 sm:w-24">{{ formatTime(itemOf(arg).startsAt) }} – {{ endTime(itemOf(arg)) }}</span>
            <template v-if="itemOf(arg).kind === 'Match'">
              <Icon icon="futbol" class="h-3 w-3 shrink-0 text-brand-500" />
              <span class="font-semibold text-slate-900">J{{ itemOf(arg).match!.matchday }}</span>
              <TeamName class="min-w-0 font-medium text-slate-900" prefix="vs" :name="rival(itemOf(arg).match!).name" :crest-url="rival(itemOf(arg).match!).crestUrl" :short-name="rival(itemOf(arg).match!).shortName" />
              <MatchResultPill v-if="result(itemOf(arg))" :match="itemOf(arg).match!" :team-id="teamId" />
              <Badge v-else-if="itemOf(arg).done" tone="slate"><Icon icon="check" class="mr-1 h-2.5 w-2.5" />Jugado<template v-if="score(itemOf(arg).match!)"> · {{ score(itemOf(arg).match!) }}</template></Badge>
              <Badge v-else-if="itemOf(arg).callUp?.status === 'Published'" tone="green">Convocatoria publicada</Badge>
              <Badge v-else-if="itemOf(arg).callUp" tone="amber">Convocatoria en borrador</Badge>
              <Badge v-else tone="slate">Sin convocatoria</Badge>
              <Badge v-if="unavailableOf(itemOf(arg)).length" tone="red"><Icon icon="ban" class="mr-1 h-2.5 w-2.5" />{{ unavailableOf(itemOf(arg)).length }} no {{ unavailableOf(itemOf(arg)).length === 1 ? 'disponible' : 'disponibles' }}</Badge>
            </template>
            <template v-else>
              <span class="inline-flex min-w-0 items-center gap-2">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full border-2" :class="itemOf(arg).done ? 'border-slate-300' : kindBar[itemOf(arg).training!.kind].replace('border-l-', 'border-')" />
                <span class="font-medium" :class="itemOf(arg).done ? 'text-slate-500' : 'text-slate-900'">{{ itemOf(arg).training!.title }}</span>
              </span>
              <span class="text-xs text-slate-500">{{ itemOf(arg).training!.kindLabel }} · {{ formatDurationMinutes(itemOf(arg).training!.durationMinutes) }}<template v-if="itemOf(arg).training!.location"> · {{ itemOf(arg).training!.location }}</template></span>
              <Badge v-if="itemOf(arg).done" tone="slate"><Icon icon="check" class="mr-1 h-2.5 w-2.5" />Realizado</Badge>
              <Badge v-if="!itemOf(arg).done && itemOf(arg).training!.counts.willMiss" tone="amber">{{ itemOf(arg).training!.counts.willMiss }} faltan</Badge>
              <Badge v-if="itemOf(arg).training!.mine?.injured" tone="red">Estás lesionado</Badge>
              <Badge v-else-if="itemOf(arg).training!.mine?.status === 'WillMiss'" tone="amber">Has avisado</Badge>
            </template>
          </div>

          <!-- Semana y día: bloque del alto de su duración -->
          <div
            v-else-if="arg.view.type.startsWith('timeGrid')"
            class="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-md border px-1.5 py-1 text-left text-xs leading-tight transition hover:brightness-105 [&>*]:shrink-0"
            :class="[chipClass(itemOf(arg)), itemOf(arg).kind === 'Training' && !itemOf(arg).done ? `border-l-4 ${kindBar[itemOf(arg).training!.kind]}` : '', isSelected(itemOf(arg)) ? 'ring-2 ring-brand-400' : '']"
            :title="arg.event.title"
          >
            <span class="flex min-w-0 items-center gap-1 tabular-nums">
              <Icon v-if="result(itemOf(arg))" icon="futbol" class="h-2.5 w-2.5 shrink-0" />
              <Icon v-else-if="itemOf(arg).done" icon="check" class="h-2.5 w-2.5 shrink-0" aria-label="Realizado" />
              <Icon v-else-if="itemOf(arg).kind === 'Match'" icon="futbol" class="h-2.5 w-2.5 shrink-0" />
              <span class="shrink-0 opacity-90">{{ formatTime(itemOf(arg).startsAt) }}<template v-if="!arg.isShort"> – {{ endTime(itemOf(arg)) }}</template></span>
              <span v-if="arg.isShort" class="truncate font-semibold">{{ itemOf(arg).kind === 'Match' ? `J${itemOf(arg).match!.matchday} ${rival(itemOf(arg).match!).shortName ?? rival(itemOf(arg).match!).name}` : itemOf(arg).training!.title }}</span>
            </span>
            <template v-if="arg.isShort" />
            <template v-else-if="itemOf(arg).kind === 'Match'">
              <span class="flex min-w-0 items-center gap-1 font-semibold">
                J{{ itemOf(arg).match!.matchday }}
                <TeamName class="min-w-0" :name="rival(itemOf(arg).match!).name" :crest-url="rival(itemOf(arg).match!).crestUrl" :short-name="rival(itemOf(arg).match!).shortName" />
                <MatchResultPill v-if="result(itemOf(arg))" class="ml-auto" :match="itemOf(arg).match!" :team-id="teamId" />
                <span v-else-if="itemOf(arg).done && score(itemOf(arg).match!)" class="ml-auto shrink-0 tabular-nums">{{ score(itemOf(arg).match!) }}</span>
              </span>
              <span v-if="itemOf(arg).match!.venue" class="truncate opacity-80">{{ itemOf(arg).match!.venue }}</span>
              <span v-if="unavailableOf(itemOf(arg)).length" class="truncate font-semibold"><Icon icon="ban" class="mr-0.5 h-2.5 w-2.5" />{{ unavailableOf(itemOf(arg)).length }} no {{ unavailableOf(itemOf(arg)).length === 1 ? 'disponible' : 'disponibles' }}</span>
              <span v-if="!itemOf(arg).done" class="mt-auto truncate opacity-90">
                {{ itemOf(arg).callUp?.status === 'Published' ? 'Convocatoria publicada' : itemOf(arg).callUp ? 'Convocatoria en borrador' : 'Sin convocatoria' }}
              </span>
            </template>
            <template v-else>
              <span class="truncate font-semibold">{{ itemOf(arg).training!.title }}</span>
              <span class="truncate opacity-80">
                {{ itemOf(arg).training!.kindLabel }}<template v-if="itemOf(arg).training!.location"> · {{ itemOf(arg).training!.location }}</template>
              </span>
              <span class="mt-auto flex flex-wrap gap-x-2 opacity-90">
                <span v-if="itemOf(arg).training!.itemsCount">{{ itemOf(arg).training!.itemsCount }} ejercicios</span>
                <span v-if="!itemOf(arg).done && itemOf(arg).training!.counts.willMiss" class="text-amber-700">{{ itemOf(arg).training!.counts.willMiss }} faltan</span>
                <span v-if="itemOf(arg).training!.started && itemOf(arg).training!.counts.attended">{{ itemOf(arg).training!.counts.attended }} vinieron</span>
                <span v-if="itemOf(arg).training!.mine?.injured" class="text-red-600">Estás lesionado</span>
                <span v-else-if="itemOf(arg).training!.mine?.status === 'WillMiss'" class="text-amber-700">Has avisado</span>
              </span>
            </template>
          </div>

          <!-- Mes: una pastilla por elemento (en estrecho, solo la hora o el resultado: el relleno ya dice si es partido) -->
          <div
            v-else
            class="flex w-full min-w-0 items-center gap-1 rounded border py-0.5 text-left font-medium leading-tight transition hover:brightness-105"
            :class="[chipClass(itemOf(arg)), isSelected(itemOf(arg)) ? 'ring-2 ring-brand-400' : '', arg.isNarrow ? 'justify-center px-0 text-[10px]' : 'px-1 text-xs']"
            :title="arg.event.title"
          >
            <!-- Partido jugado: sin hora (ya no importa) para que quepan el rival y el resultado -->
            <template v-if="result(itemOf(arg))">
              <MatchResultPill v-if="arg.isNarrow" size="xs" :match="itemOf(arg).match!" :team-id="teamId" />
              <template v-else>
                <span class="shrink-0 font-semibold">J{{ itemOf(arg).match!.matchday }}</span>
                <TeamName class="min-w-0" :name="rival(itemOf(arg).match!).name" :crest-url="rival(itemOf(arg).match!).crestUrl" :short-name="rival(itemOf(arg).match!).shortName" />
                <MatchResultPill class="ml-auto" size="xs" :match="itemOf(arg).match!" :team-id="teamId" />
              </template>
            </template>
            <!-- Lo demás: hora y lo que sea -->
            <template v-else>
              <template v-if="!arg.isNarrow">
                <Icon v-if="itemOf(arg).done" icon="check" class="h-2.5 w-2.5 shrink-0" aria-label="Realizado" />
                <Icon v-else-if="itemOf(arg).kind === 'Match'" icon="futbol" class="h-2.5 w-2.5 shrink-0" />
              </template>
              <span class="shrink-0 tabular-nums">{{ formatTime(itemOf(arg).startsAt) }}</span>
              <template v-if="!arg.isNarrow">
                <template v-if="itemOf(arg).kind === 'Match'">
                  <span class="shrink-0 font-semibold">J{{ itemOf(arg).match!.matchday }}</span>
                  <TeamName class="min-w-0" :name="rival(itemOf(arg).match!).name" :crest-url="rival(itemOf(arg).match!).crestUrl" :short-name="rival(itemOf(arg).match!).shortName" />
                  <span v-if="itemOf(arg).done && score(itemOf(arg).match!)" class="ml-auto shrink-0 tabular-nums">{{ score(itemOf(arg).match!) }}</span>
                  <span v-else-if="unavailableOf(itemOf(arg)).length" class="ml-auto inline-flex shrink-0 items-center gap-0.5 tabular-nums" aria-label="No disponibles"><Icon icon="ban" class="h-2.5 w-2.5" />{{ unavailableOf(itemOf(arg)).length }}</span>
                </template>
                <template v-else>
                  <span class="truncate">{{ itemOf(arg).training!.title }}</span>
                  <span v-if="itemOf(arg).training!.mine?.injured" class="ml-0.5 text-red-600" title="Estás lesionado: no entrenas">·</span>
                  <span v-else-if="itemOf(arg).training!.mine?.status === 'WillMiss'" class="ml-0.5 text-amber-600" title="Has avisado de que faltas">·</span>
                </template>
              </template>
            </template>
          </div>
        </template>
      </FullCalendar>
    </div>

    <!-- Leyenda: qué es cada cosa y qué está ya hecho -->
    <p class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
      <span class="inline-flex items-center gap-1.5"><span class="inline-flex h-3.5 w-5 items-center justify-center rounded border border-brand-500 bg-brand-500 text-white"><Icon icon="futbol" class="h-2 w-2" /></span>Partido (convocatoria)</span>
      <span class="inline-flex items-center gap-1.5"><span class="h-3.5 w-5 rounded border border-brand-500/40 bg-brand-500/10"></span>Entrenamiento (citación)</span>
      <span class="inline-flex items-center gap-1.5"><span class="inline-flex h-3.5 w-5 items-center justify-center rounded border border-dashed border-slate-300 bg-surface-2/70 text-slate-500"><Icon icon="check" class="h-2 w-2" /></span>Ya realizado</span>
      <span class="inline-flex items-center gap-1.5" title="En los partidos por jugar: sancionados (5.ª amarilla o expulsión en el anterior) y lesionados"><Icon icon="ban" class="h-3 w-3 text-red-600" />No disponibles</span>
      <span class="inline-flex items-center gap-1.5" title="Partidos jugados: verde si se ganó, amarillo si se empató y rojo si se perdió, con el marcador">
        <span class="inline-flex overflow-hidden rounded text-[9px] font-bold leading-none">
          <span v-for="r in legendResults" :key="r" class="grid h-3.5 w-3.5 place-items-center" :class="resultStyle[r].solid">{{ outcomeLabels[r] }}</span>
        </span>
        Ganado, empatado o perdido
      </span>
      <span class="hidden items-center gap-1.5 sm:inline-flex"><Icon icon="calendar-day" class="h-3 w-3" />Pulsa el número de un día para verlo por horas</span>
    </p>
  </div>
</template>
