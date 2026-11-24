<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import OfficialSheetPanel from '@/components/sheet/OfficialSheetPanel.vue';
import SheetComparison from '@/components/sheet/SheetComparison.vue';
import TeamMatchStatsCard from '@/components/sheet/TeamMatchStatsCard.vue';
import VideoProposalPanel from '@/components/sheet/VideoProposalPanel.vue';
import MatchPreview from '@/components/matches/MatchPreview.vue';
import MatchVideos from '@/components/videos/MatchVideos.vue';
import MatchPassesPanel from '@/components/passes/MatchPassesPanel.vue';
import RequestAccessModal from '@/components/passes/RequestAccessModal.vue';
import MatchOfficialsPanel from '@/components/referees/MatchOfficialsPanel.vue';
import SuggestPerformanceModal from '@/components/suggestions/SuggestPerformanceModal.vue';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import CardIcon from '@/components/ui/CardIcon.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import PlayerNoteModal from '@/components/sheet/PlayerNoteModal.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import GroupByPositionToggle from '@/components/ui/GroupByPositionToggle.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import ResponsiveTabs from '@/components/ui/ResponsiveTabs.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useBackFallback } from '@/composables/useBackFallback';
import { useGroupByPosition } from '@/composables/usePositionGrouping';
import { useSort, type SortValue } from '@/composables/useSort';
import { useAuthStore } from '@/stores/auth';
import type { MatchSheetDto, MatchSheetEntryInput, Position, SquadPlayerDto, SuggestionDto, SuspensionBriefDto } from '@/types/api';
import { awaitingResultHint, formatKickoff, matchDisplayLabels, matchDisplayStatus, opponentLabel, outcomeFor, outcomeLabels, outcomeTone, passPrice, positionLabels, positionShortLabels, suggestionStatusLabels, suggestionStatusTone } from '@/utils/format';
import { downloadPaperSheet } from '@/utils/paperSheet';
import PlayerName from '@/components/players/PlayerName.vue';
import { opponentOf } from '@/utils/crests';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { useViewer } from '@/composables/useViewer';

const props = defineProps<{ squadId: string; matchId: string }>();
useBackFallback(() => ({ to: { name: 'squad-matches', params: { squadId: props.squadId } }, label: 'Volver a los partidos de la plantilla' }));

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const { isAdmin } = useViewer();

const { data, loading, error } = useAsync(() => api.squads.sheet(props.squadId, props.matchId));

/** «partido» es el acta pública (federación); «interna», la que rellena el cuerpo técnico. */
type Tab = 'partido' | 'interna' | 'comparador' | 'video' | 'pases' | 'arbitros' | 'previa';
const tabs: { id: Tab; label: string }[] = [
  { id: 'partido', label: 'Acta del partido' },
  { id: 'interna', label: 'Acta interna' },
  { id: 'comparador', label: 'Comparador' },
  { id: 'video', label: 'Vídeo' },
  { id: 'pases', label: 'Pases' },
  { id: 'arbitros', label: 'Árbitros' },
  { id: 'previa', label: 'Previa' },
];
// La previa es para el cuerpo técnico y el club del equipo (y el administrador, que solo mira); los jugadores no la ven.
const canPrepare = computed(() =>
  !!data.value && (isAdmin.value || data.value.canEdit || data.value.squad.myRole !== null || !!auth.club?.teams.some((team) => team.teamId === data.value!.squad.teamId)),
);
// Jugado y con la fecha ya pasada: lo de después del partido (acta interna, comparador y vídeo) solo existe entonces.
const matchOver = computed(() =>
  !!data.value && data.value.match.status === 'Played' && new Date(data.value.match.kickoffAt).getTime() <= Date.now(),
);
const afterMatch: Tab[] = ['interna', 'comparador', 'video', 'pases', 'arbitros'];
// Al equipo arbitral lo puntúan el club y su cuerpo técnico; los jugadores no lo ven.
const canRateReferees = computed(() => canPrepare.value && (auth.isClub || auth.isCoach) && !isAdmin.value);
// Los pases (quién de fuera ve el acta interna y el vídeo de este partido) los dan el club y su cuerpo técnico.
const canGivePasses = computed(() => canPrepare.value && (auth.isClub || auth.isCoach) && !isAdmin.value);
// Lo interno del rival en este partido (acta interna y vídeo): se ve con un pase de su club, que se le puede pedir si
// su plantilla está abierta a solicitudes. Se consulta como visitante, igual que desde la página del partido.
const visitor = useAsync(() => api.matches.get(props.matchId), { immediate: false, redirectOnError: false });
watch(
  () => [matchOver.value, canGivePasses.value] as const,
  ([over, staff]) => { if (over && staff && !visitor.data.value && !visitor.loading.value) void visitor.run(); },
  { immediate: true },
);
const rival = computed(() => visitor.data.value?.sheets.find((s) => s.squadId !== props.squadId && !s.insider && s.access) ?? null);
const rivalRequestable = computed(() => (rival.value?.access?.canRequest && !rival.value.access.videoPass ? [rival.value.squadId] : []));
const requestingRival = ref(false);
const requestPreferVideo = ref(false);
const rivalRequested = ref(false);
function requestRival(video: boolean) {
  requestPreferVideo.value = video;
  requestingRival.value = true;
}
async function onRivalRequested() {
  requestingRival.value = false;
  rivalRequested.value = true;
  await visitor.run();
}

const visibleTabs = computed(() =>
  tabs.filter((t) =>
    (t.id !== 'previa' || canPrepare.value) && (t.id !== 'arbitros' || canRateReferees.value) && (t.id !== 'pases' || canGivePasses.value)
      && (matchOver.value || !afterMatch.includes(t.id))),
);
// Antes del partido, quien lo prepara entra directamente en la previa.
const defaultTab = computed<Tab>(() => (!matchOver.value && canPrepare.value ? 'previa' : 'partido'));
const tab = computed<Tab>(() => visibleTabs.value.find((t) => t.id === route.query.tab)?.id ?? defaultTab.value);
const selectTab = (id: Tab) => void router.replace({ query: { ...route.query, pase: undefined, tab: id === defaultTab.value ? undefined : id } });
// Desde el vídeo (recién subido o ya en la lista): a la pestaña de pases con el formulario marcado para el vídeo.
const passPreset = computed(() => (route.query.pase === 'video' ? 'video' : null));
const shareVideo = () => void router.replace({ query: { ...route.query, tab: 'pases', pase: 'video' } });
// Desde el vídeo: a la sección «Del vídeo» del acta interna, donde se pide el análisis y se vuelca la propuesta.
async function goToVideoProposal() {
  selectTab('interna');
  await nextTick();
  document.getElementById('video-proposal')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

interface Row extends MatchSheetEntryInput {
  player: SquadPlayerDto;
  /** Nota calculada por la API al guardar (solo lectura). */
  rating: number | null;
  /** Sus acciones las puso el vídeo y aún no cuentan en la nota (solo lectura). */
  actionsFromVideo: boolean;
  /** Va en la convocatoria del partido. */
  called: boolean;
  /** Tenía línea guardada en el acta. */
  recorded: boolean;
  /** Sancionado para este partido (5.ª amarilla o expulsión en uno anterior): no puede salir como que jugó. */
  suspended: boolean;
  suspension: SuspensionBriefDto | null;
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
  fouls: 0,
  ballLosses: 0,
  recoveries: 0,
  passesCompleted: 0,
  passesAttempted: 0,
  clearances: 0,
  rating: null,
  actionsFromVideo: false,
  called: false,
  recorded: false,
  suspended: false,
  suspension: null,
  notes: null,
  shirtNumber: null,
});

const fromSheet = (sheet: MatchSheetDto): Row[] =>
  sheet.entries.map(({ player, performance, calledUp, suspended, suspension }) => ({
    ...(performance
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
          fouls: performance.fouls ?? 0,
          ballLosses: performance.ballLosses ?? 0,
          recoveries: performance.recoveries ?? 0,
          passesCompleted: performance.passesCompleted ?? 0,
          passesAttempted: performance.passesAttempted ?? 0,
          clearances: performance.clearances ?? 0,
          rating: performance.rating,
          actionsFromVideo: performance.actionsFromVideo ?? false,
          notes: performance.notes,
          shirtNumber: performance.matchShirtNumber,
        }
      : blank(player)),
    called: calledUp ?? false,
    recorded: performance !== null,
    suspended: suspended ?? false,
    suspension: suspension ?? null,
  }));

// Un sancionado no pudo jugar el partido de su sanción: no se le puede marcar. La línea que ya tuviera se conserva (la
// sanción pudo saberse después, con el acta oficial del partido anterior).
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
const suspendedText = (row: Row) => `Sancionado para este partido${row.suspension ? ` (${lowerFirst(row.suspension.reason)})` : ''}`;
const cannotPlay = (row: Row) => row.suspended && !row.recorded && !row.played;

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
  fouls: row.fouls ?? 0,
  ballLosses: row.ballLosses ?? 0,
  recoveries: row.recoveries ?? 0,
  passesCompleted: row.passesCompleted ?? 0,
  passesAttempted: row.passesAttempted ?? 0,
  clearances: row.clearances ?? 0,
  notes: row.notes?.trim() ? row.notes.trim() : null,
  shirtNumber: row.shirtNumber || null,
});

const rows = ref<Row[]>([]);
watch(data, (sheet) => { if (sheet) rows.value = fromSheet(sheet); }, { immediate: true });

const canEdit = computed(() => data.value?.canEdit ?? false);
/** Lo escrito en la tabla y todavía sin guardar (volcar la propuesta del vídeo recarga el acta). */
const unsaved = computed(() => !!data.value && canEdit.value
  && JSON.stringify(rows.value.map(toEntry)) !== JSON.stringify(fromSheet(data.value).map(toEntry)));
/** El vídeo ha volcado datos al acta: se enseña tal como ha quedado guardada. */
function onVideoApplied(sheet: MatchSheetDto) {
  data.value = sheet;
  saved.value = false;
  saveError.value = null;
  lineErrors.value = [];
}
const teamId = computed(() => data.value?.squad.teamId ?? '');

/** Acta en papel de este partido para apuntar en directo (cabecera rellena; jugadores y datos, a mano). */
function downloadPaper() {
  if (!data.value) return;
  const { squad, match } = data.value;
  void downloadPaperSheet({ teamName: squad.teamName, teamId: squad.teamId, teamCrestUrl: squad.teamCrestUrl, competition: squad.competitionName, season: squad.seasonLabel, match });
}

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

// El acta se prepara con la convocatoria del partido: salen los convocados y lo que ya estaba apuntado. Si a última hora
// jugó alguien más de la plantilla, se añade a mano. Sin convocatoria (partidos de antes) sale toda la plantilla.
const hasCallUp = computed(() => data.value?.hasCallUp ?? false);
const added = ref<string[]>([]);
const inSheet = (r: Row) => !hasCallUp.value || r.called || r.recorded || r.played || added.value.includes(r.squadPlayerId);
const sheetRows = computed(() => rows.value.filter(inSheet));
const calledCount = computed(() => rows.value.filter((r) => r.called).length);
const addable = computed<SelectOption[]>(() =>
  rows.value
    .filter((r) => !inSheet(r))
    .sort((a, b) => a.player.fullName.localeCompare(b.player.fullName, 'es'))
    .map((r) => ({
      value: r.squadPlayerId,
      label: r.player.fullName,
      photo: r.player.photoUrl ?? null,
      group: r.player.position ? `${positionLabels[r.player.position]}s` : 'Sin posición',
      disabled: cannotPlay(r),
      hint: cannotPlay(r) ? `${suspendedText(r)}: no pudo jugar` : undefined,
    })),
);
function addPlayer(id: string | number | null) {
  const row = rows.value.find((r) => r.squadPlayerId === id);
  if (!row) return;
  added.value = [...added.value, row.squadPlayerId];
  row.played = true;
  onPlayedChange(row);
}

// Como en la plantilla y la convocatoria: porteros, defensas, centrocampistas y delanteros, y al final los que no tienen posición.
const groupByPosition = useGroupByPosition('match-sheet');
const positionOrder: (Position | null)[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', null];
// Quien causó baja después del partido sigue en el acta (lo jugó), en su último grupo «De baja».
const isLeftRow = (r: Row) => r.player.status !== 'Active';
function grouped(list: Row[]) {
  const current = list.filter((r) => !isLeftRow(r));
  const left = list.filter(isLeftRow);
  const groups = !groupByPosition.value
    ? current.length > 0 || left.length === 0 ? [{ key: 'all', label: '', rows: current }] : []
    : positionOrder
      .map((p) => ({ key: p ?? 'none', label: p ? `${positionLabels[p]}s` : 'Sin posición', rows: current.filter((r) => r.player.position === p) }))
      .filter((g) => g.rows.length > 0);
  return left.length > 0 ? [...groups, { key: 'left', label: 'De baja', rows: left }] : groups;
}
const editGroups = computed(() => grouped(sortedRows.value.filter(inSheet)));
const playedGroups = computed(() => grouped(sortedRows.value.filter((r) => r.played)));
const withVideoActions = computed(() => playedRows.value.filter((r) => r.actionsFromVideo).length);
const videoActionsTitle = 'La nota aún no cuenta sus tiros, pases, paradas, recuperaciones ni pérdidas: los puso el vídeo, que solo los ve mientras lo identifica. Cuentan cuando el cuerpo técnico guarda el acta.';
const outcome =computed(() => (data.value ? outcomeFor(data.value.match, teamId.value) : null));

// Notas de cada línea en un modal: en la tabla solo cabe un trozo y la casilla cortaba lo escrito.
const noteRow = ref<Row | null>(null);
const hasNote = (row: Row) => !!row.notes?.trim();
const noteContext = computed(() => (data.value ? `Jornada ${data.value.match.matchday} · ${opponentLabel(data.value.match, teamId.value)}` : ''));
function applyNote(note: string | null) {
  if (noteRow.value) noteRow.value.notes = note;
  noteRow.value = null;
}

/** Al marcar «jugó» proponemos 90 minutos como titular; al desmarcar se conservan los valores por si se vuelve a marcar. */
function onPlayedChange(row: Row) {
  if (row.played && row.minutesPlayed === 0) {
    row.minutesPlayed = 90;
    row.started = true;
  }
}

function reset() {
  if (data.value) rows.value = fromSheet(data.value);
  added.value = [];
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

const numericColumns: { key: keyof Pick<Row, 'goals' | 'assists' | 'shots' | 'shotsOnTarget' | 'keyPasses' | 'passesCompleted' | 'passesAttempted' | 'ballLosses' | 'recoveries' | 'clearances' | 'tackles' | 'interceptions' | 'saves' | 'fouls'>; label: string; title: string }[] = [
  { key: 'goals', label: 'G', title: 'Goles' },
  { key: 'assists', label: 'A', title: 'Asistencias de gol' },
  { key: 'shots', label: 'T', title: 'Tiros' },
  { key: 'shotsOnTarget', label: 'TP', title: 'Tiros a puerta' },
  { key: 'passesCompleted', label: 'PasC', title: 'Pases completados' },
  { key: 'passesAttempted', label: 'PasI', title: 'Pases intentados' },
  { key: 'ballLosses', label: 'Pér', title: 'Pérdidas de balón' },
  { key: 'recoveries', label: 'Rec', title: 'Recuperaciones de balón' },
  { key: 'clearances', label: 'Desp', title: 'Despejes' },
  { key: 'tackles', label: 'Ent', title: 'Entradas' },
  { key: 'interceptions', label: 'Int', title: 'Intercepciones' },
  { key: 'saves', label: 'Par', title: 'Paradas' },
  { key: 'fouls', label: 'F', title: 'Faltas cometidas' },
];

// Mientras se edita solo se ordena por el jugador y la nota (que no se escriben): así ninguna fila se mueve al teclear.
// El orden se aplica dentro de cada posición cuando se agrupa.
type SheetSortKey = 'player' | 'started' | 'minutes' | 'yellowCards' | 'redCard' | 'rating' | (typeof numericColumns)[number]['key'];
const sheetGetters = {
  player: (r: Row) => r.player.fullName,
  started: (r: Row) => Number(r.started),
  minutes: (r: Row) => r.minutesPlayed,
  yellowCards: (r: Row) => r.yellowCards,
  redCard: (r: Row) => Number(r.redCard),
  rating: (r: Row) => r.rating,
  ...Object.fromEntries(numericColumns.map((column) => [column.key, (r: Row) => r[column.key] ?? null])),
} as Record<SheetSortKey, (r: Row) => SortValue>;
const { sorted: sortedRows, sortBy, state } = useSort<Row, SheetSortKey>(rows, sheetGetters, 'player', { desc: false, ascendingFirst: ['player'] });
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Jornada {{ data.match.matchday }} · {{ formatKickoff(data.match.kickoffAt) }}<span v-if="data.match.venue"> · {{ data.match.venue }}</span></span>
        <span class="flex items-center gap-2">
          <Badge v-if="outcome" :tone="outcomeTone(outcome)">{{ outcomeLabels[outcome] }}</Badge>
          <Badge :tone="['Played', 'AwaitingResult'].includes(matchDisplayStatus(data.match)) ? 'slate' : 'blue'" :title="matchDisplayStatus(data.match) === 'AwaitingResult' ? awaitingResultHint : undefined">{{ matchDisplayLabels[matchDisplayStatus(data.match)] }}</Badge>
        </span>
      </div>
      <div class="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-center">
        <p class="flex min-w-0 flex-col items-center gap-1.5 break-words text-sm font-semibold sm:text-lg" :class="data.match.homeTeam.id === teamId ? 'text-emerald-700' : 'text-slate-900'">
          <TeamCrest :src="data.match.homeTeam.crestUrl" :name="data.match.homeTeam.name" :short-name="data.match.homeTeam.shortName" size="md" />
          {{ data.match.homeTeam.name }}
        </p>
        <p class="text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
          <template v-if="data.match.status === 'Played'">{{ data.match.homeGoals }} - {{ data.match.awayGoals }}</template>
          <span v-else class="text-slate-300">vs</span>
        </p>
        <p class="flex min-w-0 flex-col items-center gap-1.5 break-words text-sm font-semibold sm:text-lg" :class="data.match.awayTeam.id === teamId ? 'text-emerald-700' : 'text-slate-900'">
          <TeamCrest :src="data.match.awayTeam.crestUrl" :name="data.match.awayTeam.name" :short-name="data.match.awayTeam.shortName" size="md" />
          {{ data.match.awayTeam.name }}
        </p>
      </div>
    </div>

    <div v-if="matchOver && rival?.access" class="card mt-4 flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-slate-600">
      <template v-if="rival.access.sheetPass || rival.access.videoPass">
        <p><Icon icon="ticket" class="mr-1.5 h-3.5 w-3.5 text-accent-400" />Tienes un pase de lo interno de <strong class="text-slate-900">{{ rival.teamName }}</strong> en este partido.</p>
        <RouterLink :to="{ name: 'match', params: { matchId }, query: { vista: 'visitante' } }" class="btn-secondary px-3 py-1 text-xs">Verlo</RouterLink>
      </template>
      <template v-else-if="rival.access.readyPassCode">
        <p>El club de <strong class="text-slate-900">{{ rival.teamName }}</strong> ha aprobado tu solicitud ({{ passPrice(rival.access.readyPassPriceCents ?? 0, rival.access.currency) }}).</p>
        <RouterLink :to="{ name: 'pass', params: { code: rival.access.readyPassCode } }" class="btn-primary px-3 py-1 text-xs"><Icon icon="ticket" class="mr-1.5 h-3 w-3" />Canjear el pase</RouterLink>
      </template>
      <template v-else-if="rival.access.requestStatus === 'Pending' || rivalRequested">
        <p><Icon icon="hourglass-half" class="mr-1 h-3.5 w-3.5 text-amber-500" />Tu solicitud a <strong class="text-slate-900">{{ rival.teamName }}</strong> está pendiente: su club todavía no la ha decidido.</p>
        <RouterLink :to="{ name: 'my-passes' }" class="btn-ghost px-3 py-1 text-xs">Mis pases</RouterLink>
      </template>
      <template v-else-if="rival.access.canRequest">
        <p>
          <strong class="text-slate-900">{{ rival.teamName }}</strong> da acceso a lo interno de este partido:
          acta interna {{ passPrice(rival.access.sheetPriceCents, rival.access.currency) }}<template v-if="rival.access.hasVideo"> · vídeo {{ passPrice(rival.access.videoPriceCents, rival.access.currency) }}</template>.
        </p>
        <button type="button" class="btn-secondary px-3 py-1 text-xs" @click="requestRival(false)"><Icon icon="ticket" class="mr-1.5 h-3 w-3" />Solicitar acceso</button>
      </template>
    </div>

    <RequestAccessModal
      v-if="rival?.access"
      :open="requestingRival"
      :squad-id="rival.squadId"
      :match-id="matchId"
      :team-name="rival.teamName"
      :access="rival.access"
      :prefer-video="requestPreferVideo"
      @close="requestingRival = false"
      @requested="onRivalRequested"
    />

    <ResponsiveTabs
      :items="visibleTabs.map((item) => ({ key: item.id, label: item.label }))"
      :model-value="tab"
      label="Secciones del partido"
      class="mt-6"
      @update:model-value="(key) => selectTab(key as Tab)"
    />

    <div v-if="tab === 'partido'" class="mt-6">
      <OfficialSheetPanel :match-id="matchId" :highlight-team-id="teamId" />
    </div>

    <div v-else-if="tab === 'comparador'" class="mt-6">
      <SheetComparison :squad-id="squadId" :match-id="matchId" />
    </div>

    <div v-else-if="tab === 'video'" class="mt-6">
      <MatchVideos
        :match-id="matchId"
        :upload-squad-id="squadId"
        :can-upload="canPrepare && !isAdmin"
        :requestable="rivalRequestable"
        :analyzable="canPrepare && !isAdmin && data.match.status === 'Played'"
        @request="requestRival(true)"
        @share="shareVideo"
        @analyze="goToVideoProposal"
      />
    </div>

    <div v-else-if="tab === 'pases'" class="mt-6">
      <MatchPassesPanel :squad-id="squadId" :match-id="matchId" :preset="passPreset" />
    </div>

    <div v-else-if="tab === 'arbitros'" class="mt-6">
      <MatchOfficialsPanel :match-id="matchId" />
    </div>

    <div v-else-if="tab === 'previa'" class="mt-6">
      <MatchPreview :match-id="matchId" :my-team-id="teamId" :squad-id="squadId" />
    </div>

    <section v-else class="mt-6">
      <!-- Del vídeo: la propuesta del analizador, para el club, el cuerpo técnico y el administrador (que solo mira) -->
      <VideoProposalPanel
        v-if="canPrepare && data.match.status === 'Played'"
        class="mb-6"
        :squad-id="squadId"
        :match-id="matchId"
        :sheet="data"
        :unsaved-sheet="unsaved"
        @applied="onVideoApplied"
        @go-video="selectTab('video')"
      />

      <!-- Datos del equipo: lo colectivo que no trae el acta pública -->
      <TeamMatchStatsCard
        v-if="data.match.status === 'Played'"
        class="mb-6"
        :squad-id="squadId"
        :match-id="matchId"
        :stats="data.teamStats"
        :can-edit="canEdit"
        :team-name="data.squad.teamName"
        :team-crest-url="data.squad.teamCrestUrl"
        :opponent-name="opponentOf(data.match, teamId).name"
        :opponent-crest-url="opponentOf(data.match, teamId).crestUrl"
        @saved="(stats) => { if (data) data.teamStats = stats; }"
      />

      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-slate-900">Acta interna del partido</h2>
          <p class="text-xs text-slate-500">
            <template v-if="canEdit && hasCallUp">
              Salen los {{ calledCount }} convocados del partido: marca quién jugó y rellena su línea. {{ playedRows.length }} de {{ sheetRows.length }} en el acta.
            </template>
            <template v-else-if="canEdit">Este partido no tiene convocatoria, así que sale toda la plantilla: marca quién jugó y rellena su línea. {{ playedRows.length }} de {{ rows.length }} en el acta.</template>
            <template v-else>{{ playedRows.length }} jugadores en el acta.</template>
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <GroupByPositionToggle v-if="canEdit || playedRows.length > 0" v-model="groupByPosition" />
          <template v-if="canSuggest">
            <Badge v-if="pendingSuggestion" tone="amber">Sugerencia pendiente de revisión</Badge>
            <button v-else type="button" class="btn-secondary" @click="suggesting = true">
              <Icon icon="pen" class="mr-1.5 h-3.5 w-3.5" />{{ myPerformance ? 'Sugerir una corrección' : 'Sugerir mi línea' }}
            </button>
          </template>
          <SearchSelect
            v-if="canEdit && hasCallUp && addable.length > 0"
            class="w-56"
            :model-value="null"
            :options="addable"
            placeholder="Añadir jugador"
            aria-label="Añadir al acta a un jugador de la plantilla que no iba convocado"
            title="Por si a última hora jugó alguien de la plantilla que no iba en la convocatoria"
            @update:model-value="addPlayer"
          />
          <template v-if="canEdit">
            <button type="button" class="btn-ghost" title="PDF para imprimir y apuntar el partido a mano" @click="downloadPaper"><Icon icon="file-pdf" class="mr-1.5 h-3.5 w-3.5" />Acta en papel</button>
            <button type="button" class="btn-secondary" v-busy="saving" :disabled="saving" @click="reset">Deshacer cambios</button>
            <button type="button" class="btn-primary" v-busy="saving" :disabled="saving" @click="save">{{ saving ? 'Guardando…' : 'Guardar acta' }}</button>
          </template>
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

      <Alert v-if="canEdit && withVideoActions > 0" kind="info" class="mb-3">
        <Icon icon="video" class="mr-1.5" />Las acciones que puso el vídeo ({{ withVideoActions === 1 ? '1 jugador' : `${withVideoActions} jugadores` }})
        aún no cuentan en la nota: el vídeo solo las ve mientras identifica a cada uno, y si contaran puntuaría cuánto se le ve.
        Revísalas y guarda el acta para que cuenten.
      </Alert>

      <p v-if="!canEdit && playedRows.length === 0" class="text-sm text-slate-500">El cuerpo técnico todavía no ha registrado el acta de este partido.</p>

      <div v-else class="overflow-x-auto rounded-xl border border-slate-200 bg-surface shadow-sm">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs text-slate-500">
            <tr v-if="canEdit">
              <th class="px-2 py-2 text-center uppercase tracking-wide" title="Jugó">Jugó</th>
              <th class="px-2 py-2 text-center uppercase tracking-wide" title="Dorsal en este partido (vacío = el de la ficha)">Dorsal</th>
              <SortHeader class="px-3 py-2 text-left" label="Jugador" v-bind="state('player')" @sort="sortBy('player')" />
              <th class="px-2 py-2 text-center uppercase tracking-wide" title="Titular">Tit</th>
              <th class="px-2 py-2 text-center uppercase tracking-wide" title="Minutos">Min</th>
              <th v-for="column in numericColumns" :key="column.key" class="px-2 py-2 text-center uppercase tracking-wide" :title="column.title">{{ column.label }}</th>
              <th class="px-2 py-2 text-center uppercase tracking-wide" title="Tarjetas amarillas">TA</th>
              <th class="px-2 py-2 text-center uppercase tracking-wide" title="Tarjeta roja">TR</th>
              <SortHeader class="px-2 py-2 text-center" label="Nota" title="Nota calculada con los datos al guardar" v-bind="state('rating')" @sort="sortBy('rating')" />
              <th class="px-3 py-2 text-left uppercase tracking-wide">Notas</th>
            </tr>
            <tr v-else>
              <SortHeader class="px-3 py-2 text-left" label="Jugador" v-bind="state('player')" @sort="sortBy('player')" />
              <SortHeader class="px-2 py-2 text-center" label="Tit" title="Titular" v-bind="state('started')" @sort="sortBy('started')" />
              <SortHeader class="px-2 py-2 text-center" label="Min" title="Minutos" v-bind="state('minutes')" @sort="sortBy('minutes')" />
              <SortHeader
                v-for="column in numericColumns"
                :key="column.key"
                class="px-2 py-2 text-center"
                :label="column.label"
                :title="column.title"
                v-bind="state(column.key)"
                @sort="sortBy(column.key)"
              />
              <SortHeader class="px-2 py-2 text-center" label="TA" title="Tarjetas amarillas" v-bind="state('yellowCards')" @sort="sortBy('yellowCards')" />
              <SortHeader class="px-2 py-2 text-center" label="TR" title="Tarjeta roja" v-bind="state('redCard')" @sort="sortBy('redCard')" />
              <SortHeader class="px-2 py-2 text-center" label="Nota" title="Nota calculada con los datos al guardar" v-bind="state('rating')" @sort="sortBy('rating')" />
              <th class="px-3 py-2 text-left uppercase tracking-wide">Notas</th>
            </tr>
          </thead>

          <template v-if="canEdit">
          <tbody v-for="group in editGroups" :key="group.key" class="divide-y divide-slate-100">
            <tr v-if="group.label">
              <td :colspan="numericColumns.length + 9" class="bg-surface-2 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {{ group.label }} · {{ group.rows.filter((r) => r.played).length }} de {{ group.rows.length }} en el acta
                <RouterLink v-if="group.key === 'none'" :to="{ name: 'squad', params: { squadId } }" class="ml-2 normal-case tracking-normal text-amber-400 hover:underline">
                  La federación no la publica: pónsela en Jugadores
                </RouterLink>
              </td>
            </tr>
            <tr v-for="row in group.rows" :key="row.squadPlayerId" :class="row.played ? '' : 'text-slate-400'">
              <td class="px-2 py-1 text-center">
                <input
                  v-model="row.played"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-accent-400 disabled:cursor-not-allowed disabled:opacity-40"
                  :disabled="cannotPlay(row)"
                  :title="cannotPlay(row) ? `${suspendedText(row)}: no puede salir en el acta como que jugó` : undefined"
                  :aria-label="`${row.player.fullName} jugó`"
                  @change="onPlayedChange(row)"
                />
              </td>
              <td class="px-2 py-1 text-center">
                <input
                  v-model.number="row.shirtNumber"
                  type="number"
                  min="1"
                  max="99"
                  class="input w-14 px-1 py-1 text-center"
                  :disabled="!row.played"
                  placeholder="—"
                  aria-label="Dorsal en este partido"
                />
              </td>
              <td class="px-3 py-1 whitespace-nowrap">
                <PlayerName :name="row.player.fullName" :photo-url="row.player.photoUrl" class="font-medium" :class="row.played ? 'text-slate-800' : ''" />
                <span v-if="row.player.position" class="ml-1 text-xs text-slate-400">{{ positionShortLabels[row.player.position] }}</span>
                <Badge v-if="row.suspended" tone="red" class="ml-1.5" :title="`${suspendedText(row)}: no puede salir en el acta como que jugó`"><Icon icon="ban" class="mr-1 h-2.5 w-2.5" />Sancionado</Badge>
                <Badge v-else-if="hasCallUp && !row.called" tone="amber" class="ml-1.5" title="No iba en la convocatoria: se ha añadido al acta">Fuera de la convocatoria</Badge>
                <button
                  v-if="hasNote(row)"
                  type="button"
                  class="ml-1.5 text-accent-400 hover:text-accent-300"
                  :title="`Tiene nota: ${row.notes}`"
                  :aria-label="`Ver la nota de ${row.player.fullName}`"
                  @click="noteRow = row"
                ><Icon icon="comment-dots" class="text-[12px]" /></button>
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
              <td class="px-2 py-1 text-center whitespace-nowrap">
                <RatingBadge v-if="row.played" :rating="row.rating" size="sm" />
                <Icon v-if="row.played && row.actionsFromVideo" icon="video" class="ml-1 text-[11px] text-amber-400" :title="videoActionsTitle" />
              </td>
              <td class="px-3 py-1">
                <button
                  type="button"
                  class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border px-2 py-1 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
                  :class="hasNote(row)
                    ? 'border-accent-400/60 bg-accent-500/10 text-slate-800 hover:bg-accent-500/20'
                    : 'border-dashed border-slate-300 text-slate-500 hover:border-accent-400 hover:text-slate-800'"
                  :disabled="!row.played"
                  :title="hasNote(row) ? row.notes ?? '' : 'Añadir una nota a su partido'"
                  :aria-label="hasNote(row) ? `Editar la nota de ${row.player.fullName}` : `Añadir una nota a ${row.player.fullName}`"
                  @click="noteRow = row"
                >
                  <Icon :icon="hasNote(row) ? 'circle-check' : 'plus'" class="shrink-0 text-[12px]" :class="hasNote(row) ? 'text-accent-400' : ''" />
                  {{ hasNote(row) ? 'Editar la nota' : 'Añadir nota' }}
                </button>
              </td>
            </tr>
          </tbody>
          </template>

          <template v-else>
          <tbody v-for="group in playedGroups" :key="group.key" class="divide-y divide-slate-100">
            <tr v-if="group.label">
              <td :colspan="numericColumns.length + 7" class="bg-surface-2 px-3 py-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {{ group.label }} · {{ group.rows.length }}
              </td>
            </tr>
            <tr v-for="row in group.rows" :key="row.squadPlayerId">
              <td class="px-3 py-2 whitespace-nowrap">
                <PlayerName :name="row.player.fullName" :photo-url="row.player.photoUrl" class="font-medium text-slate-800" />
                <span v-if="row.player.position" class="ml-1 text-xs text-slate-400">{{ positionShortLabels[row.player.position] }}</span>
                <Icon v-if="hasNote(row)" icon="comment-dots" class="ml-1.5 text-[12px] text-accent-400" :title="`Tiene nota: ${row.notes}`" />
              </td>
              <td class="px-2 py-2 text-center">{{ row.started ? '●' : '' }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ row.minutesPlayed }}</td>
              <td v-for="column in numericColumns" :key="column.key" class="px-2 py-2 text-center tabular-nums">{{ row[column.key] }}</td>
              <td class="px-2 py-2 text-center"><CardMarks :yellow-cards="row.yellowCards" :red-card="false" /></td>
              <td class="px-2 py-2 text-center"><CardIcon v-if="row.redCard" kind="red" /></td>
              <td class="px-2 py-2 text-center whitespace-nowrap">
                <RatingBadge :rating="row.rating" size="sm" />
                <Icon v-if="row.actionsFromVideo" icon="video" class="ml-1 text-[11px] text-amber-400" :title="videoActionsTitle" />
              </td>
              <td class="px-3 py-2">
                <button
                  v-if="hasNote(row)"
                  type="button"
                  class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-accent-400/60 bg-accent-500/10 px-2 py-1 text-left text-xs text-slate-800 hover:bg-accent-500/20"
                  :title="row.notes ?? ''"
                  :aria-label="`Leer la nota de ${row.player.fullName}`"
                  @click="noteRow = row"
                >
                  <Icon icon="comment-dots" class="shrink-0 text-[12px] text-accent-400" />
                  Leer la nota
                </button>
              </td>
            </tr>
          </tbody>
          </template>
        </table>
      </div>

      <p class="content-note mt-3">
        Tit = titular · Min = minutos (0-120) · G goles · A asistencias de gol · T tiros · TP tiros a puerta · PasC pases
        completados · PasI pases intentados · Pér pérdidas de balón · Rec recuperaciones · Desp despejes · Ent entradas · Int intercepciones ·
        Par paradas · F faltas · TA amarillas (dos implican roja). Con «jugó» desmarcado la línea se elimina del acta al guardar.
      </p>
      <p class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <strong>La nota no se pone a mano:</strong> se calcula al guardar con los datos de cada línea, la posición del jugador y el
        resultado. Parte de 6,0 y suma o resta por ataque (goles, tiros a puerta), creación (asistencias de gol, acierto en el
        pase con 10 o más intentados y pérdidas de balón), defensa (entradas, intercepciones, recuperaciones, despejes, portería a cero y
        goles encajados para defensas), portería (paradas), disciplina (tarjetas) y
        resultado (según los minutos jugados). Escala de 3,0 a 10,0. Con el acta oficial cerrada, la portería a cero y los goles
        encajados son los de mientras el jugador estaba en el campo; sin ella, la parte de los del partido que le toca por sus
        minutos. Las acciones que vuelca el vídeo (<Icon icon="video" class="text-[10px] text-amber-400" />) no cuentan hasta
        que se guarda el acta: el vídeo solo las ve mientras identifica a cada jugador.
      </p>
    </section>
    <PlayerNoteModal
      :open="noteRow !== null"
      :player-name="noteRow?.player.fullName ?? ''"
      :photo-url="noteRow?.player.photoUrl"
      :context="noteContext"
      :note="noteRow?.notes ?? null"
      :readonly="!canEdit"
      @close="noteRow = null"
      @save="applyNote"
    />
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
