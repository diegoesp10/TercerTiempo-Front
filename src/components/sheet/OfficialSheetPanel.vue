<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { OfficialLineDto, OfficialSheetDto, OfficialTeamSheetDto } from '@/types/api';
import { formatKickoff, officialEventLabels } from '@/utils/format';

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

async function load(refresh = false) {
  loading.value = true;
  error.value = null;
  try {
    const result = await api.matches.officialSheet(props.matchId, refresh);
    own.value = result;
    emit('refreshed', result);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

// Mientras la federación no publique el acta (partido en juego o recién terminado) se vuelve a preguntar cada minuto.
let timer: ReturnType<typeof setInterval> | null = null;
function schedule() {
  if (timer) clearInterval(timer);
  timer = null;
  if (sheet.value?.status === 'Pending') timer = setInterval(() => void load(), 60_000);
}
watch(sheet, schedule, { immediate: true });
onBeforeUnmount(() => { if (timer) clearInterval(timer); });

watch(() => props.matchId, () => { if (props.sheet === undefined) void load(); }, { immediate: true });

const teams = computed(() => (sheet.value ? [sheet.value.home, sheet.value.away].filter((t): t is OfficialTeamSheetDto => t !== null) : []));

/** "90'", "48' (sale 48')" para un titular sustituido o expulsado, "32' (entra 58')" para un suplente. */
const minutes = (line: OfficialLineDto) => {
  if (!line.played) return '—';
  const detail = line.started
    ? line.minuteOut !== null ? ` (sale ${line.minuteOut}')` : ''
    : ` (entra ${line.minuteIn}'${line.minuteOut !== null ? `, sale ${line.minuteOut}'` : ''})`;
  return `${line.minutesPlayed}'${detail}`;
};

const eventIcon: Record<string, string> = {
  Goal: '⚽',
  PenaltyGoal: '⚽ (p)',
  OwnGoal: '⚽ (pp)',
  YellowCard: '🟨',
  SecondYellow: '🟨🟨',
  RedCard: '🟥',
  Substitution: '🔁',
};
</script>

<template>
  <section class="card">
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900">Acta oficial de la federación</h2>
        <p class="text-xs text-slate-500">
          <template v-if="sheet?.status === 'Available'">
            Publicada por asturfutbol.es<template v-if="sheet.referee"> · árbitro: {{ sheet.referee }}</template><template v-if="sheet.fetchedAt"> · leída el {{ formatKickoff(sheet.fetchedAt) }}</template>
          </template>
          <template v-else>Alineaciones, minutos, goles y tarjetas según el acta del árbitro.</template>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <a v-if="sheet?.sourceUrl" :href="sheet.sourceUrl" target="_blank" rel="noopener" class="text-sm text-accent-400 hover:underline">Ver en asturfutbol.es</a>
        <button type="button" class="btn-ghost px-3 py-1 text-xs" :disabled="loading" @click="load(true)">{{ loading ? 'Consultando…' : 'Actualizar' }}</button>
      </div>
    </div>

    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>

    <Spinner v-if="loading && !sheet" />

    <template v-else-if="sheet">
      <Alert v-if="sheet.status === 'NotPlayed'" kind="info">Todavía no se ha jugado: el acta oficial aparecerá cuando la federación la publique tras el partido.</Alert>

      <div v-else-if="sheet.status === 'Pending'" class="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden="true"></span>
        <span>{{ sheet.message ?? 'La federación todavía no ha publicado el acta.' }} Se vuelve a comprobar automáticamente.</span>
      </div>

      <Alert v-else-if="sheet.status === 'Unavailable'" kind="warning">{{ sheet.message ?? 'No se ha encontrado este partido en la federación.' }}</Alert>

      <template v-else>
        <div class="grid gap-6 lg:grid-cols-2">
          <div v-for="team in teams" :key="team.side" class="rounded-xl border p-4" :class="highlightTeamId && team.teamId === highlightTeamId ? 'border-accent-400/40 bg-brand-500/10/40' : 'border-slate-200'">
            <div class="mb-2 flex items-center justify-between">
              <h3 class="font-semibold text-slate-900">{{ team.teamName }}</h3>
              <span v-if="team.goals !== null" class="text-xl font-bold tabular-nums text-slate-900">{{ team.goals }}</span>
            </div>
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
                    <span class="font-medium" :class="line.played ? 'text-slate-800' : ''">{{ line.fullName }}</span>
                    <Badge v-if="line.started" class="ml-1">titular</Badge>
                  </td>
                  <td class="py-1 pr-2 text-center tabular-nums whitespace-nowrap">{{ minutes(line) }}</td>
                  <td class="py-1 pr-2 text-center font-semibold tabular-nums">
                    {{ line.goals + line.penaltyGoals || '' }}<span v-if="line.ownGoals" class="text-red-600" title="En propia puerta"> ({{ line.ownGoals }} pp)</span>
                  </td>
                  <td class="py-1 text-center tabular-nums">{{ line.yellowCards || '' }}<span v-if="line.redCard">🟥</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <details v-if="sheet.events.length > 0" class="mt-4 text-sm">
          <summary class="cursor-pointer font-medium text-slate-700">Sucesos del partido ({{ sheet.events.length }})</summary>
          <ul class="mt-2 grid gap-1 sm:grid-cols-2">
            <li v-for="(event, index) in sheet.events" :key="index" class="flex items-center gap-2 text-slate-700">
              <span class="w-12 shrink-0 text-right tabular-nums text-slate-500">{{ event.minute }}'<template v-if="event.extraMinute">+{{ event.extraMinute }}</template></span>
              <span class="w-14 shrink-0" :title="officialEventLabels[event.type]">{{ eventIcon[event.type] }}</span>
              <span>
                {{ event.playerName }}<template v-if="event.relatedPlayerName"> <span class="text-slate-400">por</span> {{ event.relatedPlayerName }}</template>
                <span class="text-xs text-slate-400"> · {{ event.side === 'Home' ? sheet.home?.teamName : sheet.away?.teamName }}</span>
              </span>
            </li>
          </ul>
        </details>
      </template>
    </template>
  </section>
</template>
