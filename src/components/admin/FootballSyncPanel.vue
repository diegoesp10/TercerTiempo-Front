<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import type { FootballSyncSettingsDto, SyncScopeKind } from '@/types/api';
import { formatDate, formatKickoff } from '@/utils/format';

/**
 * Qué descargan los datos de las ligas: lanzar a mano la jornada en curso, unas fechas o la temporada entera (todas las
 * ligas o algunas) y fijar la pasada automática. La temporada entera abre una a una las páginas de los partidos que la
 * API oculta y descarga el catálogo de jugadores: es lo que tarda.
 */
const props = defineProps<{ token: string; running: boolean; enabled: boolean }>();
const emit = defineEmits<{ launched: [message: string]; unauthorized: [] }>();

const settings = ref<FootballSyncSettingsDto | null>(null);
const error = ref<string | null>(null);
const launching = ref(false);
const saving = ref(false);
const saved = ref(false);

const scope = ref<SyncScopeKind>('CurrentRound');
const from = ref('');
const to = ref('');
const leagues = ref<string[]>([]);
const rosters = ref(false);

const schedule = reactive({ scheduledScope: 'CurrentRound' as SyncScopeKind, daysBack: 3, daysAhead: 4, rostersInRound: false, fullSyncEveryDays: 7 });

const scopes: { value: SyncScopeKind; label: string }[] = [
  { value: 'CurrentRound', label: 'Jornada en curso' },
  { value: 'DateRange', label: 'Fechas' },
  { value: 'FullSeason', label: 'Temporada completa' },
];

const roundLabel = computed(() => (settings.value ? `${formatDate(settings.value.roundFrom)} – ${formatDate(settings.value.roundTo)}` : ''));
const allLeagues = computed(() => leagues.value.length === 0);

const scheduleDirty = computed(() => {
  const s = settings.value;
  return !!s && (s.scheduledScope !== schedule.scheduledScope || s.daysBack !== schedule.daysBack || s.daysAhead !== schedule.daysAhead
    || s.rostersInRound !== schedule.rostersInRound || s.fullSyncEveryDays !== schedule.fullSyncEveryDays);
});

/** Plantillas por defecto: sí en la temporada; en la jornada, lo de la programación; en fechas, no. */
watch(scope, (value) => {
  rosters.value = value === 'FullSeason' ? true : value === 'CurrentRound' ? settings.value?.rostersInRound ?? false : false;
});

function fill(dto: FootballSyncSettingsDto) {
  settings.value = dto;
  Object.assign(schedule, {
    scheduledScope: dto.scheduledScope,
    daysBack: dto.daysBack,
    daysAhead: dto.daysAhead,
    rostersInRound: dto.rostersInRound,
    fullSyncEveryDays: dto.fullSyncEveryDays,
  });
  if (!from.value) from.value = dto.roundFrom;
  if (!to.value) to.value = dto.roundTo;
  if (scope.value === 'CurrentRound') rosters.value = dto.rostersInRound;
}

async function guard<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    error.value = null;
    return await action();
  } catch (e) {
    if ((e as { status?: number }).status === 401) emit('unauthorized');
    else error.value = errorMessage(e);
    return undefined;
  }
}

function toggleLeague(id: string) {
  leagues.value = leagues.value.includes(id) ? leagues.value.filter((l) => l !== id) : [...leagues.value, id];
}

async function launch() {
  launching.value = true;
  const what = scope.value === 'CurrentRound' ? `la jornada en curso (${roundLabel.value})`
    : scope.value === 'DateRange' ? `del ${formatDate(from.value)} al ${formatDate(to.value)}` : 'la temporada completa';
  const done = await guard(() => adminApi.runFootballSync(props.token, {
    scope: scope.value,
    from: scope.value === 'DateRange' ? from.value : null,
    to: scope.value === 'DateRange' ? to.value : null,
    competitionIds: leagues.value,
    includeRosters: rosters.value,
  }));
  if (done) {
    const which = allLeagues.value ? 'todas las ligas' : leagues.value.length === 1 ? '1 liga' : `${leagues.value.length} ligas`;
    emit('launched', `Datos de las ligas lanzados: ${what}, ${which}. La página se actualiza sola mientras dura.`);
  }
  launching.value = false;
}

async function load() {
  const result = await guard(() => adminApi.footballSync(props.token));
  if (result) fill(result);
}

async function saveSchedule() {
  saving.value = true;
  saved.value = false;
  const result = await guard(() => adminApi.updateFootballSync(props.token, { ...schedule }));
  if (result) {
    fill(result);
    saved.value = true;
  }
  saving.value = false;
}

onMounted(load);
</script>

<template>
  <div v-if="settings" class="mt-4 space-y-4 border-t border-slate-200 pt-4">
    <div>
      <span class="label">Qué descargar</span>
      <div class="flex flex-wrap gap-2" role="radiogroup">
        <button
          v-for="item in scopes"
          :key="item.value"
          type="button"
          role="radio"
          :aria-checked="scope === item.value"
          class="rounded-lg border px-3 py-1.5 text-left text-sm"
          :class="scope === item.value ? 'border-brand-400 bg-brand-500/15 text-slate-900' : 'border-line text-slate-600 hover:border-brand-400/60'"
          @click="scope = item.value"
        >
          {{ item.label }}
          <span v-if="item.value === 'CurrentRound'" class="block text-xs text-slate-500">{{ roundLabel }}</span>
          <span v-else-if="item.value === 'FullSeason'" class="block text-xs text-slate-500">Lento: calendario entero</span>
          <span v-else class="block text-xs text-slate-500">Las que elijas</span>
        </button>
      </div>
    </div>

    <div v-if="scope === 'DateRange'" class="flex flex-wrap gap-3">
      <label class="w-44">
        <span class="label">Desde</span>
        <input v-model="from" type="date" required class="input" />
      </label>
      <label class="w-44">
        <span class="label">Hasta</span>
        <input v-model="to" type="date" required :min="from" class="input" />
      </label>
    </div>

    <div>
      <span class="label">Ligas</span>
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs"
          :class="allLeagues ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
          @click="leagues = []"
        >Todas</button>
        <button
          v-for="league in settings.competitions"
          :key="league.id"
          type="button"
          class="rounded-full border px-3 py-1 text-xs"
          :class="leagues.includes(league.id) ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600 hover:border-brand-400/60'"
          :aria-pressed="leagues.includes(league.id)"
          @click="toggleLeague(league.id)"
        >{{ league.name }}</button>
      </div>
    </div>

    <label class="flex items-center gap-2 text-sm text-slate-700">
      <input v-model="rosters" type="checkbox" class="h-4 w-4 accent-brand-500" />
      Plantillas (descarga el catálogo entero de jugadores: unas 20 llamadas más)
    </label>

    <p class="text-xs text-slate-500">
      Con la jornada o unas fechas solo se traen los partidos de esos días con sus resultados, las clasificaciones y los
      equipos nuevos. Los partidos que la web oculta solo se releen si ya estaban guardados; los nuevos los descubre la
      temporada completa.
    </p>

    <Alert v-if="error" kind="error">{{ error }}</Alert>

    <button
      type="button"
      class="btn-primary"
      v-busy="launching"
      :disabled="!enabled || running || launching || (scope === 'DateRange' && (!from || !to || to < from))"
      @click="launch"
    >
      <Icon icon="play" class="h-3.5 w-3.5" /> {{ running ? 'En marcha…' : 'Lanzar' }}
    </button>

    <details class="rounded-lg border border-slate-200 p-3 text-sm">
      <summary class="cursor-pointer font-medium text-slate-800">Programación automática</summary>
      <form class="mt-3 space-y-3" @submit.prevent="saveSchedule">
        <div class="flex flex-wrap gap-3">
          <label class="w-56">
            <span class="label">Cada pasada descarga</span>
            <select v-model="schedule.scheduledScope" class="input">
              <option value="CurrentRound">La jornada en curso</option>
              <option value="FullSeason">La temporada completa</option>
            </select>
          </label>
          <label class="w-36">
            <span class="label">Días antes de hoy</span>
            <input v-model.number="schedule.daysBack" type="number" min="0" max="14" required class="input" />
          </label>
          <label class="w-36">
            <span class="label">Días después</span>
            <input v-model.number="schedule.daysAhead" type="number" min="0" max="14" required class="input" />
          </label>
          <label class="w-52">
            <span class="label">Temporada completa cada (días)</span>
            <input v-model.number="schedule.fullSyncEveryDays" type="number" min="0" max="60" required class="input" />
          </label>
        </div>
        <label class="flex items-center gap-2 text-slate-700">
          <input v-model="schedule.rostersInRound" type="checkbox" class="h-4 w-4 accent-brand-500" />
          Plantillas también en la jornada en curso
        </label>
        <p class="text-xs text-slate-500">
          La jornada en curso va de hoy menos los días de antes a hoy más los de después (con 3 y 4 cubre de miércoles a
          miércoles: el finde que viene o el que acaba de jugarse). Cada tantos días la pasada automática es la temporada
          completa con plantillas, para descubrir partidos ocultos nuevos y fichajes; 0 = solo a mano.
          <template v-if="settings.lastFullSyncAt"> Última completa: {{ formatKickoff(settings.lastFullSyncAt) }}.</template>
          <template v-if="settings.nextFullSyncAt"> Próxima: a partir del {{ formatKickoff(settings.nextFullSyncAt) }}.</template>
          El intervalo entre pasadas es de la configuración de cada entorno.
        </p>
        <Alert v-if="saved && !scheduleDirty" kind="success">Programación guardada: vale desde la próxima pasada.</Alert>
        <div class="flex gap-2">
          <button type="submit" class="btn-secondary" v-busy="saving" :disabled="saving || !scheduleDirty">Guardar programación</button>
          <button type="button" class="btn-ghost" :disabled="saving || !scheduleDirty" @click="fill(settings!)">Descartar</button>
        </div>
      </form>
    </details>
  </div>
  <Alert v-else-if="error" kind="error" class="mt-4">{{ error }}</Alert>
</template>
