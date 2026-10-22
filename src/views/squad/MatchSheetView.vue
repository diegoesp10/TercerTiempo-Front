<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import SheetComparison from '@/components/sheet/SheetComparison.vue';
import MatchPreview from '@/components/matches/MatchPreview.vue';
import MatchVideos from '@/components/videos/MatchVideos.vue';
import SuggestPerformanceModal from '@/components/suggestions/SuggestPerformanceModal.vue';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import CardIcon from '@/components/ui/CardIcon.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import type { MatchSheetDto, MatchSheetEntryInput, SquadPlayerDto, SuggestionDto } from '@/types/api';
import { formatKickoff, matchStatusLabels, opponentLabel, outcomeFor, outcomeLabels, outcomeTone, positionShortLabels, suggestionStatusLabels, suggestionStatusTone } from '@/utils/format';

const props = defineProps<{ squadId: string; matchId: string }>();

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const { data, loading, error } = useAsync(() => api.squads.sheet(props.squadId, props.matchId));

type Tab = 'acta' | 'comparador' | 'video' | 'previa';
const tabs: { id: Tab; label: string }[] = [
  { id: 'acta', label: 'Acta interna' },
  { id: 'comparador', label: 'Comparador con la federación' },
  { id: 'video', label: 'Vídeo' },
  { id: 'previa', label: 'Previa y rival' },
];
const tab = computed<Tab>(() =>
  route.query.tab === 'comparador' || route.query.tab === 'video' || route.query.tab === 'previa' ? route.query.tab : 'acta',
);
const selectTab = (id: Tab) => void router.replace({ query: { ...route.query, tab: id === 'acta' ? undefined : id } });

interface Row extends MatchSheetEntryInput {
  player: SquadPlayerDto;
  /** Nota calculada por la API al guardar (solo lectura). */
  rating: number | null;
}

const blank = (player: SquadPlayerDto): Row => ({
  player,
  squadPlayerId: player.id,
  played: false,
  started: false,
  minutesPlayed: 0,
  goals: 0,
  assists: 0,
  shots: 0,
  shotsOnTarget: 0,
  keyPasses: 0,
  tackles: 0,
  interceptions: 0,
  saves: 0,
  yellowCards: 0,
  redCard: false,
  rating: null,
  notes: null,
  shirtNumber: null,
});

const fromSheet = (sheet: MatchSheetDto): Row[] =>
  sheet.entries.map(({ player, performance }) =>
    performance
      ? {
          ...blank(player),
          played: true,
          started: performance.started,
          minutesPlayed: performance.minutesPlayed,
          goals: performance.goals,
          assists: performance.assists,
          shots: performance.shots,
          shotsOnTarget: performance.shotsOnTarget,
          keyPasses: performance.keyPasses,
          tackles: performance.tackles,
          interceptions: performance.interceptions,
          saves: performance.saves,
          yellowCards: performance.yellowCards,
          redCard: performance.redCard,
          rating: performance.rating,
          notes: performance.notes,
          shirtNumber: performance.matchShirtNumber,
        }
      : blank(player),
  );

const toEntry = (row: Row): MatchSheetEntryInput => ({
  squadPlayerId: row.squadPlayerId,
  played: row.played,
  started: row.started,
  minutesPlayed: row.minutesPlayed,
  goals: row.goals,
  assists: row.assists,
  shots: row.shots,
  shotsOnTarget: row.shotsOnTarget,
  keyPasses: row.keyPasses,
  tackles: row.tackles,
  interceptions: row.interceptions,
  saves: row.saves,
  yellowCards: row.yellowCards,
  redCard: row.redCard,
  notes: row.notes?.trim() ? row.notes.trim() : null,
  shirtNumber: row.shirtNumber || null,
});

const rows = ref<Row[]>([]);
watch(data, (sheet) => { if (sheet) rows.value = fromSheet(sheet); }, { immediate: true });

const canEdit = computed(() => data.value?.canEdit ?? false);
const teamId = computed(() => data.value?.squad.teamId ?? '');

// Jugador vinculado a esta plantilla: puede proponer su línea (corregirla o crearla) y ver qué pasó con lo que envió.
const myEntryId = computed(() => (auth.playerSquad?.squadId === props.squadId ? auth.playerSquad.squadPlayerId : null));
const myPerformance = computed(() => data.value?.entries.find((e) => e.player.id === myEntryId.value)?.performance ?? null);
const canSuggest = computed(() => myEntryId.value !== null && !canEdit.value && data.value?.match.status === 'Played');
const mySuggestions = ref<SuggestionDto[]>([]);
const suggesting = ref(false);
const sentNotice = ref(false);
watch(canSuggest, async (can) => {
  if (!can) return;
  try {
    mySuggestions.value = (await api.players.suggestions()).filter((s) => s.match.id === props.matchId);
  } catch { /* sin lista de sugerencias no pasa nada: el botón sigue disponible */ }
}, { immediate: true });
const pendingSuggestion = computed(() => mySuggestions.value.find((s) => s.status === 'Pending') ?? null);
const lastResolved = computed(() => mySuggestions.value.find((s) => s.status !== 'Pending') ?? null);
function onSuggestionSent(suggestion: SuggestionDto) {
  mySuggestions.value = [suggestion, ...mySuggestions.value];
  suggesting.value = false;
  sentNotice.value = true;
}
const playedRows = computed(() => rows.value.filter((r) => r.played));
const outcome = computed(() => (data.value ? outcomeFor(data.value.match, teamId.value) : null));

/** Al marcar «jugó» proponemos 90 minutos como titular; al desmarcar se conservan los valores por si se vuelve a marcar. */
function onPlayedChange(row: Row) {
  if (row.played && row.minutesPlayed === 0) {
    row.minutesPlayed = 90;
    row.started = true;
  }
}

function everyoneFullMatch() {
  for (const row of rows.value) {
    row.played = true;
    row.started = true;
    row.minutesPlayed = 90;
  }
}

function reset() {
  if (data.value) rows.value = fromSheet(data.value);
  saved.value = false;
  saveError.value = null;
  lineErrors.value = [];
}

const saving = ref(false);
const saved = ref(false);
const saveError = ref<string | null>(null);
const lineErrors = ref<string[]>([]);

async function save() {
  saving.value = true;
  saved.value = false;
  saveError.value = null;
  lineErrors.value = [];
  try {
    const result = await api.squads.recordSheet(props.squadId, props.matchId, rows.value.map(toEntry));
    data.value = result;
    rows.value = fromSheet(result);
    saved.value = true;
  } catch (e) {
    saveError.value = errorMessage(e);
    if (e instanceof ApiError) {
      lineErrors.value = Object.entries(e.fieldErrors).flatMap(([field, messages]) => {
        const index = /entries\[(\d+)\]/i.exec(field)?.[1];
        const who = index !== undefined ? rows.value[Number(index)]?.player.fullName : null;
        return messages.map((message) => (who ? `${who}: ${message}` : message));
      });
    }
  } finally {
    saving.value = false;
  }
}

const numericColumns: { key: keyof Pick<Row, 'goals' | 'assists' | 'shots' | 'shotsOnTarget' | 'keyPasses' | 'tackles' | 'interceptions' | 'saves'>; label: string; title: string }[] = [
  { key: 'goals', label: 'G', title: 'Goles' },
  { key: 'assists', label: 'A', title: 'Asistencias' },
  { key: 'shots', label: 'T', title: 'Tiros' },
  { key: 'shotsOnTarget', label: 'TP', title: 'Tiros a puerta' },
  { key: 'keyPasses', label: 'PC', title: 'Pases clave' },
  { key: 'tackles', label: 'Ent', title: 'Entradas' },
  { key: 'interceptions', label: 'Int', title: 'Intercepciones' },
  { key: 'saves', label: 'Par', title: 'Paradas' },
];
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <RouterLink :to="{ name: 'squad-matches', params: { squadId } }" class="text-sm text-slate-500 hover:text-slate-800">
      ← Partidos de {{ data.squad.teamName }}
    </RouterLink>

    <div class="card mt-3">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Jornada {{ data.match.matchday }} · {{ formatKickoff(data.match.kickoffAt) }}<span v-if="data.match.venue"> · {{ data.match.venue }}</span></span>
        <span class="flex items-center gap-2">
          <Badge v-if="outcome" :tone="outcomeTone(outcome)">{{ outcomeLabels[outcome] }}</Badge>
          <Badge :tone="data.match.status === 'Played' ? 'slate' : 'blue'">{{ matchStatusLabels[data.match.status] }}</Badge>
          <RouterLink :to="{ name: 'match', params: { matchId: data.match.id } }" class="text-accent-400 hover:underline">Ver partido</RouterLink>
        </span>
      </div>
      <div class="mt-3 grid grid-cols-3 items-center text-center">
        <p class="text-lg font-semibold" :class="data.match.homeTeam.id === teamId ? 'text-emerald-700' : 'text-slate-900'">{{ data.match.homeTeam.name }}</p>
        <p class="text-3xl font-bold tabular-nums text-slate-900">
          <template v-if="data.match.status === 'Played'">{{ data.match.homeGoals }} - {{ data.match.awayGoals }}</template>
          <span v-else class="text-slate-300">vs</span>
        </p>
        <p class="text-lg font-semibold" :class="data.match.awayTeam.id === teamId ? 'text-emerald-700' : 'text-slate-900'">{{ data.match.awayTeam.name }}</p>
      </div>
    </div>

    <nav class="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200 whitespace-nowrap" aria-label="Secciones del partido">
      <button
        v-for="item in tabs"
        :key="item.id"
        type="button"
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition"
        :class="tab === item.id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'"
        @click="selectTab(item.id)"
      >
        {{ item.label }}
      </button>
    </nav>

    <div v-if="tab === 'comparador'" class="mt-6">
      <SheetComparison :squad-id="squadId" :match-id="matchId" />
    </div>

    <div v-else-if="tab === 'video'" class="mt-6">
      <MatchVideos :match-id="matchId" :upload-squad-id="squadId" :can-upload="data.canEdit || data.squad.myRole !== null || !!auth.club?.teams.some((team) => team.teamId === data!.squad.teamId)" />
    </div>


    <div v-else-if="tab === 'previa'" class="mt-6">
      <MatchPreview :match-id="matchId" :my-team-id="teamId" />
    </div>

    <section v-else class="mt-6">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-slate-900">Acta interna del partido</h2>
          <p class="text-xs text-slate-500">
            <template v-if="canEdit">Marca quién jugó y rellena su línea. {{ playedRows.length }} de {{ rows.length }} jugadores en el acta.</template>
            <template v-else>{{ playedRows.length }} jugadores en el acta.</template>
          </p>
        </div>
        <div v-if="canSuggest" class="flex flex-wrap items-center gap-2">
          <Badge v-if="pendingSuggestion" tone="amber">Sugerencia pendiente de revisión</Badge>
          <button v-else type="button" class="btn-secondary" @click="suggesting = true">
            <Icon icon="pen" class="mr-1.5 h-3.5 w-3.5" />{{ myPerformance ? 'Sugerir una corrección' : 'Sugerir mi línea' }}
          </button>
        </div>
        <div v-if="canEdit" class="flex flex-wrap gap-2">
          <button type="button" class="btn-ghost" v-busy="saving" :disabled="saving" @click="everyoneFullMatch">Todos 90'</button>
          <button type="button" class="btn-secondary" v-busy="saving" :disabled="saving" @click="reset">Deshacer cambios</button>
          <button type="button" class="btn-primary" v-busy="saving" :disabled="saving" @click="save">{{ saving ? 'Guardando…' : 'Guardar acta' }}</button>
        </div>
      </div>

      <Alert v-if="saveError" kind="error" class="mb-3">
        {{ saveError }}
        <ul v-if="lineErrors.length > 0" class="mt-1 list-disc pl-5">
          <li v-for="(line, index) in lineErrors" :key="index">{{ line }}</li>
        </ul>
      </Alert>
      <Alert v-if="saved" kind="success" class="mb-3">Acta guardada.</Alert>
      <Alert v-if="sentNotice" kind="success" class="mb-3">Sugerencia enviada: tu club o tu entrenador la verán con tu mensaje y decidirán si cambian el acta.</Alert>
      <Alert v-else-if="canSuggest && lastResolved && !pendingSuggestion" :kind="lastResolved.status === 'Approved' ? 'success' : 'info'" class="mb-3">
        Tu última sugerencia de este partido fue <strong>{{ suggestionStatusLabels[lastResolved.status].toLowerCase() }}</strong>
        <template v-if="lastResolved.resolvedBy"> por {{ lastResolved.resolvedBy }}</template><template v-if="lastResolved.resolutionNote">: “{{ lastResolved.resolutionNote }}”</template>.
        <Badge :tone="suggestionStatusTone[lastResolved.status]" class="ml-1">{{ suggestionStatusLabels[lastResolved.status] }}</Badge>
      </Alert>

      <p v-if="!canEdit && playedRows.length === 0" class="text-sm text-slate-500">El cuerpo técnico todavía no ha registrado el acta de este partido.</p>

      <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th v-if="canEdit" class="px-2 py-2 text-center" title="Jugó">Jugó</th>
              <th v-if="canEdit" class="px-2 py-2 text-center" title="Dorsal en este partido (vacío = el de la ficha)">Dorsal</th>
              <th class="px-3 py-2 text-left">Jugador</th>
              <th class="px-2 py-2 text-center" title="Titular">Tit</th>
              <th class="px-2 py-2 text-center" title="Minutos">Min</th>
              <th v-for="column in numericColumns" :key="column.key" class="px-2 py-2 text-center" :title="column.title">{{ column.label }}</th>
              <th class="px-2 py-2 text-center" title="Tarjetas amarillas">TA</th>
              <th class="px-2 py-2 text-center" title="Tarjeta roja">TR</th>
              <th class="px-2 py-2 text-center" title="Nota calculada con los datos al guardar">Nota</th>
              <th class="px-3 py-2 text-left">Notas</th>
            </tr>
          </thead>

          <tbody v-if="canEdit" class="divide-y divide-slate-100">
            <tr v-for="row in rows" :key="row.squadPlayerId" :class="row.played ? '' : 'text-slate-400'">
              <td class="px-2 py-1 text-center">
                <input v-model="row.played" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-accent-400" :aria-label="`${row.player.fullName} jugó`" @change="onPlayedChange(row)" />
              </td>
              <td class="px-2 py-1 text-center">
                <input
                  v-model.number="row.shirtNumber"
                  type="number"
                  min="1"
                  max="99"
                  class="input w-14 px-1 py-1 text-center"
                  :disabled="!row.played"
                  :placeholder="row.player.shirtNumber ? String(row.player.shirtNumber) : '—'"
                  aria-label="Dorsal en este partido"
                />
              </td>
              <td class="px-3 py-1 whitespace-nowrap">
                <span class="font-medium" :class="row.played ? 'text-slate-800' : ''">{{ row.player.fullName }}</span>
                <span v-if="row.player.position" class="ml-1 text-xs text-slate-400">{{ positionShortLabels[row.player.position] }}</span>
              </td>
              <td class="px-2 py-1 text-center">
                <input v-model="row.started" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-accent-400" :disabled="!row.played" aria-label="Titular" />
              </td>
              <td class="px-2 py-1 text-center">
                <input v-model.number="row.minutesPlayed" type="number" min="0" max="120" class="input w-16 px-1 py-1 text-center" :disabled="!row.played" aria-label="Minutos" />
              </td>
              <td v-for="column in numericColumns" :key="column.key" class="px-2 py-1 text-center">
                <input v-model.number="row[column.key]" type="number" min="0" class="input w-14 px-1 py-1 text-center" :disabled="!row.played" :aria-label="column.title" />
              </td>
              <td class="px-2 py-1 text-center">
                <input v-model.number="row.yellowCards" type="number" min="0" max="2" class="input w-14 px-1 py-1 text-center" :disabled="!row.played" aria-label="Amarillas" />
              </td>
              <td class="px-2 py-1 text-center">
                <input v-model="row.redCard" type="checkbox" class="h-4 w-4 rounded border-slate-300 text-red-600" :disabled="!row.played" aria-label="Roja" />
              </td>
              <td class="px-2 py-1 text-center">
                <RatingBadge v-if="row.played" :rating="row.rating" size="sm" />
              </td>
              <td class="px-3 py-1">
                <input v-model="row.notes" type="text" maxlength="1000" class="input min-w-40 px-2 py-1" :disabled="!row.played" placeholder="Opcional" aria-label="Notas" />
              </td>
            </tr>
          </tbody>

          <tbody v-else class="divide-y divide-slate-100">
            <tr v-for="row in playedRows" :key="row.squadPlayerId">
              <td class="px-3 py-2 whitespace-nowrap">
                <span v-if="row.shirtNumber ?? row.player.shirtNumber" class="mr-1 text-slate-400">{{ row.shirtNumber ?? row.player.shirtNumber }}</span>
                <span class="font-medium text-slate-800">{{ row.player.fullName }}</span>
                <span v-if="row.player.position" class="ml-1 text-xs text-slate-400">{{ positionShortLabels[row.player.position] }}</span>
              </td>
              <td class="px-2 py-2 text-center">{{ row.started ? '●' : '' }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ row.minutesPlayed }}</td>
              <td v-for="column in numericColumns" :key="column.key" class="px-2 py-2 text-center tabular-nums">{{ row[column.key] }}</td>
              <td class="px-2 py-2 text-center"><CardMarks :yellow-cards="row.yellowCards" :red-card="false" /></td>
              <td class="px-2 py-2 text-center"><CardIcon v-if="row.redCard" kind="red" /></td>
              <td class="px-2 py-2 text-center"><RatingBadge :rating="row.rating" size="sm" /></td>
              <td class="px-3 py-2 text-slate-600">{{ row.notes ?? '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="content-note mt-3">
        Tit = titular · Min = minutos (0-120) · G goles · A asistencias · T tiros · TP tiros a puerta · PC pases clave · Ent entradas ·
        Int intercepciones · Par paradas · TA amarillas (dos implican roja). Con «jugó» desmarcado la línea se elimina del acta al guardar.
      </p>
      <p class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <strong>La nota no se pone a mano:</strong> se calcula al guardar con los datos de cada línea, la posición del jugador y el
        resultado. Parte de 6,0 y suma o resta por ataque (goles, tiros a puerta), creación (asistencias, pases clave), defensa
        (entradas, intercepciones, portería a cero y goles encajados para defensas), portería (paradas), disciplina (tarjetas) y
        resultado (según los minutos jugados). Escala de 3,0 a 10,0.
      </p>
    </section>
    <SuggestPerformanceModal
      v-if="canSuggest"
      :open="suggesting"
      :match="data.match"
      :current="myPerformance"
      :opponent-label="opponentLabel(data.match, teamId)"
      @close="suggesting = false"
      @sent="onSuggestionSent"
    />
  </template>
</template>
