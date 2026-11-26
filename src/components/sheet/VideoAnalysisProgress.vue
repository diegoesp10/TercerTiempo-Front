<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue';
import { useFit } from '@/composables/useFit';
import type { VideoAnalysisLive, VideoAnalysisPartDto } from '@/types/api';

/**
 * Lo que está haciendo el analizador con un vídeo mientras lo analiza (o lo tiene en pausa): en qué etapa va, por qué
 * minuto del vídeo, a cuántos jugadores sigue, cuánto balón y campo ve, a qué velocidad va, lo que le queda y lo que ha
 * ido sabiendo. Lo cuenta el analizador cada pocos segundos; aquí solo se enseña.
 */
const props = defineProps<{ part: VideoAnalysisPartDto }>();

// Reloj de la vista para «hace 4 s» y el tiempo que lleva, sin pedir nada al servidor.
const now = ref(Date.now());
const tick = setInterval(() => (now.value = Date.now()), 1000);
onBeforeUnmount(() => clearInterval(tick));

const live = computed<VideoAnalysisLive | null>(() => props.part.live);
const paused = computed(() => props.part.state === 'Paused');
/** Se pidió la pausa y el analizador todavía no ha parado (lo hace en el siguiente fotograma), o al revés. */
const pausing = computed(() => paused.value && props.part.pausedMidway && live.value !== null && !live.value.paused);
const resuming = computed(() => props.part.state === 'Running' && live.value?.paused === true);

const steps = [
  { key: 'models', label: 'Preparar', detail: 'Cargando los modelos en la tarjeta gráfica…' },
  { key: 'teams', label: 'Equipos', detail: 'Separando los dos equipos por el color de la camiseta…' },
  { key: 'tracking', label: 'Seguimiento', detail: 'Siguiendo a los jugadores y al balón fotograma a fotograma…' },
  { key: 'plays', label: 'Jugadas', detail: 'Sacando posesión, pases, tiros, córners y saques…' },
  { key: 'outputs', label: 'Propuesta', detail: 'Escribiendo la propuesta y los recortes de los jugadores…' },
] as const;
// Los nombres de todas las etapas, solo si caben enteros; si no, solo el de la etapa en curso (nunca «…»).
const stepsRow = ref<HTMLElement | null>(null);
useFit(stepsRow, [['labels'], []]);
/** El repaso con IA (cuando está activo) va dentro de las jugadas. */
const stepIndex = computed(() => {
  const stage = live.value?.stage === 'review' ? 'plays' : live.value?.stage;
  const index = steps.findIndex((s) => s.key === stage);
  return index < 0 ? (props.part.startedAt ? 0 : -1) : index;
});
const detail = computed(() => {
  if (live.value?.stage === 'review') return 'Repasando con IA las jugadas dudosas y los dorsales…';
  return stepIndex.value >= 0 ? steps[stepIndex.value].detail : 'Esperando su turno en el analizador…';
});

const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};
const span = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) return 'menos de un minuto';
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
};
const number = (value: number, digits = 1) => value.toLocaleString('es-ES', { maximumFractionDigits: digits });

/** Por dónde va dentro del tramo que analiza (0-100). */
const tramo = computed(() => {
  const l = live.value;
  if (!l || l.videoSecond == null || l.fromSecond == null || l.toSecond == null || l.toSecond <= l.fromSecond) return null;
  return Math.min(100, Math.max(0, ((l.videoSecond - l.fromSecond) / (l.toSecond - l.fromSecond)) * 100));
});
const teamSamples = computed(() => {
  const l = live.value;
  return l?.teamSamples != null && l.teamSamplesTarget ? Math.min(100, (l.teamSamples / l.teamSamplesTarget) * 100) : null;
});

/** Lo que lleva analizando, sin contar las pausas (la que está en curso tampoco). */
const elapsed = computed(() => {
  if (!props.part.startedAt) return null;
  const pausedNow = props.part.pausedAt ? Math.max(0, now.value - Date.parse(props.part.pausedAt)) / 1000 : 0;
  return Math.max(0, (now.value - Date.parse(props.part.startedAt)) / 1000 - props.part.pausedSeconds - pausedNow);
});
const pausedTotal = computed(() =>
  props.part.pausedSeconds + (props.part.pausedAt ? Math.max(0, now.value - Date.parse(props.part.pausedAt)) / 1000 : 0));
const since = computed(() => (props.part.liveAt ? Math.max(0, (now.value - Date.parse(props.part.liveAt)) / 1000) : null));
/** Analizándose y sin noticias desde hace más de un minuto: algo va lento o el analizador se ha parado. */
const quiet = computed(() => props.part.state === 'Running' && since.value !== null && since.value > 60);

const tiles = computed(() => {
  const l = live.value;
  if (!l) return [];
  const list: { label: string; value: string; hint?: string; tone?: 'warn' }[] = [];
  if (l.playersOnScreen != null) list.push({ label: 'Jugadores en imagen', value: String(l.playersOnScreen), hint: 'en el último fotograma' });
  if (l.playersTracked != null) list.push({ label: 'Tramos seguidos', value: String(l.playersTracked), hint: 'trozos de jugador: al final se juntan por el dorsal' });
  if (l.ballSeenPct != null) list.push({ label: 'Balón visto', value: `${number(l.ballSeenPct)} %`, hint: 'de los fotogramas', tone: l.ballSeenPct < 35 ? 'warn' : undefined });
  if (l.calibratedPct != null) list.push({ label: 'Campo calibrado', value: `${number(l.calibratedPct)} %`, hint: 'de los fotogramas', tone: l.calibratedPct < 50 ? 'warn' : undefined });
  if (l.speed != null) list.push({ label: 'Velocidad', value: `× ${number(l.speed, 2)}`, hint: l.fps != null ? `del tiempo real · ${number(l.fps)} fotogramas/s` : 'del tiempo real' });
  if (l.touches != null) list.push({ label: 'Toques de balón', value: number(l.touches, 0) });
  if (l.events != null) list.push({ label: 'Jugadas', value: number(l.events, 0), hint: 'pases, tiros, córners…' });
  return list;
});

const log = computed(() => [...(props.part.log ?? [])].reverse());
const showLog = ref(false);
const time = (iso: string) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
</script>

<template>
  <div class="mt-3 space-y-3">
    <!-- En pausa -->
    <div v-if="paused" class="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-slate-700" role="status">
      <p class="font-medium text-slate-900">
        <Icon icon="pause" class="mr-1 h-3.5 w-3.5 text-warning" />
        <template v-if="pausing">Pausando: el analizador para en el siguiente fotograma…</template>
        <template v-else-if="part.pausedMidway">En pausa, sin perder nada de lo analizado</template>
        <template v-else>En pausa: no se analiza hasta que lo reanudes</template>
      </p>
      <p class="mt-0.5 text-xs text-slate-600">
        <template v-if="part.pausedMidway">
          Espera donde iba<template v-if="live?.videoSecond != null"> (minuto {{ clock(live.videoSecond) }} del vídeo)</template> y al reanudar sigue desde ahí. La tarjeta
          gráfica deja de trabajar, pero los demás vídeos de la cola esperan detrás de este.
        </template>
        <template v-else-if="part.startedAt || part.progress > 0">El analizador se reinició mientras estaba en pausa: al reanudarlo vuelve a la cola y empieza desde el principio.</template>
        <template v-else>Estaba en cola: al reanudarlo vuelve a su sitio en la cola.</template>
        <template v-if="pausedTotal >= 1"> En pausa {{ span(pausedTotal) }}.</template>
      </p>
    </div>
    <p v-else-if="resuming" class="text-xs text-slate-500" role="status"><Icon icon="play" class="mr-1 h-3 w-3 text-accent-400" />Reanudando…</p>

    <!-- Etapas (con v-show: la fila ya existe para medirla y se vuelve a medir al aparecer) -->
    <ol v-show="part.state === 'Running' || part.pausedMidway" ref="stepsRow" class="group/steps flex items-center gap-1" aria-label="Etapas del análisis">
      <li v-for="(step, i) in steps" :key="step.key" class="flex items-center gap-1" :class="i === stepIndex ? 'flex-auto' : 'flex-1'" :aria-current="i === stepIndex ? 'step' : undefined">
        <span
          class="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-2xs font-bold"
          :class="i < stepIndex ? 'bg-accent-400 text-slate-950' : i === stepIndex ? (paused ? 'bg-amber-500 text-slate-950' : 'bg-action text-white ring-2 ring-brand-500/40') : 'bg-slate-200 text-slate-500'"
        >
          <Icon v-if="i < stepIndex" icon="check" class="h-2.5 w-2.5" />
          <template v-else>{{ i + 1 }}</template>
        </span>
        <span class="whitespace-nowrap text-2xs" :class="i === stepIndex ? 'shrink-0 font-semibold text-slate-900' : 'hidden text-slate-500 group-data-[labels]/steps:inline'">{{ step.label }}</span>
        <span v-if="i < steps.length - 1" class="h-px min-w-2 flex-1" :class="i < stepIndex ? 'bg-accent-400' : 'bg-slate-200'" aria-hidden="true" />
      </li>
    </ol>

    <!-- Avance total -->
    <div v-if="part.state === 'Running' || part.pausedMidway">
      <div class="flex items-baseline justify-between gap-2 text-xs">
        <span class="text-slate-700">{{ detail }}</span>
        <span class="shrink-0 whitespace-nowrap font-figures text-sm font-bold tabular-nums text-slate-900">{{ part.progress }} %</span>
      </div>
      <div
        class="mt-1 h-2 overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        :aria-valuenow="part.progress"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Análisis del vídeo: ${part.progress} %`"
      >
        <div class="h-full rounded-full transition-[width] duration-500" :class="paused ? 'bg-amber-500' : 'bg-brand-500'" :style="{ width: `${part.progress}%` }" />
      </div>

      <!-- Detalle de la etapa -->
      <p v-if="live?.stage === 'teams' && teamSamples !== null" class="mt-1.5 text-2xs text-slate-500">
        {{ live.teamSamples }} de {{ live.teamSamplesTarget }} muestras de camisetas
      </p>
      <div v-else-if="live?.stage === 'tracking' && live.videoSecond != null" class="mt-1.5 text-2xs text-slate-500">
        Minuto <span class="font-figures font-semibold text-slate-700 tabular-nums">{{ clock(live.videoSecond) }}</span> del vídeo
        <template v-if="live.fromSecond != null && live.toSecond != null"> (tramo {{ clock(live.fromSecond) }}–{{ clock(live.toSecond) }}<template v-if="tramo !== null">, {{ number(tramo, 0) }} %</template>)</template>
        <template v-if="live.frames != null && live.framesTotal"> · fotograma {{ live.frames.toLocaleString('es-ES') }} de {{ live.framesTotal.toLocaleString('es-ES') }}</template>
      </div>
    </div>

    <!-- Datos en directo -->
    <dl v-if="tiles.length > 0" class="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      <div v-for="tile in tiles" :key="tile.label" class="rounded-lg border border-line bg-surface-2 px-2.5 py-1.5">
        <dt class="eyebrow text-2xs">{{ tile.label }}</dt>
        <dd class="font-figures text-lg font-extrabold tabular-nums" :class="tile.tone === 'warn' ? 'text-warning' : 'text-slate-900'">{{ tile.value }}</dd>
        <dd v-if="tile.hint" class="text-2xs leading-tight text-slate-500">{{ tile.hint }}</dd>
      </div>
    </dl>

    <!-- Colores de los equipos, en cuanto se separan -->
    <p v-if="live?.colors?.length" class="flex flex-wrap items-center gap-3 text-xs text-slate-600">
      <span>Equipos separados:</span>
      <span v-for="(color, i) in live.colors" :key="color + i" class="inline-flex items-center gap-1.5">
        <span class="h-4 w-4 rounded-full ring-1 ring-line" :style="{ backgroundColor: color }" aria-hidden="true" />Equipo {{ i === 0 ? 'A' : 'B' }}
      </span>
    </p>

    <!-- Tiempos -->
    <p v-if="part.state === 'Running' || part.pausedMidway" class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      <span v-if="elapsed !== null"><Icon icon="clock" class="mr-1 h-3 w-3" />Lleva {{ span(elapsed) }}<template v-if="pausedTotal >= 60"> (sin contar {{ span(pausedTotal) }} en pausa)</template></span>
      <span v-if="live?.remainingSeconds != null && !paused"><Icon icon="hourglass-half" class="mr-1 h-3 w-3" />Queda aprox. {{ span(live.remainingSeconds) }}</span>
      <span v-if="since !== null" :class="quiet ? 'text-warning' : ''">
        <template v-if="quiet"><Icon icon="triangle-exclamation" class="mr-1 h-3 w-3" />Sin noticias del analizador desde hace {{ span(since) }}</template>
        <template v-else>Actualizado hace {{ Math.round(since) }} s</template>
      </span>
    </p>
    <p v-if="part.state === 'Running' && !live" class="text-xs text-slate-500">Arrancando el analizador… en unos segundos empieza a contar lo que hace.</p>

    <!-- Lo que ha ido sabiendo -->
    <div v-if="log.length > 0">
      <button type="button" class="btn-ghost btn-sm px-2 py-0.5" :aria-expanded="showLog" @click="showLog = !showLog">
        <Icon icon="chevron-down" class="h-3 w-3 transition-transform" :class="showLog ? 'rotate-180' : ''" />
        Qué ha ido haciendo ({{ log.length }})
      </button>
      <p v-if="!showLog" class="mt-0.5 break-words px-2 text-xs text-slate-500">{{ log[0].text }}</p>
      <ol v-if="showLog" class="mt-1 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-line bg-surface-2 px-3 py-2 text-xs">
        <li v-for="(entry, i) in log" :key="entry.at + i" class="flex gap-2">
          <time :datetime="entry.at" class="shrink-0 font-figures tabular-nums text-slate-400">{{ time(entry.at) }}</time>
          <span class="text-slate-700">{{ entry.text }}</span>
        </li>
      </ol>
    </div>
  </div>
</template>
