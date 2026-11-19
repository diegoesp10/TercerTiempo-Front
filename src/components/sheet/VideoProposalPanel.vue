<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import VideoAnalysisProgress from '@/components/sheet/VideoAnalysisProgress.vue';
import VideoCrop from '@/components/sheet/VideoCrop.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type {
  MatchSheetDto,
  MatchVideoAnalysisDto,
  TeamMatchStatsDto,
  VideoAnalysisPartDto,
  VideoAnalysisPlayerDto,
  VideoAnalysisState,
  VideoPlayerActions,
  VideoPossessionConfidence,
  VideoTeamField,
} from '@/types/api';
import { formatKickoff, positionShortLabels, videoPartLabels } from '@/utils/format';

/**
 * «Del vídeo»: la propuesta de acta interna que deja el analizador al pasar por el vídeo del partido. Enseña el estado
 * del análisis y cuánto se puede fiar uno de él, los datos de equipo propuestos frente a los del acta (se aceptan uno a
 * uno) y los jugadores. Con el acta oficial, el analizador lee el dorsal de cada jugador en el vídeo: dice cuál de los dos
 * equipos es el nuestro y cada jugador llega ya con su ficha (el técnico solo corrige si hace falta). Sin acta, cada línea
 * es un tramo seguido que el técnico asigna a mano. Con el acta oficial cerrada, al volcar los minutos (por descarte: sin
 * cambio, el partido entero), la titularidad, los goles y las tarjetas salen de ella, también para los que no salen en el
 * vídeo. Nada se escribe hasta «Volcar al acta».
 */
const props = defineProps<{
  squadId: string;
  matchId: string;
  sheet: MatchSheetDto;
  /** Hay cambios sin guardar en la tabla del acta: al volcar se recarga y se perderían. */
  unsavedSheet?: boolean;
}>();
const emit = defineEmits<{ applied: [sheet: MatchSheetDto]; 'go-video': [] }>();

const analysis = ref<MatchVideoAnalysisDto | null>(null);
const loading = ref(true);
const loadError = ref<string | null>(null);
/** Plegado cuando la propuesta ya se volcó (o no hay vídeo): el acta queda a la vista; se abre con un clic. */
const open = ref(true);

/** Lo que el técnico va eligiendo, por vídeo: cuál de los dos equipos es el suyo y a qué ficha va cada jugador seguido. */
const ourTeam = reactive<Record<string, number | null>>({});
const assigned = reactive<Record<string, Record<number, string | null>>>({});
const shown = reactive<Record<string, number>>({});
const PAGE = 8;

function adopt(next: MatchVideoAnalysisDto, reset = false) {
  for (const part of next.videos) {
    const previous = analysis.value?.videos.find((v) => v.videoId === part.videoId);
    // Una pasada nueva del analizador numera a los jugadores de otra forma: lo elegido antes ya no vale.
    const fresh = reset || !previous || previous.finishedAt !== part.finishedAt;
    if (fresh || !(part.videoId in ourTeam)) {
      ourTeam[part.videoId] = teamFixed(part) ? part.suggestedOurTeam : (part.ourTeam ?? part.suggestedOurTeam);
      assigned[part.videoId] = proposedAssignments(part, ourTeam[part.videoId]);
      shown[part.videoId] = part.identified ? part.players.length : PAGE;
    }
  }
  analysis.value = next;
}

/** Lo asignado al volcar la última vez o, si no, la ficha que propone el acta oficial por el dorsal (solo en nuestro equipo). */
function proposedAssignments(part: VideoAnalysisPartDto, team: number | null): Record<number, string | null> {
  return Object.fromEntries(part.players
    .filter((p) => p.team === team)
    .map((p) => [p.tracklet, p.squadPlayerId ?? p.suggestedSquadPlayerId] as const)
    .filter(([, id]) => !!id));
}

const waitingStates: VideoAnalysisState[] = ['WaitingForVideo', 'Pending', 'Running'];
const busyWithAnalysis = computed(() => analysis.value?.videos.some((v) => waitingStates.includes(v.state) || v.state === 'Paused') ?? false);
/** Se está analizando (o el analizador espera en pausa): se pregunta a menudo para ver el avance casi en directo. */
const analysingNow = computed(() => analysis.value?.videos.some((v) => v.state === 'Running' || (v.state === 'Paused' && v.pausedMidway)) ?? false);
/** Hay algo esperando a un analizador y no hay ninguno encendido (ningún latido en los últimos 2 minutos): no avanzaría. */
const noAnalyzer = computed(() =>
  !!analysis.value?.enabled && !analysis.value.analyzerOnline && analysis.value.videos.some((v) => waitingStates.includes(v.state)));

// Mientras se analiza se pregunta cada 3 s (lo que esté en cola o comprimiéndose, cada 10 s); con la pestaña oculta se
// para y, al volver, se pregunta enseguida. Tras salir del acta no se programa nada más, aunque quede una respuesta en camino.
let timer: ReturnType<typeof setTimeout> | null = null;
let disposed = false;
function schedule() {
  if (timer) clearTimeout(timer);
  timer = !disposed && !document.hidden && busyWithAnalysis.value ? setTimeout(() => void load(true), analysingNow.value ? 3_000 : 10_000) : null;
}
function onVisibility() {
  if (!document.hidden && !disposed && busyWithAnalysis.value) void load(true);
  else schedule();
}
document.addEventListener('visibilitychange', onVisibility);

async function load(silent = false) {
  try {
    const first = analysis.value === null;
    adopt(await api.squads.videoAnalysis(props.squadId, props.matchId, silent));
    if (first) open.value = parts.value.some((p) => p.state !== 'Ready' || !p.appliedAt);
    loadError.value = null;
  } catch (e) {
    if (!silent) loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
    schedule();
  }
}
void load();
onBeforeUnmount(() => {
  disposed = true;
  if (timer) clearTimeout(timer);
  document.removeEventListener('visibilitychange', onVisibility);
});

const canManage = computed(() => (analysis.value?.canManage ?? false) && props.sheet.canEdit);
const parts = computed(() => analysis.value?.videos ?? []);
const readyParts = computed(() => parts.value.filter((p) => p.state === 'Ready'));
const chosenParts = computed(() => readyParts.value.filter((p) => ourTeam[p.videoId] === 0 || ourTeam[p.videoId] === 1));

const stateLabels: Record<VideoAnalysisState, string> = {
  NotRequested: 'Sin analizar',
  WaitingForVideo: 'Esperando al vídeo',
  Pending: 'En cola',
  Running: 'Analizando',
  Ready: 'Listo',
  Failed: 'Fallido',
  Cancelled: 'Cancelado',
  Paused: 'En pausa',
};
const stateTones: Record<VideoAnalysisState, 'green' | 'amber' | 'red' | 'blue' | 'slate'> = {
  NotRequested: 'slate',
  WaitingForVideo: 'slate',
  Pending: 'amber',
  Running: 'blue',
  Ready: 'green',
  Failed: 'red',
  Cancelled: 'slate',
  Paused: 'amber',
};

const percent = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
/** % del tramo con balón visto o interpolado (lo que el analizador usó para la posesión); null en análisis anteriores. */
const ballKnownPct = (part: VideoAnalysisPartDto) => part.teams.find((t) => t.possessionBallPct !== null)?.possessionBallPct ?? null;
const confidenceLabels: Record<VideoPossessionConfidence, string> = { Low: 'confianza baja: no se vuelca', Medium: 'confianza media', High: 'confianza alta' };
const metres = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const teamLetter = (index: number) => (index === 0 ? 'A' : 'B');
// Con el acta oficial, el analizador sabe de qué lado es cada equipo por los dorsales y cruza los nombres con ese lado:
// tu equipo es el de tu lado y no se elige. El otro es el rival: cuenta para los datos de equipo, nunca para tu plantilla.
function teamFixed(part: VideoAnalysisPartDto): boolean {
  return part.identified && part.suggestedOurTeam !== null;
}
const rivalName = computed(() =>
  props.sheet.match.homeTeam.id === props.sheet.squad.teamId ? props.sheet.match.awayTeam.name : props.sheet.match.homeTeam.name,
);
const sideLabels = { Home: 'local', Away: 'visitante' } as const;
/** Minutos con jugadores de nuestro equipo a la vista sin identificar (no cuentan para nadie, sí para el equipo). */
const unidentifiedMinutes = (part: VideoAnalysisPartDto) =>
  Math.round((part.unidentifiedSeconds?.[String(ourTeam[part.videoId])] ?? 0) / 60);
/** Por debajo de esto, la mayoría de lo que se leyó en su espalda no era ese número: que lo mire el técnico. */
const DOUBTFUL_SHIRT = 0.3;

/** Cuánto va a tardar: más o menos lo que dura el vídeo. */
const duration = (part: VideoAnalysisPartDto) =>
  part.durationSeconds ? `unos ${Math.max(1, Math.round(part.durationSeconds / 60))} minutos` : 'más o menos lo que dura el vídeo';

const requesting = ref<string | null>(null);
const requestError = ref<string | null>(null);
async function request(part: VideoAnalysisPartDto) {
  const again = part.state === 'Ready';
  if (!(await confirmDialog({
    title: again ? 'Volver a analizar el vídeo' : 'Analizar el vídeo',
    message: `El análisis tarda ${duration(part)} y se hace en segundo plano: puedes cerrar esta página y volver luego. `
      + (again ? 'Se olvida la propuesta actual y lo que hubieras asignado; el acta no se toca.' : 'Lo que salga es una propuesta: nada se escribe en el acta hasta que lo vuelques.'),
    confirmLabel: again ? 'Volver a analizar' : 'Analizar',
  }))) return;

  requesting.value = part.videoId;
  requestError.value = null;
  applied.value = null;
  try {
    adopt(await api.squads.requestVideoAnalysis(props.squadId, props.matchId, part.videoId), true);
    schedule();
  } catch (e) {
    requestError.value = errorMessage(e);
  } finally {
    requesting.value = null;
  }
}

const cancelling = ref<string | null>(null);
async function cancel(part: VideoAnalysisPartDto) {
  if (!(await confirmDialog({
    title: 'Cancelar el análisis',
    message: part.state === 'Running' || part.pausedMidway
      ? 'Se para el analizador (en unos segundos) y se pierde lo analizado hasta ahora. Si solo quieres liberar el equipo un rato, mejor «Pausar»: no se pierde nada. El vídeo y el acta no se tocan; puedes volver a pedirlo luego.'
      : 'El vídeo sale de la cola de análisis. Puedes volver a pedirlo cuando quieras.',
    confirmLabel: 'Cancelar el análisis',
    cancelLabel: 'Seguir',
    danger: true,
  }))) return;

  cancelling.value = part.videoId;
  requestError.value = null;
  try {
    adopt(await api.squads.cancelVideoAnalysis(props.squadId, props.matchId, part.videoId));
    schedule();
  } catch (e) {
    requestError.value = errorMessage(e);
  } finally {
    cancelling.value = null;
  }
}

// Pausar no pierde nada: lo que está en cola no empieza y lo que se analiza espera donde va hasta reanudarlo.
const pausing = ref<string | null>(null);
async function togglePause(part: VideoAnalysisPartDto) {
  const resume = part.state === 'Paused';
  pausing.value = part.videoId;
  requestError.value = null;
  try {
    adopt(resume
      ? await api.squads.resumeVideoAnalysis(props.squadId, props.matchId, part.videoId)
      : await api.squads.pauseVideoAnalysis(props.squadId, props.matchId, part.videoId));
  } catch (e) {
    requestError.value = errorMessage(e);
    // Puede que mientras tanto haya terminado o lo haya tocado otro: se enseña cómo está.
    void load(true);
  } finally {
    pausing.value = null;
    schedule();
  }
}

// --- Datos de equipo: lo que propone el vídeo (sumadas sus partes) frente a lo que hay en el acta ---

interface TeamRow {
  field: VideoTeamField;
  label: string;
  video: [number | null, number | null];
  current: [number | null, number | null];
  /** Por qué no se propone, cuando el vídeo sí tiene el dato pero no se vuelca (la posesión de confianza baja). */
  note?: string;
}

const stats = computed<TeamMatchStatsDto | null>(() => props.sheet.teamStats ?? null);

const teamRows = computed<TeamRow[]>(() => {
  const chosen = chosenParts.value;
  if (chosen.length === 0) return [];

  const mine = (part: VideoAnalysisPartDto) => part.teams.find((t) => t.index === ourTeam[part.videoId]);
  const theirs = (part: VideoAnalysisPartDto) => part.teams.find((t) => t.index !== ourTeam[part.videoId]);
  type Counter = 'shots' | 'shotsOnTarget' | 'corners' | 'throwIns' | 'goalKicks' | 'fouls' | 'offsides';
  const sum = (side: typeof mine, key: Counter) => chosen.reduce((total, part) => total + (side(part)?.[key] ?? 0), 0);

  // La posesión de las dos partes, ponderada por lo que se analizó de cada una (como hace la API al volcar). La de
  // confianza baja (el balón se vio poco) se enseña en la tarjeta del equipo, pero no se vuelca: queda fuera.
  const weighted = chosen
    .filter((part) => mine(part)?.possessionConfidence !== 'Low')
    .map((part) => ({ value: mine(part)?.possessionPct ?? null, weight: Math.max(1, part.quality?.analyzedSeconds ?? 0) }))
    .filter((p): p is { value: number; weight: number } => p.value !== null);
  const possession = weighted.length
    ? Math.round(weighted.reduce((total, p) => total + p.value * p.weight, 0) / weighted.reduce((total, p) => total + p.weight, 0))
    : null;
  const retained = chosen.filter((part) => mine(part)?.possessionConfidence === 'Low' && mine(part)?.possessionPct !== null);
  const retainedNote = possession === null && retained.length > 0
    ? `Retenida: confianza baja (balón en el ${percent(Math.min(...retained.map((part) => mine(part)?.possessionBallPct ?? 0)))} % del tramo)`
    : undefined;

  const s = stats.value;
  const counter = (field: VideoTeamField, label: string, key: Counter, mineNow: number | undefined, theirsNow: number | undefined): TeamRow =>
    ({ field, label, video: [sum(mine, key), sum(theirs, key)], current: [mineNow ?? null, theirsNow ?? null] });

  return [
    {
      field: 'Possession',
      label: 'Posesión (%)',
      video: [possession, possession === null ? null : 100 - possession],
      current: [s?.possessionPct ?? null, s?.possessionPct == null ? null : 100 - s.possessionPct],
      note: retainedNote,
    },
    counter('Shots', 'Tiros', 'shots', s?.shotsFor, s?.shotsAgainst),
    counter('ShotsOnTarget', 'Tiros a puerta', 'shotsOnTarget', s?.shotsOnTargetFor, s?.shotsOnTargetAgainst),
    counter('Corners', 'Córners', 'corners', s?.cornersFor, s?.cornersAgainst),
    counter('ThrowIns', 'Saques de banda', 'throwIns', s?.throwInsFor, s?.throwInsAgainst),
    counter('GoalKicks', 'Saques de puerta', 'goalKicks', s?.goalKicksFor, s?.goalKicksAgainst),
    // Las que comete el rival son las que recibimos; y sus fueras de juego, los que le pitan a él.
    counter('Fouls', 'Faltas cometidas', 'fouls', s?.foulsCommitted, s?.foulsReceived),
    counter('Offsides', 'Fueras de juego', 'offsides', s?.offsidesFor, s?.offsidesAgainst),
  ];
});

/** Un cero (o la posesión sin dato) no es una propuesta: el vídeo no vio nada. */
const proposes = (row: TeamRow) => (row.field === 'Possession' ? row.video[0] !== null : row.video.some((v) => (v ?? 0) > 0));
/** El acta ya tiene apuntado otro valor en lo que el vídeo cambiaría (solo cuenta el lado del equipo en la posesión). */
const overwrites = (row: TeamRow) =>
  (row.field === 'Possession' ? [0] : [0, 1]).some((i) => {
    const had = row.current[i] ?? 0;
    const video = row.video[i] ?? 0;
    return video !== 0 && had !== 0 && had !== video;
  });
/** Lo que ya coincide con el acta no hace falta volcarlo. */
const sameAsSheet = (row: TeamRow) =>
  (row.field === 'Possession' ? [0] : [0, 1]).every((i) => (row.video[i] ?? 0) === 0 || (row.video[i] ?? 0) === (row.current[i] ?? 0));

/** Marcado por defecto lo que rellena un hueco; lo que pisaría un dato del acta se deja para que lo decida el técnico. */
const ticked = reactive<Partial<Record<VideoTeamField, boolean>>>({});
const isTicked = (row: TeamRow) => proposes(row) && !sameAsSheet(row) && (ticked[row.field] ?? !overwrites(row));
const acceptedFields = computed(() => teamRows.value.filter(isTicked).map((row) => row.field));

// --- Jugadores seguidos ---

const playerOptions = computed<SelectOption[]>(() =>
  props.sheet.entries.map(({ player }) => ({
    value: player.id,
    label: player.fullName,
    hint: player.position ? positionShortLabels[player.position] : undefined,
    photo: player.photoUrl,
  })),
);

const hasActions = (a: VideoPlayerActions) =>
  a.shots > 0 || a.goals > 0 || a.saves > 0 || a.recoveries > 0 || a.ballLosses > 0 || a.passesAttempted > 0 || (a.fouls ?? 0) > 0;

/** Los del equipo elegido: identificados, por dorsal; si no, primero los que traen algo para el acta y los que más se ha visto. */
function playersOf(part: VideoAnalysisPartDto): VideoAnalysisPlayerDto[] {
  const mine = part.players.filter((p) => p.team === ourTeam[part.videoId]);
  if (part.identified) return mine.sort((a, b) => (a.shirtNumber ?? 100) - (b.shirtNumber ?? 100) || a.tracklet - b.tracklet);
  return mine.sort((a, b) => Number(hasActions(b.proposal)) - Number(hasActions(a.proposal)) || b.minutesVisible - a.minutesVisible || a.tracklet - b.tracklet);
}
const samplesOf = (part: VideoAnalysisPartDto, team: number) =>
  part.players.filter((p) => p.team === team && p.cropUrl).sort((a, b) => b.minutesVisible - a.minutesVisible).slice(0, 4);

function describe(a: VideoPlayerActions): string {
  const bits = [
    a.shots > 0 && `${a.shots} ${a.shots === 1 ? 'tiro' : 'tiros'}${a.shotsOnTarget > 0 ? ` (${a.shotsOnTarget} a puerta)` : ''}`,
    a.goals > 0 && `${a.goals} ${a.goals === 1 ? 'gol' : 'goles'}`,
    a.passesAttempted > 0 && `${a.passesCompleted}/${a.passesAttempted} pases`,
    a.recoveries > 0 && `${a.recoveries} ${a.recoveries === 1 ? 'recuperación' : 'recuperaciones'}`,
    a.ballLosses > 0 && `${a.ballLosses} ${a.ballLosses === 1 ? 'pérdida' : 'pérdidas'}`,
    a.saves > 0 && `${a.saves} ${a.saves === 1 ? 'parada' : 'paradas'}`,
    (a.fouls ?? 0) > 0 && `${a.fouls} ${a.fouls === 1 ? 'falta cometida' : 'faltas cometidas'}`,
    (a.foulsReceived ?? 0) > 0 && `${a.foulsReceived} ${a.foulsReceived === 1 ? 'falta recibida' : 'faltas recibidas'}`,
    (a.offsides ?? 0) > 0 && `${a.offsides} ${a.offsides === 1 ? 'fuera de juego' : 'fueras de juego'}`,
  ].filter(Boolean);
  return bits.length ? bits.join(' · ') : 'Sin acciones con balón que llevar al acta';
}

function assign(videoId: string, tracklet: number, value: string | number | null) {
  (assigned[videoId] ??= {})[tracklet] = typeof value === 'string' ? value : null;
  applied.value = null;
}

function chooseTeam(part: VideoAnalysisPartDto, team: number) {
  if (teamFixed(part) || ourTeam[part.videoId] === team) return;
  ourTeam[part.videoId] = team;
  // Los jugadores asignados eran del otro equipo.
  assigned[part.videoId] = proposedAssignments(part, team);
  shown[part.videoId] = part.identified ? part.players.length : PAGE;
  applied.value = null;
}

const assignments = computed(() =>
  chosenParts.value.map((part) => ({
    videoId: part.videoId,
    ourTeam: ourTeam[part.videoId] as number,
    players: playersOf(part)
      .map((p) => ({ tracklet: p.tracklet, squadPlayerId: assigned[part.videoId]?.[p.tracklet] ?? null }))
      .filter((a): a is { tracklet: number; squadPlayerId: string } => !!a.squadPlayerId),
  })),
);
const assignedCount = computed(() => assignments.value.reduce((total, part) => total + part.players.length, 0));
const nothingToApply = computed(() => acceptedFields.value.length === 0 && assignedCount.value === 0);

// --- Volcar al acta ---

const applying = ref(false);
const applyError = ref<string | null>(null);
const applied = ref<{ team: number; lines: number; untouched: number; fromSheet: number } | null>(null);
/** Con el acta oficial cerrada: minutos, titulares, goles y tarjetas de ella, también de los que no salen en el vídeo. */
const fillFromOfficialSheet = ref(true);
const officialSheetClosed = computed(() => analysis.value?.officialSheetClosed ?? false);

async function apply(overwrite = false) {
  if (!overwrite && props.unsavedSheet && !(await confirmDialog({
    title: 'Tienes cambios sin guardar en el acta',
    message: 'Al volcar la propuesta se recarga el acta y lo que hayas escrito en la tabla sin guardar se pierde. Guarda antes el acta si quieres conservarlo.',
    confirmLabel: 'Volcar y descartarlos',
    cancelLabel: 'Cancelar',
    danger: true,
  }))) return;

  applying.value = true;
  applyError.value = null;
  applied.value = null;
  try {
    const result = await api.squads.applyVideoAnalysis(props.squadId, props.matchId, {
      videos: assignments.value,
      teamFields: acceptedFields.value,
      overwrite,
      fillFromOfficialSheet: fillFromOfficialSheet.value,
    });
    for (const field of Object.keys(ticked) as VideoTeamField[]) delete ticked[field];
    adopt(result.analysis);
    applied.value = {
      team: result.teamValuesWritten,
      lines: result.linesWritten,
      untouched: result.playersWithoutChanges,
      fromSheet: result.linesFromOfficialSheet ?? 0,
    };
    emit('applied', result.sheet);
  } catch (e) {
    // El acta ya tiene otros valores en algo de lo que se vuelca: se enseña qué cambia y se pide confirmarlo dos veces.
    if (e instanceof ApiError && e.code === 'video_analysis.overwrite' && !overwrite) {
      const first = await confirmDialog({
        title: 'El acta ya tiene datos apuntados',
        message: `${e.message} El resto de la propuesta solo rellena lo que estaba vacío.`,
        confirmLabel: 'Continuar',
        cancelLabel: 'Revisarlo',
      });
      const second = first && await confirmDialog({
        title: '¿Seguro? Se sustituye lo apuntado',
        message: 'Los valores del acta de esa lista se cambian por los del vídeo y no se pueden recuperar. Lo demás del acta no se toca.',
        confirmLabel: 'Sí, sobrescribir',
        cancelLabel: 'No, volver',
        danger: true,
      });
      if (second) {
        await apply(true);
        return;
      }
    } else {
      applyError.value = errorMessage(e);
    }
  } finally {
    applying.value = false;
  }
}
</script>

<template>
  <section id="video-proposal" class="card scroll-mt-20" aria-labelledby="video-proposal-title">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 id="video-proposal-title" class="font-semibold text-slate-900"><Icon icon="video" class="mr-1.5 h-3.5 w-3.5 text-accent-400" />Del vídeo</h2>
        <p class="text-xs text-slate-500">
          Lo que el analizador saca del vídeo del partido, como propuesta: revísala, di qué jugador es cada uno y vuelca al acta solo lo que aceptes.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <template v-if="!open">
          <Badge v-for="part in parts" :key="part.videoId" :tone="stateTones[part.state]">
            <template v-if="parts.length > 1">{{ videoPartLabels[part.part] }} · </template>{{ part.state === 'Ready' && part.appliedAt ? 'Volcado al acta' : stateLabels[part.state] }}<template v-if="part.state === 'Running' || part.pausedMidway"> · {{ part.progress }} %</template>
          </Badge>
        </template>
        <button v-if="analysis && parts.length > 0" type="button" class="btn-ghost px-3 py-1 text-xs" :aria-expanded="open" aria-controls="video-proposal-body" @click="open = !open">
          <Icon icon="chevron-down" class="h-3 w-3 transition-transform" :class="open ? 'rotate-180' : ''" />{{ open ? 'Ocultar' : 'Ver la propuesta' }}
        </button>
      </div>
    </div>

    <p v-if="loading" class="mt-4 text-sm text-slate-500">Cargando la propuesta del vídeo…</p>
    <Alert v-else-if="loadError" kind="error" class="mt-4">{{ loadError }}</Alert>

    <div v-else-if="analysis" v-show="open || parts.length === 0" id="video-proposal-body">
      <div v-if="parts.length === 0" class="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600">
        <p>
          Este partido todavía no tiene vídeo de tu plantilla.
          <template v-if="analysis.enabled">Al subirlo se comprime y, cuando termina, se analiza solo.</template>
        </p>
        <button v-if="canManage" type="button" class="btn-secondary px-3 py-1 text-xs" @click="emit('go-video')">
          <Icon icon="cloud-arrow-up" class="h-3 w-3" />Subir el vídeo
        </button>
      </div>

      <Alert v-if="requestError" kind="error" class="mt-4">{{ requestError }}</Alert>
      <Alert v-if="noAnalyzer" kind="warning" class="mt-4">
        <strong>No hay ningún analizador encendido</strong>: lo que está en cola no avanzará hasta que arranque uno. Arranca
        <code>Start-Analyzer.ps1</code> en el equipo con la tarjeta gráfica (Start-Docker.ps1 lo hace solo si encuentra la GPU y uv).
        <template v-if="analysis.analyzerSeenAt"> Última señal: {{ formatKickoff(analysis.analyzerSeenAt) }}.</template>
      </Alert>

      <div v-for="part in parts" :key="part.videoId" class="mt-4 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <p class="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-800">
            {{ videoPartLabels[part.part] }}
            <Badge :tone="stateTones[part.state]">
              <Icon v-if="part.state === 'Running'" icon="rotate-right" class="mr-1 h-3 w-3 animate-spin" />
              <Icon v-else-if="part.state === 'Paused'" icon="pause" class="mr-1 h-3 w-3" />
              {{ stateLabels[part.state] }}<template v-if="part.state === 'Running' || part.pausedMidway"> · {{ part.progress }} %</template>
            </Badge>
            <span v-if="part.state === 'Ready' && part.finishedAt" class="text-xs font-normal text-slate-500">analizado el {{ formatKickoff(part.finishedAt) }}</span>
          </p>
          <div v-if="canManage && ['Pending', 'Running', 'Paused'].includes(part.state)" class="flex flex-wrap gap-2">
            <button
              v-busy="pausing === part.videoId"
              type="button"
              :class="part.state === 'Paused' ? 'btn-primary' : 'btn-secondary'"
              class="px-3 py-1 text-xs"
              :disabled="pausing !== null || cancelling !== null || requesting !== null"
              :title="part.state === 'Paused' ? 'Sigue donde se quedó' : 'Para sin perder nada de lo analizado'"
              @click="togglePause(part)"
            >
              <Icon :icon="part.state === 'Paused' ? 'play' : 'pause'" class="h-3 w-3" />{{ part.state === 'Paused' ? 'Reanudar' : 'Pausar' }}
            </button>
            <button
              v-busy="cancelling === part.videoId"
              type="button"
              class="btn-ghost px-3 py-1 text-xs"
              :disabled="pausing !== null || cancelling !== null || requesting !== null"
              @click="cancel(part)"
            >
              <Icon icon="xmark" class="h-3 w-3" />Cancelar
            </button>
          </div>
          <button
            v-if="canManage && analysis.enabled && ['NotRequested', 'Ready', 'Failed', 'Cancelled'].includes(part.state)"
            v-busy="requesting === part.videoId"
            type="button"
            :class="part.state === 'Ready' ? 'btn-secondary' : 'btn-primary'"
            class="px-3 py-1 text-xs"
            :disabled="requesting !== null || applying"
            :title="`Tarda ${duration(part)}`"
            @click="request(part)"
          >
            <Icon :icon="part.state === 'NotRequested' || part.state === 'Cancelled' ? 'magnifying-glass' : 'rotate-right'" class="h-3 w-3" />
            {{ part.state === 'NotRequested' || part.state === 'Cancelled' ? 'Analizar el vídeo' : part.state === 'Failed' ? 'Volver a intentarlo' : 'Volver a analizar' }}
          </button>
        </div>

        <!-- Estados sin propuesta -->
        <p v-if="part.state === 'WaitingForVideo'" class="mt-2 text-sm text-slate-600">
          <Icon icon="hourglass-half" class="mr-1 h-3.5 w-3.5 text-amber-500" />El vídeo se está comprimiendo<template v-if="part.videoStatus === 'Processing'"> ({{ part.videoProgress }} %)</template>:
          <template v-if="analysis.enabled">el análisis empieza solo cuando termine.</template><template v-else>cuando termine se podrá ver, pero en este servidor no se analiza.</template>
        </p>
        <p v-else-if="part.state === 'NotRequested'" class="mt-2 text-sm text-slate-600">
          <template v-if="analysis.enabled">Este vídeo todavía no se ha analizado.</template>
          <template v-else>El análisis de vídeo no está disponible en este servidor: hace falta una máquina con tarjeta gráfica.</template>
        </p>
        <p v-else-if="part.state === 'Pending'" class="mt-2 text-sm text-slate-600">
          <Icon icon="clock" class="mr-1 h-3.5 w-3.5 text-amber-500" />En cola: empieza en cuanto el analizador quede libre (los vídeos van de uno en uno) y tarda {{ duration(part) }}.
          <span v-if="part.error" class="mt-1 block text-xs text-slate-500">Se vuelve a intentar: {{ part.error }}</span>
        </p>
        <p v-else-if="part.state === 'Cancelled'" class="mt-2 text-sm text-slate-600">
          Análisis cancelado<template v-if="part.finishedAt"> el {{ formatKickoff(part.finishedAt) }}</template>. El vídeo y el acta siguen como estaban; puedes volver a pedirlo cuando quieras.
        </p>
        <div v-else-if="part.state === 'Running' || part.state === 'Paused'">
          <VideoAnalysisProgress :part="part" />
          <p v-if="part.state === 'Running'" class="mt-2 text-[11px] text-slate-400">Se analiza en segundo plano: puedes cerrar esta página y volver luego.</p>
        </div>
        <Alert v-else-if="part.state === 'Failed'" kind="error" class="mt-3">
          No se ha podido analizar el vídeo: {{ part.error ?? 'error desconocido' }}
        </Alert>

        <!-- Propuesta lista -->
        <template v-else-if="part.state === 'Ready' && part.quality">
          <dl class="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
              <dt class="eyebrow">Fotogramas con balón</dt>
              <dd class="mt-0.5 font-figures text-xl font-extrabold tabular-nums" :class="part.quality.lowBall ? 'text-amber-600' : 'text-slate-900'">{{ percent(part.quality.ballFramesPct) }} %</dd>
              <dd v-if="ballKnownPct(part) !== null" class="text-[11px] text-slate-500">con la trayectoria: {{ percent(ballKnownPct(part)!) }} %</dd>
            </div>
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
              <dt class="eyebrow">Campo calibrado</dt>
              <dd class="mt-0.5 font-figures text-xl font-extrabold tabular-nums" :class="part.quality.lowCalibration ? 'text-amber-600' : 'text-slate-900'">{{ percent(part.quality.calibratedFramesPct) }} %</dd>
            </div>
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
              <dt class="eyebrow">Tramo analizado</dt>
              <dd class="mt-0.5 font-figures text-xl font-extrabold tabular-nums text-slate-900">{{ Math.max(1, Math.round(part.quality.analyzedSeconds / 60)) }} min</dd>
            </div>
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2">
              <dt class="eyebrow">Campo</dt>
              <dd class="mt-0.5 font-figures text-xl font-extrabold tabular-nums text-slate-900">
                <template v-if="part.quality.pitchLengthM && part.quality.pitchWidthM">{{ metres(part.quality.pitchLengthM) }} × {{ metres(part.quality.pitchWidthM) }} m</template>
                <template v-else>—</template>
              </dd>
              <dd v-if="part.quality.genericPitch" class="text-[11px] text-slate-500">medidas genéricas</dd>
            </div>
          </dl>
          <Alert v-if="part.quality.lowBall || part.quality.lowCalibration || part.quality.lowRead" kind="warning" class="mt-3">
            <strong>Calidad baja: tómalo como orientación.</strong>
            <template v-if="part.quality.lowRead && part.quality.readFramesPct !== null"> Solo se pudo leer el {{ percent(part.quality.readFramesPct) }} % de los fotogramas del vídeo (el archivo parece dañado o cortado): todo sale de menos; prueba a volver a subirlo.</template>
            <template v-if="part.quality.lowBall"> El balón solo se ve en el {{ percent(part.quality.ballFramesPct) }} % de los fotogramas: la posesión se mide solo sobre el tiempo con balón y, si su confianza es baja, no se vuelca al acta; los pases y las recuperaciones salen de menos.</template>
            <template v-if="part.quality.lowCalibration"> El campo solo se ha podido calibrar en el {{ percent(part.quality.calibratedFramesPct) }} %: fueras, córners y tiros salen de menos.</template>
            Mejora con una cámara fija y alta y el juego lo más cerca posible.
          </Alert>
          <p v-if="part.quality.genericPitch" class="mt-2 text-xs text-slate-500">
            El campo se ha calibrado con medidas genéricas (120 × 70 m). No hacen falta para la posesión ni para los tiros; las reales, que el club del equipo local
            puede apuntar en la ficha de su equipo, afinan las distancias y los tercios del campo.
          </p>

          <!-- Cuál de los dos equipos es el nuestro -->
          <fieldset class="mt-4">
            <legend class="label">{{ teamFixed(part) ? 'Los dos equipos del vídeo' : `¿Cuál de los dos es ${sheet.squad.teamName}?` }}</legend>
            <p v-if="teamFixed(part)" class="mb-2 text-xs text-slate-500">
              Por los dorsales del acta oficial, {{ sheet.squad.teamName }} es el equipo {{ teamLetter(part.suggestedOurTeam!) }}: solo se identifican y se vinculan a
              tu plantilla sus jugadores. {{ rivalName }} es el rival: cuenta para los datos del equipo (posesión, faltas, fueras de juego…), no para tus fichas.
            </p>
            <p v-else class="mb-2 text-xs text-slate-500">El analizador separa a los jugadores por el color de la equipación, pero no sabe de qué club es cada una.</p>
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <component
                :is="teamFixed(part) ? 'div' : 'button'"
                v-for="team in part.teams"
                :key="team.index"
                v-bind="teamFixed(part) ? {} : { type: 'button', 'aria-pressed': ourTeam[part.videoId] === team.index }"
                class="flex items-center gap-3 rounded-xl border p-3 text-left transition"
                :class="ourTeam[part.videoId] === team.index ? 'border-accent-400 bg-brand-500/10' : teamFixed(part) ? 'border-line bg-surface' : 'border-line bg-surface hover:border-brand-400'"
                @click="chooseTeam(part, team.index)"
              >
                <span class="h-9 w-9 shrink-0 rounded-full ring-1 ring-line" :style="{ backgroundColor: team.color ?? 'transparent' }" aria-hidden="true" />
                <span class="min-w-0 flex-1">
                  <template v-if="teamFixed(part)">
                    <span class="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-900">
                      <span class="truncate">{{ ourTeam[part.videoId] === team.index ? sheet.squad.teamName : rivalName }}</span>
                      <Badge :tone="ourTeam[part.videoId] === team.index ? 'blue' : 'slate'" class="shrink-0">{{ ourTeam[part.videoId] === team.index ? 'Tu equipo' : 'Rival' }}</Badge>
                    </span>
                    <span class="block text-xs text-slate-500">
                      Equipo {{ teamLetter(team.index) }}<template v-if="team.side"> · {{ sideLabels[team.side] }}</template><template v-if="ourTeam[part.videoId] === team.index"> · {{ team.players }} {{ team.players === 1 ? 'jugador identificado' : 'jugadores identificados' }}</template><template v-if="team.possessionPct !== null"> · {{ team.possessionPct }} % de posesión<template v-if="team.possessionConfidence"> ({{ confidenceLabels[team.possessionConfidence] }})</template></template>
                    </span>
                  </template>
                  <template v-else>
                    <span class="block text-sm font-semibold text-slate-900">
                      Equipo {{ teamLetter(team.index) }}<template v-if="team.side"> · {{ sideLabels[team.side] }}</template>
                      <Icon v-if="ourTeam[part.videoId] === team.index" icon="circle-check" class="ml-1 h-3.5 w-3.5 text-accent-400" />
                    </span>
                    <span class="block text-xs text-slate-500">{{ team.players }} {{ part.identified ? (team.players === 1 ? 'jugador identificado' : 'jugadores identificados') : (team.players === 1 ? 'jugador seguido' : 'jugadores seguidos') }}<template v-if="team.possessionPct !== null"> · {{ team.possessionPct }} % de posesión<template v-if="team.possessionConfidence"> ({{ confidenceLabels[team.possessionConfidence] }})</template></template></span>
                  </template>
                </span>
                <span class="flex shrink-0 gap-1">
                  <VideoCrop v-for="sample in samplesOf(part, team.index)" :key="sample.tracklet" :url="sample.cropUrl" :alt="`Jugador del equipo ${teamLetter(team.index)}`" size="sm" />
                </span>
              </component>
            </div>
          </fieldset>

          <!-- Jugadores seguidos del equipo elegido -->
          <div v-if="ourTeam[part.videoId] !== null && ourTeam[part.videoId] !== undefined" class="mt-5">
            <template v-if="part.identified">
              <h3 class="text-sm font-semibold text-slate-900">Jugadores identificados ({{ playersOf(part).length }})</h3>
              <p class="text-xs text-slate-500">
                Los de {{ sheet.squad.teamName }}, cada uno por el dorsal que se le lee en la espalda, cruzado con tu lado del acta oficial (solo los
                que jugaron y en sus minutos), y ya con su ficha. Cambia la ficha solo si no es él.
                <template v-if="unidentifiedMinutes(part) > 0">Hay {{ unidentifiedMinutes(part) }} min de jugadores a la vista sin identificar: cuentan para el equipo, no para nadie en concreto.</template>
              </p>
            </template>
            <template v-else>
              <h3 class="text-sm font-semibold text-slate-900">Jugadores seguidos ({{ playersOf(part).length }})</h3>
              <p class="text-xs text-slate-500">
                Cada vez que el analizador pierde de vista a un jugador y lo vuelve a encontrar le da otro número: asigna a la misma ficha todos los
                tramos de un jugador y sus acciones se suman.
              </p>
            </template>
            <p v-if="playersOf(part).length === 0" class="mt-2 text-sm text-slate-500">
              {{ part.identified ? 'No se ha podido leer el dorsal de ningún jugador de este equipo.' : 'El analizador no ha seguido a ningún jugador de este equipo durante medio minuto.' }}
            </p>
            <ul v-else class="mt-3 divide-y divide-slate-100 rounded-xl border border-line">
              <li v-for="player in playersOf(part).slice(0, shown[part.videoId] ?? PAGE)" :key="player.tracklet" class="flex flex-wrap items-center gap-3 px-3 py-2">
                <VideoCrop :url="player.cropUrl" :alt="part.identified ? `Dorsal ${player.shirtNumber} en el vídeo` : `Jugador seguido n.º ${player.tracklet}`" />
                <div class="min-w-0 flex-1 basis-56">
                  <p v-if="part.identified" class="text-sm font-medium text-slate-800">
                    Dorsal {{ player.shirtNumber }}<template v-if="player.sheetName"> · {{ player.sheetName }}</template>
                    <Badge v-if="player.goalkeeper" tone="blue" class="ml-1">Portero</Badge>
                    <Badge v-if="player.shirtConfidence !== null && player.shirtConfidence < DOUBTFUL_SHIRT" tone="amber" class="ml-1" title="Pocas lecturas claras de su número: míralo en el recorte">Dorsal dudoso</Badge>
                  </p>
                  <p v-else class="text-sm font-medium text-slate-800">
                    Seguido n.º {{ player.tracklet }}
                    <Badge v-if="player.goalkeeper" tone="blue" class="ml-1">Portero</Badge>
                    <Badge v-if="player.shirtNumber" tone="slate" class="ml-1">¿Dorsal {{ player.shirtNumber }}?</Badge>
                  </p>
                  <p class="text-xs text-slate-500">
                    Del {{ player.from }} al {{ player.to }} · {{ player.minutesVisible }} min a la vista<template v-if="player.sheetMinutes !== null"> · <span class="text-slate-700" title="Por descarte: sin cambio, el partido entero, aunque el vídeo no lo vea todo el rato">{{ player.sheetMinutes }} min jugados según el acta</span></template>
                    · {{ player.distanceM.toLocaleString('es-ES') }} m
                  </p>
                  <p class="mt-0.5 text-xs" :class="hasActions(player.proposal) ? 'text-slate-700' : 'text-slate-400'">{{ describe(player.proposal) }}</p>
                </div>
                <div v-if="canManage" class="w-full sm:w-64">
                  <SearchSelect
                    :model-value="assigned[part.videoId]?.[player.tracklet] ?? null"
                    :options="playerOptions"
                    placeholder="— Sin asignar —"
                    clearable
                    searchable
                    size="sm"
                    :aria-label="part.identified ? `Ficha del dorsal ${player.shirtNumber}` : `Ficha del jugador seguido n.º ${player.tracklet}`"
                    @update:model-value="(value) => assign(part.videoId, player.tracklet, value)"
                  />
                </div>
              </li>
            </ul>
            <button
              v-if="playersOf(part).length > (shown[part.videoId] ?? PAGE)"
              type="button"
              class="btn-ghost mt-2 px-3 py-1 text-xs"
              @click="shown[part.videoId] = (shown[part.videoId] ?? PAGE) + PAGE * 2"
            >
              Mostrar más ({{ playersOf(part).length - (shown[part.videoId] ?? PAGE) }} sin enseñar)
            </button>
          </div>

          <p class="mt-3 text-[11px] text-slate-400">Analizador {{ part.analyzerVersion }} · {{ part.weights }}</p>
        </template>
      </div>

      <!-- Datos de equipo: vídeo frente a acta -->
      <div v-if="teamRows.length > 0" class="mt-5 border-t border-slate-100 pt-4">
        <h3 class="text-sm font-semibold text-slate-900">Datos del equipo</h3>
        <p class="text-xs text-slate-500">
          <template v-if="chosenParts.length > 1">Sumadas las {{ chosenParts.length }} partes. </template>
          Marca los que quieras llevar al acta. Una falta sale cuando el juego se para con el balón en el campo y el rival tenía a alguien a menos de 5 m
          del que llevaba el balón (la recibe él; la comete el rival más cercano), y un fuera de juego cuando además saca el otro equipo desde donde
          estaba el atacante adelantado: salen de menos, nunca de más. Las tarjetas no salen del vídeo.
        </p>
        <div class="mt-3 overflow-x-auto">
          <table class="w-full min-w-[32rem] text-sm">
            <thead class="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th v-if="canManage" class="w-10 px-2 py-2 text-center" scope="col"><span class="sr-only">Aceptar</span></th>
                <th class="px-2 py-2 text-left" scope="col">Dato</th>
                <th class="px-2 py-2 text-center" scope="col">Vídeo<span class="block text-[10px] font-normal normal-case tracking-normal text-slate-400">{{ sheet.squad.teamName }} · rival</span></th>
                <th class="px-2 py-2 text-center" scope="col">Acta ahora<span class="block text-[10px] font-normal normal-case tracking-normal text-slate-400">{{ sheet.squad.teamName }} · rival</span></th>
                <th class="px-2 py-2 text-left" scope="col"><span class="sr-only">Qué pasa al volcar</span></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in teamRows" :key="row.field" :class="proposes(row) ? '' : 'text-slate-400'">
                <td v-if="canManage" class="px-2 py-1.5 text-center">
                  <input
                    type="checkbox"
                    class="h-4 w-4 rounded border-slate-300 text-accent-400"
                    :checked="isTicked(row)"
                    :disabled="!proposes(row) || sameAsSheet(row)"
                    :aria-label="`Llevar al acta: ${row.label}`"
                    @change="ticked[row.field] = ($event.target as HTMLInputElement).checked"
                  />
                </td>
                <td class="px-2 py-1.5 font-medium" :class="proposes(row) ? 'text-slate-700' : ''">{{ row.label }}</td>
                <td class="px-2 py-1.5 text-center font-figures tabular-nums">
                  <span class="font-semibold" :class="proposes(row) ? 'text-slate-900' : ''">{{ row.video[0] ?? '—' }}</span>
                  <span class="mx-1.5 text-slate-400">·</span>{{ row.video[1] ?? '—' }}
                </td>
                <td class="px-2 py-1.5 text-center font-figures tabular-nums text-slate-500">{{ row.current[0] ?? '—' }}<span class="mx-1.5 text-slate-400">·</span>{{ row.current[1] ?? '—' }}</td>
                <td class="px-2 py-1.5 text-xs">
                  <span v-if="!proposes(row)" class="text-slate-400">{{ row.note ?? 'El vídeo no lo ha visto' }}</span>
                  <span v-else-if="sameAsSheet(row)" class="text-slate-500">Ya coincide con el acta</span>
                  <Badge v-else-if="overwrites(row)" tone="amber">Cambia lo apuntado</Badge>
                  <span v-else class="text-emerald-700">Rellena lo que falta</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Volcar -->
      <div v-if="readyParts.length > 0" class="mt-5 border-t border-slate-100 pt-4">
        <Alert v-if="applyError" kind="error" class="mb-3">{{ applyError }}</Alert>
        <Alert v-if="applied" kind="success" class="mb-3">
          <template v-if="applied.team === 0 && applied.lines === 0">El acta ya tenía todo lo que has marcado: no ha cambiado nada.</template>
          <template v-else>
            Volcado al acta: {{ applied.team }} {{ applied.team === 1 ? 'dato' : 'datos' }} de equipo y {{ applied.lines }} {{ applied.lines === 1 ? 'línea' : 'líneas' }} de jugador.
          </template>
          <template v-if="applied.fromSheet > 0"> {{ applied.fromSheet }} {{ applied.fromSheet === 1 ? 'sale' : 'salen' }} solo del acta oficial: {{ applied.fromSheet === 1 ? 'jugó' : 'jugaron' }} sin que el vídeo {{ applied.fromSheet === 1 ? 'lo identificara' : 'los identificara' }}.</template>
          <template v-if="applied.untouched > 0"> {{ applied.untouched }} {{ applied.untouched === 1 ? 'jugador asignado no tenía' : 'jugadores asignados no tenían' }} nada que cambiar.</template>
          <template v-if="applied.lines > 0 && !(officialSheetClosed && fillFromOfficialSheet)"> Revisa abajo los minutos de las líneas nuevas.</template>
        </Alert>

        <label v-if="canManage && officialSheetClosed" class="mb-3 flex items-start gap-2 text-sm text-slate-700">
          <input v-model="fillFromOfficialSheet" type="checkbox" class="mt-0.5 h-4 w-4 rounded border-slate-300 text-accent-400" />
          <span>
            Completar con el acta oficial
            <span class="block text-xs text-slate-500">
              El acta oficial está cerrada: los minutos (sin cambio, el partido entero, aunque el vídeo no lo vea todo el rato), quién fue titular, los goles y
              las tarjetas salen de ella, también para los que jugaron y el vídeo no identificó.
            </span>
          </span>
        </label>

        <div v-if="canManage" class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-slate-500">
            <template v-if="chosenParts.length === 0">Elige primero cuál de los dos equipos es el tuyo.</template>
            <template v-else>
              Vas a volcar {{ acceptedFields.length }} {{ acceptedFields.length === 1 ? 'dato' : 'datos' }} de equipo y {{ assignedCount }}
              {{ assignedCount === 1 ? 'jugador asignado' : 'jugadores asignados' }}.
            </template>
          </p>
          <button type="button" class="btn-primary" v-busy="applying" :disabled="applying || nothingToApply || chosenParts.length === 0" @click="apply()">
            Volcar al acta
          </button>
        </div>
        <p v-else-if="!analysis.canManage" class="text-xs text-slate-500">Solo el club y su cuerpo técnico pueden volcar la propuesta al acta.</p>

        <p class="content-note mt-3">
          El vídeo propone, tú decides: un dato que el vídeo no ha visto nunca borra lo apuntado, y si lo que vuelcas cambia algo que ya estaba en el
          acta se te pide confirmarlo dos veces.
          <template v-if="officialSheetClosed && fillFromOfficialSheet">Los minutos, los titulares, los goles y las tarjetas son los del acta oficial.</template>
          <template v-else>
            A quien no tenía línea se le crea con los minutos que se le ha visto en el vídeo (corrígelos en el acta) y los goles solo se apuntan a quien
            no tuviera ninguno: mandan los del acta oficial.
          </template>
        </p>
      </div>
    </div>
  </section>
</template>
