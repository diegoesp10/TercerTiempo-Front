<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import BallIcon from '@/components/ui/BallIcon.vue';
import BrandMark from '@/components/layout/BrandMark.vue';
import CardIcon from '@/components/ui/CardIcon.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import GoalMarks from '@/components/sheet/GoalMarks.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { OfficialLineDto, OfficialSheetDto, OfficialTeamSheetDto } from '@/types/api';
import { formatKickoff, officialEventLabels, sheetSourceLabel } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';
import PlayerName from '@/components/players/PlayerName.vue';

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

/** "90'", "48' (sale 48')" para un titular sustituido o expulsado, "32' (entra 58')" para un suplente. */
const minutes = (line: OfficialLineDto) => {
  if (!line.played) return '—';
  const detail = line.started
    ? line.minuteOut !== null ? ` (sale ${line.minuteOut}')` : ''
    : ` (entra ${line.minuteIn}'${line.minuteOut !== null ? `, sale ${line.minuteOut}'` : ''})`;
  return `${line.minutesPlayed}'${detail}`;
};

</script>

<template>
  <section class="card">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900">Acta pública</h2>
        <p class="text-xs text-slate-500">
          <template v-if="sheet?.status === 'Available'">
            Acta guardada en Tercer Tiempo · fuente: {{ sheetSourceLabel(sheet.provider) }}<template v-if="sheet.referee"> · árbitro: {{ sheet.referee }}</template><template v-if="sheet.fetchedAt"> · descargada el {{ formatKickoff(sheet.fetchedAt) }}</template>
          </template>
          <template v-else>Alineaciones, minutos, goles y tarjetas publicados tras el partido por la federación.</template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <a v-if="sheet?.sourceUrl" :href="sheet.sourceUrl" target="_blank" rel="noopener" class="text-sm text-accent-400 hover:underline">Ver en {{ sheetSourceLabel(sheet.provider) }}</a>
        <button type="button" class="btn-ghost px-3 py-1 text-xs" v-busy="loading" :disabled="loading" @click="load()">{{ loading ? 'Consultando…' : 'Consultar datos guardados' }}</button>
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
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div v-for="team in teams" :key="team.side" class="rounded-xl border p-4" :class="highlightTeamId && team.teamId === highlightTeamId ? 'border-accent-400/40 bg-brand-500/10' : 'border-slate-200'">
            <div class="mb-2 flex items-center justify-between gap-2">
              <h3 class="min-w-0 font-semibold text-slate-900"><TeamName :name="team.teamName" :team-id="team.teamId" size="sm" /></h3>
              <span v-if="team.goals !== null" class="text-xl font-bold tabular-nums text-slate-900">{{ team.goals }}</span>
            </div>
            <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="py-1 pr-2 text-left">#</th>
                  <th class="py-1 pr-2 text-left">Jugador</th>
                  <th class="py-1 pr-2 text-center" title="Minutos jugados (entrada → salida)">Min</th>
                  <th class="py-1 pr-2 text-center">G</th>
                  <th class="py-1 text-center">TA/TR</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="line in [...team.starters, ...team.bench]" :key="line.id" :class="line.played ? '' : 'text-slate-400'">
                  <td class="py-1 pr-2 tabular-nums text-slate-500">{{ line.shirtNumber ?? '—' }}</td>
                  <td class="py-1 pr-2">
                    <PlayerName :name="line.fullName" class="font-medium" :class="line.played ? 'text-slate-800' : ''" />
                    <Badge v-if="line.started" class="ml-1">titular</Badge>
                  </td>
                  <td class="py-1 pr-2 text-center tabular-nums whitespace-nowrap">{{ minutes(line) }}</td>
                  <td class="py-1 pr-2 text-center whitespace-nowrap"><GoalMarks :goals="line.goals" :penalty-goals="line.penaltyGoals" :own-goals="line.ownGoals" /></td>
                  <td class="py-1 text-center whitespace-nowrap"><CardMarks :yellow-cards="line.yellowCards" :red-card="line.redCard" /></td>
                </tr>
              </tbody>
            </table>
            </div>
          </div>
        </div>

        <details v-if="sheet.events.length > 0" class="mt-4 text-sm">
          <summary class="cursor-pointer font-medium text-slate-700">Sucesos del partido ({{ sheet.events.length }})</summary>
          <ul class="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
            <li v-for="(event, index) in sheet.events" :key="index" class="flex items-center gap-2 text-slate-700">
              <span class="w-12 shrink-0 text-right tabular-nums text-slate-500">{{ event.minute }}'<template v-if="event.extraMinute">+{{ event.extraMinute }}</template></span>
              <span class="inline-flex w-14 shrink-0 items-center gap-0.5" :title="officialEventLabels[event.type]">
                <template v-if="event.type === 'Goal'"><BallIcon /></template>
                <template v-else-if="event.type === 'PenaltyGoal'"><BallIcon title="Gol de penalti" /><span class="text-xs text-slate-400">(p)</span></template>
                <template v-else-if="event.type === 'OwnGoal'"><BallIcon title="Gol en propia puerta" own-goal /><span class="text-xs text-slate-400">(pp)</span></template>
                <template v-else-if="event.type === 'YellowCard'"><CardIcon kind="yellow" /></template>
                <template v-else-if="event.type === 'SecondYellow'"><CardIcon kind="yellow" /><CardIcon kind="yellow" title="Segunda amarilla" /></template>
                <template v-else-if="event.type === 'RedCard'"><CardIcon kind="red" /></template>
                <Icon v-else icon="arrow-right-arrow-left" class="text-slate-400" />
              </span>
              <span>
                <PlayerName :name="event.playerName" /><template v-if="event.relatedPlayerName"> <span class="text-slate-400">por</span> <PlayerName :name="event.relatedPlayerName" /></template>
                <span class="text-xs text-slate-400"> · <TeamName
                  :name="(event.side === 'Home' ? sheet.home?.teamName : sheet.away?.teamName) ?? ''"
                  :team-id="event.side === 'Home' ? sheet.home?.teamId : sheet.away?.teamId"
                /></span>
              </span>
            </li>
          </ul>
        </details>
      </template>
    </template>
  </section>
</template>
