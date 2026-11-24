<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import BallIcon from '@/components/ui/BallIcon.vue';
import BrandMark from '@/components/layout/BrandMark.vue';
import CardIcon from '@/components/ui/CardIcon.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import GoalMarks from '@/components/sheet/GoalMarks.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useSort, type SortValue } from '@/composables/useSort';
import type { OfficialLineDto, OfficialSheetDto, OfficialTeamSheetDto } from '@/types/api';
import { officialEventLabels, sheetSourceLabel } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';
import PlayerName from '@/components/players/PlayerName.vue';
import SheetReferees from '@/components/sheet/SheetReferees.vue';
import { httpUrl } from '@/utils/links';

const props = defineProps<{
  matchId: string;
  /** Acta ya cargada por el padre (comparador); si no se pasa, el panel la pide por su cuenta. */
  sheet?: OfficialSheetDto | null;
  /** Equipo que se resalta (el de la plantilla). */
  highlightTeamId?: string | null;
}>();

const emit = defineEmits<{ refreshed: [sheet: OfficialSheetDto] }>();

const own = shallowRef<OfficialSheetDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

const sheet = computed(() => props.sheet ?? own.value);

let inFlight = false;
let disposed = false;
let reloadAfterFlight = false;
async function load(quiet = false) {
  if (disposed) return;
  if (inFlight) { reloadAfterFlight = true; return; }
  inFlight = true;
  const matchId = props.matchId;
  if (!quiet) loading.value = true;
  error.value = null;
  try {
    const result = await api.matches.officialSheet(matchId);
    if (disposed || props.matchId !== matchId) return;
    own.value = result;
    emit('refreshed', result);
  } catch (e) {
    if (!disposed && props.matchId === matchId) error.value = errorMessage(e);
  } finally {
    inFlight = false;
    loading.value = false;
    if (!disposed && reloadAfterFlight) { reloadAfterFlight = false; void load(); }
    else if (!disposed) schedule();
  }
}

// Estas consultas solo leen nuestra base de datos. Nunca fuerzan una descarga de las webs de actas.
let timer: ReturnType<typeof setTimeout> | null = null;
let fetchingPolls = 0;
function schedule() {
  if (timer) clearTimeout(timer);
  timer = null;
  if (sheet.value?.status === 'Fetching' && fetchingPolls < 24) {
    timer = setTimeout(() => { fetchingPolls += 1; void load(true); }, 5_000);
  }
  if (sheet.value?.status !== 'Fetching') fetchingPolls = 0;
}
watch(sheet, schedule, { immediate: true });
onBeforeUnmount(() => { disposed = true; if (timer) clearTimeout(timer); });

watch(() => props.matchId, () => { fetchingPolls = 0; own.value = null; if (props.sheet === undefined) void load(); }, { immediate: true });

const teams = computed(() => (sheet.value ? [sheet.value.home, sheet.value.away].filter((t): t is OfficialTeamSheetDto => t !== null) : []));

/** Acta sin cerrar: solo valen las alineaciones; los minutos, goles y tarjetas todavía no están en la federación. */
const provisional = computed(() => sheet.value?.status === 'Provisional');
/** Con alineaciones: el equipo arbitral va junto a ellas; si no, debajo del aviso del estado del acta. */
const withLineups = computed(() => sheet.value?.status === 'Available' || sheet.value?.status === 'Provisional');

/** "90'", "48' (sale 48')" para un titular sustituido o expulsado, "32' (entra 58')" para un suplente. */
const minutes = (line: OfficialLineDto) => (line.played ? `${line.minutesPlayed}'` : '—');
// Entrada y salida, debajo de los minutos (en una línea aparte para que la tabla quepa en el móvil).
const substitution = (line: OfficialLineDto) => {
  if (!line.played) return [];
  const changes = line.started ? [] : [`entra ${line.minuteIn}'`];
  if (line.minuteOut !== null) changes.push(`sale ${line.minuteOut}'`);
  return changes;
};
interface LineRow { line: OfficialLineDto; starter: boolean; order: number }
const lineRows = (team: OfficialTeamSheetDto | null | undefined): LineRow[] =>
  team ? [...team.starters, ...team.bench].map((line, order) => ({ line, starter: order < team.starters.length, order })) : [];

// `lineup` no tiene columna: es el orden del acta (por dorsal, que no se muestra) y el de partida.
type LineSortKey = 'lineup' | 'player' | 'minutes' | 'goals' | 'cards';
const lineGetters: Record<LineSortKey, (r: LineRow) => SortValue> = {
  lineup: (r) => r.order,
  player: (r) => r.line.fullName,
  minutes: (r) => (r.line.played ? r.line.minutesPlayed : null),
  goals: (r) => r.line.goals + r.line.penaltyGoals,
  cards: (r) => (r.line.redCard ? 10 : 0) + r.line.yellowCards,
};
const homeRows = computed(() => lineRows(sheet.value?.home));
const awayRows = computed(() => lineRows(sheet.value?.away));
const lineSorts = reactive({
  Home: useSort<LineRow, LineSortKey>(homeRows, lineGetters, 'lineup', { desc: false, ascendingFirst: ['lineup', 'player'] }),
  Away: useSort<LineRow, LineSortKey>(awayRows, lineGetters, 'lineup', { desc: false, ascendingFirst: ['lineup', 'player'] }),
});

// Titulares y suplentes por separado, como en una alineación (sin una etiqueta «titular» en cada fila); se ordena
// dentro de cada grupo.
const groups = (team: OfficialTeamSheetDto) => {
  const rows = lineSorts[team.side].sorted;
  return [
    { label: 'Titulares', lines: rows.filter((r) => r.starter).map((r) => r.line) },
    { label: 'Suplentes', lines: rows.filter((r) => !r.starter).map((r) => r.line) },
  ].filter((group) => group.lines.length > 0);
};

</script>

<template>
  <section class="card">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900">Acta pública</h2>
        <p class="text-xs text-slate-500">
          <template v-if="sheet?.status === 'Available' || sheet?.status === 'Provisional'">
            {{ provisional ? 'Acta provisional guardada' : 'Acta guardada' }} en Tercer Tiempo · fuente: {{ sheetSourceLabel(sheet.provider) }}
          </template>
          <template v-else>Alineaciones, minutos, goles y tarjetas publicados tras el partido por la federación.</template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a v-if="sheet && httpUrl(sheet.sourceUrl)" :href="httpUrl(sheet.sourceUrl) ?? undefined" target="_blank" rel="noopener" class="text-sm text-accent-400 hover:underline">Ver en {{ sheetSourceLabel(sheet.provider) }}</a>
      </div>
    </div>

    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>

    <Spinner v-if="loading && !sheet" />

    <template v-else-if="sheet">
      <Alert v-if="sheet.status === 'NotPlayed'" kind="info">Todavía no se ha jugado: el acta pública aparecerá cuando se publique tras el partido.</Alert>

      <div v-else-if="sheet.status === 'Pending'" class="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden="true"></span>
        <span>{{ sheet.message ?? 'El acta guardada sigue pendiente. El sistema comprobará si hay datos nuevos respetando los límites de descarga.' }}</span>
      </div>

      <div v-else-if="sheet.status === 'Fetching'" class="flex items-center gap-3 rounded-lg border border-line bg-surface-2 px-4 py-3 text-sm text-slate-700">
        <BrandMark :size="24" animated class="shrink-0" />
        <span>{{ sheet.message ?? 'El acta aún no está guardada; su descarga está en cola.' }} Esta pantalla consulta los datos guardados sin forzar nuevas descargas.</span>
      </div>
      <Alert v-else-if="sheet.status === 'Unavailable'" kind="warning">{{ sheet.message ?? 'No se ha encontrado este partido en ninguna web de actas.' }}</Alert>

      <template v-else>
        <div v-if="provisional" class="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Acta sin cerrar.</strong> {{ sheet.message ?? 'La federación ya ha publicado las alineaciones, pero el árbitro aún no ha cerrado el acta: faltan los goles, los cambios y las tarjetas.' }}
        </div>
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div v-for="team in teams" :key="team.side" class="rounded-xl border p-4" :class="highlightTeamId && team.teamId === highlightTeamId ? 'border-accent-400/40 bg-brand-500/10' : 'border-slate-200'">
            <div class="mb-2 flex items-center justify-between gap-2">
              <h3 class="min-w-0 font-semibold text-slate-900"><TeamName :name="team.teamName" :team-id="team.teamId" size="sm" /></h3>
              <span v-if="team.goals !== null" class="text-xl font-bold tabular-nums text-slate-900">{{ team.goals }}</span>
            </div>
            <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-xs text-slate-500">
                <tr>
                  <SortHeader class="py-1 pr-2 text-left" label="Jugador" v-bind="lineSorts[team.side].state('player')" @sort="lineSorts[team.side].sortBy('player')" />
                  <template v-if="!provisional">
                    <SortHeader class="py-1 pr-2 text-center" label="Min" title="Minutos jugados (entrada → salida)" v-bind="lineSorts[team.side].state('minutes')" @sort="lineSorts[team.side].sortBy('minutes')" />
                    <SortHeader class="py-1 pr-2 text-center" label="G" title="Goles" v-bind="lineSorts[team.side].state('goals')" @sort="lineSorts[team.side].sortBy('goals')" />
                    <SortHeader class="py-1 text-center" label="TA/TR" title="Tarjetas (la roja pesa más)" v-bind="lineSorts[team.side].state('cards')" @sort="lineSorts[team.side].sortBy('cards')" />
                  </template>
                </tr>
              </thead>
              <tbody v-for="group in groups(team)" :key="group.label" class="divide-y divide-slate-100">
                <tr>
                  <td :colspan="provisional ? 1 : 4" class="pb-1 pt-3 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{{ group.label }}</td>
                </tr>
                <tr v-for="line in group.lines" :key="line.id" :class="line.played || provisional ? '' : 'text-slate-400'">
                  <!-- w-full + max-w-0: el nombre ocupa lo que sobra y se recorta en vez de ensanchar la tabla en el móvil -->
                  <td class="w-full max-w-0 py-1 pr-2">
                    <PlayerName :name="line.fullName" class="font-medium" :class="line.played || provisional ? 'text-slate-800' : ''" />
                  </td>
                  <template v-if="!provisional">
                    <td class="py-1 pr-2 text-center tabular-nums whitespace-nowrap">
                      {{ minutes(line) }}
                      <span v-for="change in substitution(line)" :key="change" class="block text-[11px] leading-tight text-slate-500">{{ change }}</span>
                    </td>
                    <td class="py-1 pr-2 text-center whitespace-nowrap"><GoalMarks :goals="line.goals" :penalty-goals="line.penaltyGoals" :own-goals="line.ownGoals" /></td>
                    <td class="py-1 text-center whitespace-nowrap"><CardMarks :yellow-cards="line.yellowCards" :red-card="line.redCard" /></td>
                  </template>
                </tr>
              </tbody>
            </table>
            </div>
            <div v-if="team.staff?.length" class="mt-3 border-t border-line pt-2">
              <p class="pb-1 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Cuerpo técnico</p>
              <ul class="space-y-1 text-sm">
                <li v-for="person in team.staff" :key="person.fullName" class="flex flex-wrap items-baseline gap-x-2">
                  <span class="w-28 shrink-0 text-xs text-slate-500">{{ person.roleLabel }}</span>
                  <RouterLink v-if="person.coachId" :to="{ name: 'coach', params: { coachId: person.coachId } }" class="min-w-0 break-words font-medium text-slate-800 hover:text-accent-400" title="Ver su perfil">{{ person.fullName }}</RouterLink>
                  <span v-else class="min-w-0 break-words font-medium text-slate-800">{{ person.fullName }}</span>
                  <!-- Al cuerpo técnico también le enseña tarjetas el árbitro: van en la misma lista que las de los jugadores. -->
                  <CardMarks class="self-center" :yellow-cards="person.yellowCards ?? 0" :red-card="person.redCard ?? false" />
                </li>
              </ul>
            </div>
          </div>
        </div>

        <SheetReferees v-if="sheet.referees" :referees="sheet.referees" class="mt-4" />

        <details v-if="sheet.events.length > 0" class="mt-4 text-sm">
          <summary class="cursor-pointer font-medium text-slate-700">Sucesos del partido ({{ sheet.events.length }})</summary>
          <ul class="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            <li v-for="(event, index) in sheet.events" :key="index" class="flex items-center gap-2 text-slate-700">
              <span class="w-10 shrink-0 text-right tabular-nums text-slate-500 sm:w-12">{{ event.minute }}'<template v-if="event.extraMinute">+{{ event.extraMinute }}</template></span>
              <span class="inline-flex w-10 shrink-0 items-center gap-0.5 sm:w-14" :title="officialEventLabels[event.type]">
                <template v-if="event.type === 'Goal'"><BallIcon /></template>
                <template v-else-if="event.type === 'PenaltyGoal'"><BallIcon title="Gol de penalti" /><span class="text-xs text-slate-400">(p)</span></template>
                <template v-else-if="event.type === 'OwnGoal'"><BallIcon title="Gol en propia puerta" own-goal /><span class="text-xs text-slate-400">(pp)</span></template>
                <template v-else-if="event.type === 'YellowCard'"><CardIcon kind="yellow" /></template>
                <template v-else-if="event.type === 'SecondYellow'"><CardIcon kind="yellow" /><CardIcon kind="yellow" title="Segunda amarilla" /></template>
                <template v-else-if="event.type === 'RedCard'"><CardIcon kind="red" /></template>
                <Icon v-else icon="arrow-right-arrow-left" class="text-slate-400" />
              </span>
              <span class="min-w-0 flex-1">
                <PlayerName :name="event.playerName" /><template v-if="event.relatedPlayerName"><span class="mx-2 text-slate-400">por</span><PlayerName :name="event.relatedPlayerName" /></template>
                <span class="text-xs text-slate-400"> · <TeamName
                  :name="(event.side === 'Home' ? sheet.home?.teamName : sheet.away?.teamName) ?? ''"
                  :team-id="event.side === 'Home' ? sheet.home?.teamId : sheet.away?.teamId"
                /></span>
              </span>
            </li>
          </ul>
        </details>
      </template>

      <!-- Sin alineaciones (por jugar, pendiente o sin acta): el equipo arbitral designado o el que se sabe. -->
      <SheetReferees v-if="!withLineups && sheet.referees" :referees="sheet.referees" class="mt-4" />
    </template>
  </section>
</template>
