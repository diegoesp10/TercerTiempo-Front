<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import ShirtNumberUsage from '@/components/players/ShirtNumberUsage.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import GoalMarks from '@/components/sheet/GoalMarks.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import ResponsiveTabs from '@/components/ui/ResponsiveTabs.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useSort } from '@/composables/useSort';
import type { MatchDto, Position, RosterEntryDetailDto, RosterEntryDto, RosterInternalAppearanceDto, RosterOfficialAppearanceDto } from '@/types/api';
import { formatDate, outcomeFor, outcomeLabels, outcomeTone, positionLabels, positionOptions, scoreLabel } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';
import { opponentOf } from '@/utils/crests';

// Ficha completa de un jugador de la plantilla para la cuenta de club: foto, datos editables y sus actas.
const props = defineProps<{ teamId: string; entry: RosterEntryDto | null }>();
const emit = defineEmits<{ close: []; updated: [roster: RosterEntryDto[]] }>();

const detail = shallowRef<RosterEntryDetailDto | null>(null);
const loading = ref(false);
const loadError = ref<string | null>(null);

async function load() {
  if (!props.entry) return;
  loading.value = true;
  loadError.value = null;
  try {
    detail.value = await api.clubs.rosterEntry(props.teamId, props.entry.id);
  } catch (e) {
    loadError.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

const form = reactive<{ fullName: string; position: Position | '' }>({ fullName: '', position: '' });
const busy = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});
const saved = ref<string | null>(null);

watch(
  () => props.entry,
  (entry) => {
    detail.value = null;
    error.value = null;
    saved.value = null;
    fieldErrors.value = {};
    if (!entry) return;
    form.fullName = entry.fullName;
    form.position = entry.position ?? '';
    void load();
  },
  { immediate: true },
);

const current = computed(() => detail.value?.entry ?? props.entry);
const dirty = computed(() => {
  const entry = props.entry;
  if (!entry) return false;
  return form.fullName.trim() !== entry.fullName || (form.position || null) !== entry.position;
});

async function act(fn: () => Promise<RosterEntryDto[]>, message: string) {
  busy.value = true;
  error.value = null;
  saved.value = null;
  fieldErrors.value = {};
  try {
    emit('updated', await fn());
    saved.value = message;
    return true;
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
    return false;
  } finally {
    busy.value = false;
  }
}

function save() {
  if (!props.entry) return;
  const entryId = props.entry.id;
  void act(
    () => api.clubs.updateRosterEntry(props.teamId, entryId, { fullName: form.fullName.trim(), position: form.position || null }),
    'Ficha guardada.',
  );
}

const photoInput = ref<HTMLInputElement | null>(null);

function uploadPhoto(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || !props.entry) return;
  const entryId = props.entry.id;
  void act(() => api.clubs.uploadRosterPhoto(props.teamId, entryId, file), 'Foto actualizada.');
}

const tab = ref<'official' | 'internal'>('official');

const matchInfo = (match: MatchDto) => {
  const outcome = outcomeFor(match, props.teamId);
  return { outcome, score: scoreLabel(match), label: outcomeLabels[outcome ?? 'draw'], tone: outcomeTone(outcome) };
};

const minutes = (line: { played: boolean; started: boolean; minuteIn: number | null; minuteOut: number | null; minutesPlayed: number }) => {
  if (!line.played) return 'No jugó';
  const detailText = line.started
    ? line.minuteOut !== null ? ` (sale ${line.minuteOut}')` : ''
    : ` (entra ${line.minuteIn}'${line.minuteOut !== null ? `, sale ${line.minuteOut}'` : ''})`;
  return `${line.minutesPlayed}'${detailText}`;
};

/** Para ordenar por resultado: primero las victorias (y entre ellas, las de más diferencia). */
const resultScore = (match: MatchDto, home: boolean) => {
  const { homeGoals, awayGoals } = match;
  if (homeGoals === null || awayGoals === null) return null;
  const diff = home ? homeGoals - awayGoals : awayGoals - homeGoals;
  return (diff > 0 ? 3 : diff === 0 ? 1 : 0) * 100 + diff;
};
// La roja pesa más que cualquier número de amarillas.
const cardsScore = (yellow: number, red: boolean) => (red ? 10 : 0) + yellow;

type OfficialKey = 'matchday' | 'opponent' | 'result' | 'shirt' | 'minutes' | 'goals' | 'cards';
const officialRows = computed(() => detail.value?.official ?? []);
const officialGetters: Record<OfficialKey, (row: RosterOfficialAppearanceDto) => number | string | null> = {
  matchday: (r) => r.match.matchday,
  opponent: (r) => opponentOf(r.match, props.teamId).name,
  result: (r) => resultScore(r.match, r.home),
  shirt: (r) => r.line.shirtNumber,
  minutes: (r) => r.line.minutesPlayed,
  goals: (r) => r.line.goals + r.line.penaltyGoals,
  cards: (r) => cardsScore(r.line.yellowCards, r.line.redCard),
};
const { sorted: officialSorted, sortBy: sortOfficial, state: officialState } = useSort<RosterOfficialAppearanceDto, OfficialKey>(
  officialRows,
  officialGetters,
  'matchday',
  { ascendingFirst: ['opponent', 'shirt'] },
);

type InternalKey = 'matchday' | 'opponent' | 'minutes' | 'goals' | 'assists' | 'shots' | 'tackles' | 'interceptions' | 'saves' | 'cards' | 'rating';
const internalRows = computed(() => detail.value?.internal ?? []);
const internalGetters: Record<InternalKey, (row: RosterInternalAppearanceDto) => number | string | null> = {
  matchday: (r) => r.match.matchday,
  opponent: (r) => opponentOf(r.match, props.teamId).name,
  minutes: (r) => r.performance.minutesPlayed,
  goals: (r) => r.performance.goals,
  assists: (r) => r.performance.assists,
  // Primero los tiros a puerta y, a igualdad, los totales.
  shots: (r) => r.performance.shotsOnTarget * 1000 + r.performance.shots,
  tackles: (r) => r.performance.tackles,
  interceptions: (r) => r.performance.interceptions,
  saves: (r) => r.performance.saves,
  cards: (r) => cardsScore(r.performance.yellowCards, r.performance.redCard),
  rating: (r) => r.performance.rating,
};
const { sorted: internalSorted, sortBy: sortInternal, state: internalState } = useSort<RosterInternalAppearanceDto, InternalKey>(
  internalRows,
  internalGetters,
  'matchday',
  { ascendingFirst: ['opponent'] },
);
</script>

<template>
  <Modal :open="entry !== null" :title="entry?.fullName ?? 'Jugador'" size="xl" @close="emit('close')">
    <template #header>
      <div v-if="current" class="flex items-center gap-4">
        <button type="button" class="group relative rounded-full" v-busy="busy" :disabled="busy" title="Cambiar la foto" @click="photoInput?.click()">
          <PlayerAvatar :src="current.photoUrl" :name="current.fullName" size="xl" />
          <span class="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/0 text-white opacity-0 transition group-hover:bg-slate-950/50 group-hover:opacity-100">
            <Icon icon="camera" class="h-6 w-6" />
          </span>
        </button>
        <input ref="photoInput" type="file" accept="image/png,image/jpeg,image/webp" class="hidden" @change="uploadPhoto" />
        <div>
          <p class="eyebrow">Ficha del jugador</p>
          <h2 class="text-xl font-bold text-slate-900">{{ current.fullName }}</h2>
          <p class="mt-1 text-sm text-slate-500">
            {{ current.position ? positionLabels[current.position] : 'Sin posición' }}
            <Badge v-if="current.managedByClub" tone="blue" class="ml-2">Club</Badge>
          </p>
          <button type="button" class="btn-ghost btn-sm mt-1 px-2" v-busy="busy" :disabled="busy" @click="photoInput?.click()">
            <Icon icon="camera" class="mr-1.5 h-3.5 w-3.5" />{{ current.photoUrl ? 'Cambiar foto' : 'Subir foto' }}
          </button>
        </div>
      </div>
    </template>

    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>
    <Alert v-else-if="saved" kind="success" class="mb-3">{{ saved }}</Alert>

    <!-- Datos de la ficha -->
    <form class="grid grid-cols-1 gap-3 rounded-lg border border-line bg-surface-2 p-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-start" @submit.prevent="save">
      <div>
        <label class="label" for="player-name">Nombre y apellidos</label>
        <input id="player-name" v-model="form.fullName" type="text" required maxlength="150" class="input" />
        <p v-if="fieldErrors.fullName" class="field-error">{{ fieldErrors.fullName[0] }}</p>
      </div>
      <div>
        <label class="label" for="player-position">Posición</label>
        <SearchSelect id="player-position" placeholder="Elige su posición" :model-value="form.position || null" :options="positionOptions" @update:model-value="form.position = ($event as Position | null) ?? ''" />
      </div>
      <div>
        <span class="label invisible hidden sm:block" aria-hidden="true">Guardar</span>
        <button type="submit" class="btn-primary w-full sm:w-auto" v-busy="busy" :disabled="busy || !dirty || !form.fullName.trim() || !form.position"><Icon icon="check" class="mr-1.5 h-3.5 w-3.5" />Guardar</button>
      </div>
    </form>

    <Spinner v-if="loading && !detail" class="my-6" />
    <Alert v-else-if="loadError" kind="error" class="mt-4">{{ loadError }}</Alert>

    <template v-else-if="detail">
      <!-- Totales de temporada según las actas públicas -->
      <div class="mt-5 flex items-baseline justify-between">
        <h3 class="font-semibold text-slate-900">Temporada según las actas públicas</h3>
        <span class="text-xs text-slate-500">federación</span>
      </div>
      <p v-if="!detail.entry.stats" class="mt-2 text-sm text-slate-500">Todavía no aparece en ningún acta pública.</p>
      <dl v-else class="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Partidos</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.entry.stats.appearances }}</dd></div>
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Titular</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.entry.stats.started }}</dd></div>
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Minutos</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.entry.stats.minutesPlayed }}</dd></div>
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Goles</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.entry.stats.goals }}</dd></div>
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Amarillas</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.entry.stats.yellowCards }}</dd></div>
        <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Rojas</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.entry.stats.redCards }}</dd></div>
      </dl>

      <!-- Dorsales: la ficha no lleva uno fijo, el de cada partido sale de su acta -->
      <div class="mt-5 flex items-baseline justify-between">
        <h3 class="font-semibold text-slate-900">Dorsales</h3>
        <span class="text-xs text-slate-500">según las actas públicas</span>
      </div>
      <p v-if="detail.entry.shirtNumbers.length === 0" class="mt-2 text-sm text-slate-500">Todavía no aparece con dorsal en ningún acta pública.</p>
      <ShirtNumberUsage v-else :usage="detail.entry.shirtNumbers" class="mt-2 max-w-md" />

      <!-- Partido a partido -->
      <ResponsiveTabs
        :items="[
          { key: 'official', label: 'Actas oficiales', count: detail.official.length },
          { key: 'internal', label: 'Actas de Tercer Tiempo', count: detail.internal.length },
        ]"
        :model-value="tab"
        label="Partido a partido"
        tone="accent"
        class="mt-5"
        @update:model-value="(key) => (tab = key as 'official' | 'internal')"
      />

      <div v-if="tab === 'official'" class="mt-3 overflow-x-auto">
        <p v-if="detail.official.length === 0" class="text-sm text-slate-500">Sin partidos en las actas oficiales.</p>
        <table v-else class="min-w-full text-sm">
          <thead class="text-xs text-slate-500">
            <tr>
              <SortHeader class="py-1 pr-3 text-left" label="J" title="Jornada" v-bind="officialState('matchday')" @sort="sortOfficial('matchday')" />
              <SortHeader class="py-1 pr-3 text-left" label="Partido" title="Rival" v-bind="officialState('opponent')" @sort="sortOfficial('opponent')" />
              <SortHeader class="col-sm py-1 pr-3 text-center" label="Resultado" v-bind="officialState('result')" @sort="sortOfficial('result')" />
              <SortHeader class="py-1 pr-3 text-center" label="Dorsal" title="Dorsal que llevó en ese partido" v-bind="officialState('shirt')" @sort="sortOfficial('shirt')" />
              <SortHeader class="py-1 pr-3 text-center" label="Min" title="Minutos" v-bind="officialState('minutes')" @sort="sortOfficial('minutes')" />
              <SortHeader class="py-1 pr-3 text-center" label="G" title="Goles" v-bind="officialState('goals')" @sort="sortOfficial('goals')" />
              <SortHeader class="py-1 text-center" label="TA/TR" title="Tarjetas (la roja pesa más)" v-bind="officialState('cards')" @sort="sortOfficial('cards')" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="row in officialSorted" :key="row.match.id" :class="row.line.played ? '' : 'text-slate-400'">
              <td class="py-1.5 pr-3 tabular-nums text-slate-500">{{ row.match.matchday }}</td>
              <td class="py-1.5 pr-3">
                <RouterLink :to="{ name: 'match', params: { matchId: row.match.id } }" class="font-medium text-slate-800 hover:underline"><TeamName prefix="vs" :name="opponentOf(row.match, teamId).name" :crest-url="opponentOf(row.match, teamId).crestUrl" /></RouterLink>
                <span class="ml-1 text-xs text-slate-400">{{ row.home ? 'en casa' : 'fuera' }} · {{ formatDate(row.match.kickoffAt) }}</span>
              </td>
              <td class="col-sm py-1.5 pr-3 text-center tabular-nums whitespace-nowrap">
                {{ matchInfo(row.match).score ?? '—' }}
                <Badge v-if="matchInfo(row.match).outcome" :tone="matchInfo(row.match).tone" class="ml-1">{{ matchInfo(row.match).label }}</Badge>
              </td>
              <td class="py-1.5 pr-3 text-center tabular-nums">{{ row.line.shirtNumber ?? '—' }}</td>
              <td class="py-1.5 pr-3 text-center tabular-nums whitespace-nowrap">{{ minutes(row.line) }}</td>
              <td class="py-1.5 pr-3 text-center whitespace-nowrap"><GoalMarks :goals="row.line.goals" :penalty-goals="row.line.penaltyGoals" :own-goals="row.line.ownGoals" /></td>
              <td class="py-1.5 text-center whitespace-nowrap"><CardMarks :yellow-cards="row.line.yellowCards" :red-card="row.line.redCard" /></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-else class="mt-3">
        <p v-if="!detail.hasSquad" class="text-sm text-slate-500">
          El cuerpo técnico todavía no lleva este jugador en una plantilla de Tercer Tiempo, así que no hay actas internas.
        </p>
        <p v-else-if="detail.internal.length === 0" class="text-sm text-slate-500">El cuerpo técnico aún no ha registrado ningún acta con este jugador.</p>
        <template v-else>
          <dl v-if="detail.internalStats" class="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Partidos</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.internalStats.appearances }}</dd></div>
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Minutos</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.internalStats.minutesPlayed }}</dd></div>
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Goles</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.internalStats.goals }}</dd></div>
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Asist.</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.internalStats.assists }}</dd></div>
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Tiros</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.internalStats.shotsOnTarget }}/{{ detail.internalStats.shots }}</dd></div>
            <div class="rounded-lg border border-line bg-surface-2 px-3 py-2 text-center"><dt class="text-2xs uppercase tracking-wide text-slate-500">Nota media</dt><dd class="font-display text-xl font-bold text-slate-900">{{ detail.internalStats.averageRating?.toFixed(1) ?? '—' }}</dd></div>
          </dl>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="text-xs text-slate-500">
                <tr>
                  <SortHeader class="py-1 pr-3 text-left" label="J" title="Jornada" v-bind="internalState('matchday')" @sort="sortInternal('matchday')" />
                  <SortHeader class="py-1 pr-3 text-left" label="Partido" title="Rival" v-bind="internalState('opponent')" @sort="sortInternal('opponent')" />
                  <SortHeader class="py-1 pr-2 text-center" label="Min" title="Minutos" v-bind="internalState('minutes')" @sort="sortInternal('minutes')" />
                  <SortHeader class="py-1 pr-2 text-center" label="G" title="Goles" v-bind="internalState('goals')" @sort="sortInternal('goals')" />
                  <SortHeader class="col-sm py-1 pr-2 text-center" label="A" title="Asistencias de gol" v-bind="internalState('assists')" @sort="sortInternal('assists')" />
                  <SortHeader class="col-sm py-1 pr-2 text-center" label="Tiros" title="Tiros a puerta / tiros" v-bind="internalState('shots')" @sort="sortInternal('shots')" />
                  <SortHeader class="col-md py-1 pr-2 text-center" label="Ent" title="Entradas" v-bind="internalState('tackles')" @sort="sortInternal('tackles')" />
                  <SortHeader class="col-md py-1 pr-2 text-center" label="Int" title="Intercepciones" v-bind="internalState('interceptions')" @sort="sortInternal('interceptions')" />
                  <SortHeader class="col-md py-1 pr-2 text-center" label="Par" title="Paradas" v-bind="internalState('saves')" @sort="sortInternal('saves')" />
                  <SortHeader class="py-1 pr-2 text-center" label="TA/TR" title="Tarjetas (la roja pesa más)" v-bind="internalState('cards')" @sort="sortInternal('cards')" />
                  <SortHeader class="py-1 text-center" label="Nota" v-bind="internalState('rating')" @sort="sortInternal('rating')" />
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                <tr v-for="row in internalSorted" :key="row.performance.id" :class="row.performance.minutesPlayed > 0 ? '' : 'text-slate-400'">
                  <td class="py-1.5 pr-3 tabular-nums text-slate-500">{{ row.match.matchday }}</td>
                  <td class="py-1.5 pr-3 whitespace-nowrap">
                    <RouterLink :to="{ name: 'match', params: { matchId: row.match.id } }" class="font-medium text-slate-800 hover:underline"><TeamName prefix="vs" :name="opponentOf(row.match, teamId).name" :crest-url="opponentOf(row.match, teamId).crestUrl" /></RouterLink>
                    <span class="ml-1 text-xs text-slate-400">{{ row.home ? 'en casa' : 'fuera' }}<template v-if="row.performance.started"> · titular</template></span>
                  </td>
                  <td class="py-1.5 pr-2 text-center tabular-nums">{{ row.performance.minutesPlayed }}'</td>
                  <td class="py-1.5 pr-2 text-center whitespace-nowrap"><GoalMarks :goals="row.performance.goals" /></td>
                  <td class="col-sm py-1.5 pr-2 text-center tabular-nums">{{ row.performance.assists }}</td>
                  <td class="col-sm py-1.5 pr-2 text-center tabular-nums">{{ row.performance.shotsOnTarget }}/{{ row.performance.shots }}</td>
                  <td class="col-md py-1.5 pr-2 text-center tabular-nums">{{ row.performance.tackles }}</td>
                  <td class="col-md py-1.5 pr-2 text-center tabular-nums">{{ row.performance.interceptions }}</td>
                  <td class="col-md py-1.5 pr-2 text-center tabular-nums">{{ row.performance.saves }}</td>
                  <td class="py-1.5 pr-2 text-center whitespace-nowrap"><CardMarks :yellow-cards="row.performance.yellowCards" :red-card="row.performance.redCard" /></td>
                  <td class="py-1.5 text-center"><RatingBadge :rating="row.performance.rating" size="sm" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </template>
  </Modal>
</template>
