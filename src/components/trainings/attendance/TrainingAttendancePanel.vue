<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import TrainingPeriodFilter from '@/components/trainings/TrainingPeriodFilter.vue';
import Alert from '@/components/ui/Alert.vue';
import GroupByPositionToggle from '@/components/ui/GroupByPositionToggle.vue';
import ResponsiveTabs from '@/components/ui/ResponsiveTabs.vue';
import SearchCombobox, { type ComboboxOption } from '@/components/ui/SearchCombobox.vue';
import { useGroupByPosition } from '@/composables/usePositionGrouping';
import { useSort, type SortValue } from '@/composables/useSort';
import type { Position, SquadTrainingAttendanceDto } from '@/types/api';
import { formatDurationMinutes, positionLabels } from '@/utils/format';
import AttendanceDayGrid from './AttendanceDayGrid.vue';
import AttendanceDetailedTable from './AttendanceDetailedTable.vue';
import AttendancePlayerModal from './AttendancePlayerModal.vue';
import AttendanceSummary from './AttendanceSummary.vue';
import AttendanceWeekGrid from './AttendanceWeekGrid.vue';
import {
  buildDays,
  buildRow,
  buildWeeks,
  groupRows,
  matchesMissFilter,
  missFilters,
  outcomeCell,
  outcomeIcons,
  outcomeLabels,
  rateText,
  type AttendanceRow,
  type AttendanceViewKey,
  type MissFilter,
  type Outcome,
  type SortApi,
  type SortKey,
} from './attendance';

/**
 * Asistencia de la plantilla a los entrenamientos acabados del periodo, con cuatro vistas (resumida, ampliada, por
 * semana y por día) que comparten orden y un filtro de faltas, y la ficha de cada jugador en una ventana al pulsar su
 * nombre o al elegirlo en el buscador, que enseña las coincidencias en su propio desplegable sin tocar la lista.
 */
const props = defineProps<{
  squadId: string;
  photos?: Record<string, string | null>;
  positions?: Record<string, Position | null>;
  reloadKey?: number;
}>();

const from = ref<string | null>(null);
const to = ref<string | null>(null);
const data = ref<SquadTrainingAttendanceDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    data.value = await api.trainings.squadAttendance(props.squadId, { from: from.value, to: to.value });
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch([() => props.squadId, from, to, () => props.reloadKey], () => void load(), { immediate: true });

// La vista elegida se recuerda en este navegador.
const views: { key: AttendanceViewKey; label: string; icon: string; hint: string }[] = [
  { key: 'summary', label: 'Resumida', icon: 'chart-simple', hint: 'Una barra por jugador y lo más destacado' },
  { key: 'detailed', label: 'Ampliada', icon: 'table-list', hint: 'Todas las cifras de cada jugador' },
  { key: 'week', label: 'Por semana', icon: 'calendar-week', hint: 'Cuántos entrenamientos hizo cada uno, semana a semana' },
  { key: 'day', label: 'Por día', icon: 'calendar-days', hint: 'Cada entrenamiento, uno a uno' },
];
const VIEW_KEY = 'tt.attendance.view';
function storedView(): AttendanceViewKey {
  try {
    const value = localStorage.getItem(VIEW_KEY);
    return views.some((v) => v.key === value) ? (value as AttendanceViewKey) : 'summary';
  } catch {
    return 'summary';
  }
}
const view = ref<AttendanceViewKey>(storedView());
watch(view, (value) => {
  try {
    localStorage.setItem(VIEW_KEY, value);
  } catch {
    // Sin almacenamiento, la vista vuelve a la resumida al recargar.
  }
});

const days = computed(() => buildDays(data.value));
const weeks = computed(() => buildWeeks(days.value));
const allRows = computed(() => (data.value?.players ?? []).map((p) => buildRow(p, days.value)));

const getters: Record<SortKey, (r: AttendanceRow) => SortValue> = {
  name: (r) => r.name,
  sessions: (r) => r.player.sessions,
  attended: (r) => r.player.attended,
  missed: (r) => r.player.missed,
  warned: (r) => r.player.warned,
  rate: (r) => r.player.attendanceRate,
  minutes: (r) => r.player.attendedMinutes,
  injured: (r) => r.player.injured,
  lastMiss: (r) => (r.lastMiss ? r.lastMiss.date.getTime() : null),
};
// De partida por nombre, para que a igualdad en la columna elegida manden las letras.
const byName = computed(() => [...allRows.value].sort((a, b) => a.name.localeCompare(b.name, 'es')));
const { sorted, sortBy, state } = useSort<AttendanceRow, SortKey>(byName, getters, 'name', { desc: false, ascendingFirst: ['name'] });
const sort: SortApi = { by: sortBy, state };
// Los que ya no están van siempre al final; dentro de cada grupo, el orden elegido.
const ordered = computed(() => [...sorted.value.filter((r) => r.player.active), ...sorted.value.filter((r) => !r.player.active)]);

// El filtro de faltas filtra la lista de todas las vistas. El buscador no: lista las coincidencias en su desplegable.
const missFilter = ref<MissFilter>('all');
const missCounts = computed(
  () => Object.fromEntries(missFilters.map((f) => [f.key, ordered.value.filter((r) => matchesMissFilter(r, f.key)).length])) as Record<MissFilter, number>,
);
const shown = computed(() => ordered.value.filter((r) => matchesMissFilter(r, missFilter.value)));
const filtering = computed(() => missFilter.value !== 'all');
const emptyFilter = computed(() => missFilters.find((f) => f.key === missFilter.value)?.empty ?? '');

// Lo que sale en el desplegable del buscador: los que siguen primero; se encuentran también por la posición.
const finderOptions = computed<ComboboxOption[]>(() =>
  [...byName.value.filter((r) => r.player.active), ...byName.value.filter((r) => !r.player.active)].map((r) => {
    const position = props.positions?.[r.id] ?? null;
    const label = position ? positionLabels[position] : 'Sin posición';
    const rate = r.player.attendanceRate;
    return {
      value: r.id,
      label: r.name,
      hint: r.player.active ? `${label}${rate === null ? '' : ` · ${rate} %`}` : 'Ya no está en la plantilla',
      keywords: label,
      photo: props.photos?.[r.id] ?? null,
      muted: !r.player.active,
    };
  }),
);

// Agrupar por posición, como en el acta: cada grupo se pliega para ver solo lo que interesa. Filtrando, todo abierto.
const byPosition = useGroupByPosition('attendance');
const closed = ref<string[]>([]);
const groups = computed(() => groupRows(shown.value, props.positions ?? {}, byPosition.value, filtering.value ? [] : closed.value));
const allClosed = computed(() => groups.value.length > 0 && groups.value.every((g) => !g.open));
function toggle(key: string) {
  closed.value = closed.value.includes(key) ? closed.value.filter((k) => k !== key) : [...closed.value, key];
}
function toggleAll() {
  closed.value = allClosed.value ? [] : groups.value.map((g) => g.key);
}

// La ficha del jugador pulsado; se busca por id para que siga al día si cambia el periodo.
const selectedId = ref<string | null>(null);
const selected = computed(() => allRows.value.find((r) => r.id === selectedId.value) ?? null);
function pick(row: AttendanceRow) {
  selectedId.value = row.id;
}

// Cifras del equipo, siempre de toda la plantilla (el filtro de faltas no las cambia).
const kpis = computed(() => {
  const active = allRows.value.filter((r) => r.player.active);
  const counted = active.reduce((s, r) => s + r.player.sessions, 0);
  const attended = active.reduce((s, r) => s + r.player.attended, 0);
  const missed = allRows.value.reduce((s, r) => s + r.player.missed, 0);
  const warned = allRows.value.reduce((s, r) => s + r.player.warned, 0);
  const injuredRows = allRows.value.filter((r) => r.player.injured > 0);
  const low = active.filter((r) => r.player.attendanceRate !== null && r.player.attendanceRate < 60);
  const perfect = active.filter((r) => r.player.attendanceRate === 100);
  return {
    rate: counted ? Math.round((attended * 100) / counted) : null,
    counted,
    attended,
    missed,
    warned,
    injuredPlayers: injuredRows.length,
    injuredSessions: injuredRows.reduce((s, r) => s + r.player.injured, 0),
    low,
    perfect,
  };
});

const legend: Outcome[] = ['Attended', 'Warned', 'Missed', 'Injured'];
const names = (rows: AttendanceRow[]) => rows.map((r) => r.name).join(', ');
</script>

<template>
  <section class="card">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="calendar-check" class="h-4 w-4 text-accent-400" />Asistencia a los entrenamientos</h3>
        <p class="text-xs text-slate-500">
          Solo cuentan los entrenamientos ya acabados y, de cada jugador, los que le tocaban (estaba en la plantilla). Los que se perdió lesionado van
          aparte y no cuentan como faltas.
        </p>
      </div>
      <p v-if="data" class="shrink-0 text-sm text-slate-700">
        <strong class="tabular-nums">{{ data.sessions }}</strong> {{ data.sessions === 1 ? 'entrenamiento' : 'entrenamientos' }} ·
        <strong>{{ formatDurationMinutes(data.minutes) }}</strong> en total
      </p>
    </div>

    <TrainingPeriodFilter v-model:from="from" v-model:to="to" class="mb-4" />

    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <p v-else-if="loading && !data" class="text-sm text-slate-500">Cargando…</p>
    <p v-else-if="allRows.length === 0" class="text-sm text-slate-500">No hay jugadores en la plantilla.</p>

    <div v-else :class="loading ? 'is-refreshing' : ''">
      <!-- Cifras del equipo -->
      <dl class="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
        <div class="bg-surface px-4 py-3">
          <dt class="eyebrow text-slate-500">Asistencia del equipo</dt>
          <dd class="mt-1 font-figures text-2xl font-bold" :class="rateText(kpis.rate)">{{ kpis.rate === null ? '—' : `${kpis.rate} %` }}</dd>
          <dd class="text-xs text-slate-500">{{ kpis.attended }} asistencias de {{ kpis.counted }} posibles</dd>
        </div>
        <div class="bg-surface px-4 py-3">
          <dt class="eyebrow text-slate-500">Entrenamientos</dt>
          <dd class="mt-1 font-figures text-2xl font-bold text-slate-900">{{ data?.sessions ?? 0 }}</dd>
          <dd class="text-xs text-slate-500">{{ formatDurationMinutes(data?.minutes ?? 0) }} en total</dd>
        </div>
        <div class="bg-surface px-4 py-3">
          <dt class="eyebrow text-slate-500">Faltas</dt>
          <dd class="mt-1 font-figures text-2xl font-bold text-slate-900">{{ kpis.missed }}</dd>
          <dd class="text-xs text-slate-500">{{ kpis.warned }} avisando · {{ kpis.missed - kpis.warned }} sin avisar</dd>
        </div>
        <div class="bg-surface px-4 py-3">
          <dt class="eyebrow text-slate-500">Lesionados</dt>
          <dd class="mt-1 font-figures text-2xl font-bold text-slate-900">{{ kpis.injuredPlayers }}</dd>
          <dd class="text-xs text-slate-500">{{ kpis.injuredSessions }} {{ kpis.injuredSessions === 1 ? 'entrenamiento perdido' : 'entrenamientos perdidos' }}</dd>
        </div>
        <div class="col-span-2 bg-surface px-4 py-3 sm:col-span-1">
          <dt class="eyebrow text-slate-500">Por debajo del 60 %</dt>
          <dd class="mt-1 font-figures text-2xl font-bold" :class="kpis.low.length ? 'text-red-600' : 'text-emerald-600'">{{ kpis.low.length }}</dd>
          <dd class="break-words text-xs text-slate-500">
            {{ kpis.low.length ? names(kpis.low) : `${kpis.perfect.length} con el 100 %` }}
          </dd>
        </div>
      </dl>

      <!-- Buscador y vistas -->
      <div class="mb-3 flex flex-wrap items-center gap-2">
        <SearchCombobox
          id="attendance"
          class="min-w-0 flex-1 basis-56"
          :options="finderOptions"
          placeholder="Buscar jugador: escribe y elígelo en la lista"
          aria-label="Buscar jugador"
          empty-label="Ningún jugador de la plantilla coincide con"
          @pick="selectedId = $event"
        />
        <GroupByPositionToggle v-model="byPosition" />
        <button
          v-if="byPosition && !filtering"
          type="button"
          class="btn-ghost shrink-0 px-2.5 py-1.5 text-xs"
          :title="allClosed ? 'Abrir todos los grupos' : 'Plegar todos los grupos y ver solo las cabeceras'"
          @click="toggleAll"
        >
          <Icon :icon="allClosed ? 'angles-down' : 'angles-up'" class="mr-1 h-3 w-3" />{{ allClosed ? 'Desplegar' : 'Plegar' }}
        </button>
        <ResponsiveTabs
          :items="views.map((v) => ({ key: v.key, label: v.label, icon: v.icon, title: v.hint }))"
          :model-value="view"
          label="Vista de la asistencia"
          variant="segmented"
          @update:model-value="(key) => (view = key as AttendanceViewKey)"
        />
      </div>

      <!-- Filtro de faltas a la izquierda; la leyenda de las casillas a la derecha -->
      <div class="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div class="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por faltas">
          <button
            v-for="f in missFilters"
            :key="f.key"
            type="button"
            class="flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
            :class="missFilter === f.key ? 'border-action bg-action text-white' : 'border-line text-slate-600 hover:bg-surface-2'"
            :aria-pressed="missFilter === f.key"
            :disabled="f.key !== 'all' && missCounts[f.key] === 0 && missFilter !== f.key"
            :title="f.key !== 'all' && missCounts[f.key] === 0 ? f.empty : f.hint"
            @click="missFilter = missFilter === f.key ? 'all' : f.key"
          >
            <Icon :icon="f.icon" class="h-3 w-3" />{{ f.label }}
            <span class="tabular-nums opacity-70">{{ missCounts[f.key] }}</span>
          </button>
        </div>
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
          <span v-for="o in legend" :key="o" class="flex items-center gap-1.5">
            <span class="grid h-4 w-4 place-items-center rounded ring-1 ring-inset" :class="outcomeCell[o]"><Icon :icon="outcomeIcons[o]" class="h-2.5 w-2.5" /></span>
            {{ outcomeLabels[o] }}
          </span>
        </div>
      </div>

      <p v-if="data && data.sessions === 0" class="rounded-lg bg-surface-2 px-4 py-6 text-center text-sm text-slate-500">
        Todavía no hay entrenamientos acabados en este periodo.
      </p>
      <p v-else-if="shown.length === 0" class="rounded-lg bg-surface-2 px-4 py-6 text-center text-sm text-slate-500">
        {{ emptyFilter }}
      </p>
      <template v-else>
        <AttendanceSummary v-if="view === 'summary'" :groups="groups" :all="allRows" :sort="sort" :filter="missFilter" @pick="pick" @toggle="toggle" />
        <AttendanceDetailedTable v-else-if="view === 'detailed'" :groups="groups" :sort="sort" :photos="photos" :filter="missFilter" @pick="pick" @toggle="toggle" />
        <AttendanceWeekGrid v-else-if="view === 'week'" :groups="groups" :all="allRows" :weeks="weeks" :sort="sort" @pick="pick" @toggle="toggle" />
        <AttendanceDayGrid v-else :groups="groups" :all="allRows" :days="days" :weeks="weeks" :sort="sort" @pick="pick" @toggle="toggle" />
      </template>
    </div>

    <AttendancePlayerModal :row="selected" :days="days" :squad-id="squadId" :photo-url="selected ? (photos?.[selected.id] ?? null) : null" @close="selectedId = null" />
  </section>
</template>
