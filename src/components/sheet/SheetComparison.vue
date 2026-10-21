<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import OfficialSheetPanel from '@/components/sheet/OfficialSheetPanel.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import type { SheetComparisonDto, SheetComparisonRowDto } from '@/types/api';
import { positionShortLabels, sheetFieldLabels } from '@/utils/format';

const props = defineProps<{ squadId: string; matchId: string }>();

const data = shallowRef<SheetComparisonDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load(refresh = false) {
  loading.value = true;
  error.value = null;
  try {
    data.value = await api.squads.compareSheet(props.squadId, props.matchId, refresh);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch(() => [props.squadId, props.matchId], () => void load(), { immediate: true });

// Sin acta oficial todavía: se reintenta cada minuto, igual que el panel.
let timer: ReturnType<typeof setInterval> | null = null;
watch(data, (value) => {
  if (timer) clearInterval(timer);
  timer = value?.official.status === 'Pending' ? setInterval(() => void load(), 60_000) : null;
});
onBeforeUnmount(() => { if (timer) clearInterval(timer); });

const available = computed(() => data.value?.official.status === 'Available');
const filter = ref<'all' | 'differences'>('all');

const rows = computed<SheetComparisonRowDto[]>(() => {
  const all = data.value?.rows ?? [];
  const relevant = all.filter((r) => r.coach || r.official);
  return filter.value === 'differences' ? relevant.filter((r) => r.differences.length > 0) : relevant;
});

const hasDifference = (row: SheetComparisonRowDto, field: string) => row.differences.some((d) => d.field === field);
const cell = (row: SheetComparisonRowDto, field: string) => (hasDifference(row, field) ? 'bg-red-50 text-red-700 font-semibold' : '');
const yes = (value: boolean) => (value ? 'sí' : 'no');
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <section class="card mb-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-slate-900">Acta interna frente al acta oficial</h2>
          <p class="text-xs text-slate-500">
            <template v-if="available">
              {{ data.summary.coachLines }} líneas del cuerpo técnico · {{ data.summary.officialLines }} convocados en el acta oficial ·
              {{ data.summary.matched }} emparejados ·
              <strong :class="data.summary.differences > 0 ? 'text-red-700' : 'text-emerald-700'">
                {{ data.summary.differences === 0 ? 'sin discrepancias' : `${data.summary.differences} ${data.summary.differences === 1 ? 'discrepancia' : 'discrepancias'}` }}
              </strong>
            </template>
            <template v-else>Cuando la federación publique el acta se compara con la tuya jugador a jugador.</template>
          </p>
        </div>
        <div class="flex items-center gap-2">
          <div v-if="available" class="inline-flex rounded-lg border border-slate-200 p-0.5" role="radiogroup" aria-label="Filtro">
            <button type="button" role="radio" :aria-checked="filter === 'all'" class="rounded-md px-3 py-1 text-xs font-medium" :class="filter === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'" @click="filter = 'all'">Todos</button>
            <button type="button" role="radio" :aria-checked="filter === 'differences'" class="rounded-md px-3 py-1 text-xs font-medium" :class="filter === 'differences' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'" @click="filter = 'differences'">Solo discrepancias</button>
          </div>
          <button type="button" class="btn-ghost px-3 py-1 text-xs" :disabled="loading" @click="load(true)">{{ loading ? 'Consultando…' : 'Actualizar' }}</button>
        </div>
      </div>

      <template v-if="available">
        <p v-if="rows.length === 0" class="mt-4 text-sm text-slate-500">
          {{ filter === 'differences' ? 'No hay discrepancias entre las dos actas.' : 'Ninguna de las dos actas tiene líneas.' }}
        </p>
        <div v-else class="mt-4 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="py-2 pr-3 text-left" rowspan="2">Jugador</th>
                <th class="border-l border-slate-200 px-2 py-1 text-center text-sky-700" colspan="5">Acta interna</th>
                <th class="border-l border-slate-200 px-2 py-1 text-center text-amber-700" colspan="5">Acta oficial</th>
                <th class="border-l border-slate-200 px-2 py-1 text-left" rowspan="2">Discrepancias</th>
              </tr>
              <tr>
                <th class="border-l border-slate-200 px-2 py-1 text-center">Jugó</th>
                <th class="px-2 py-1 text-center">Tit</th>
                <th class="px-2 py-1 text-center">Min</th>
                <th class="px-2 py-1 text-center">G</th>
                <th class="px-2 py-1 text-center">TA/TR</th>
                <th class="border-l border-slate-200 px-2 py-1 text-center">Jugó</th>
                <th class="px-2 py-1 text-center">Tit</th>
                <th class="px-2 py-1 text-center">Min</th>
                <th class="px-2 py-1 text-center">G</th>
                <th class="px-2 py-1 text-center">TA/TR</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="row in rows" :key="row.player.id" :class="row.differences.length > 0 ? '' : 'text-slate-600'">
                <td class="py-2 pr-3 whitespace-nowrap">
                  <span v-if="row.player.shirtNumber" class="mr-1 text-slate-400">{{ row.player.shirtNumber }}</span>
                  <span class="font-medium text-slate-800">{{ row.player.fullName }}</span>
                  <span v-if="row.player.position" class="ml-1 text-xs text-slate-400">{{ positionShortLabels[row.player.position] }}</span>
                  <p v-if="row.official" class="text-xs text-slate-400">en el acta: {{ row.official.fullName }}</p>
                </td>

                <template v-if="row.coach">
                  <td class="border-l border-slate-200 px-2 py-2 text-center" :class="cell(row, 'played')">{{ yes(row.coach.minutesPlayed > 0) }}</td>
                  <td class="px-2 py-2 text-center" :class="cell(row, 'started')">{{ row.coach.started ? '●' : '' }}</td>
                  <td class="px-2 py-2 text-center tabular-nums" :class="cell(row, 'minutes')">{{ row.coach.minutesPlayed }}</td>
                  <td class="px-2 py-2 text-center tabular-nums" :class="cell(row, 'goals')">{{ row.coach.goals }}</td>
                  <td class="px-2 py-2 text-center tabular-nums" :class="hasDifference(row, 'yellowCards') || hasDifference(row, 'redCard') ? cell(row, 'yellowCards') || cell(row, 'redCard') : ''">{{ row.coach.yellowCards }}/{{ row.coach.redCard ? 1 : 0 }}</td>
                </template>
                <td v-else class="border-l border-slate-200 px-2 py-2 text-center text-xs text-slate-400" colspan="5" :class="cell(row, 'played')">sin línea</td>

                <template v-if="row.official">
                  <td class="border-l border-slate-200 px-2 py-2 text-center" :class="cell(row, 'played')">{{ yes(row.official.played) }}</td>
                  <td class="px-2 py-2 text-center" :class="cell(row, 'started')">{{ row.official.started ? '●' : '' }}</td>
                  <td class="px-2 py-2 text-center tabular-nums" :class="cell(row, 'minutes')">{{ row.official.played ? row.official.minutesPlayed : '—' }}</td>
                  <td class="px-2 py-2 text-center tabular-nums" :class="cell(row, 'goals')">{{ row.official.goals + row.official.penaltyGoals }}</td>
                  <td class="px-2 py-2 text-center tabular-nums" :class="hasDifference(row, 'yellowCards') || hasDifference(row, 'redCard') ? cell(row, 'yellowCards') || cell(row, 'redCard') : ''">{{ row.official.yellowCards }}/{{ row.official.redCard ? 1 : 0 }}</td>
                </template>
                <td v-else class="border-l border-slate-200 px-2 py-2 text-center text-xs text-slate-400" colspan="5" :class="cell(row, 'played')">no convocado</td>

                <td class="border-l border-slate-200 px-2 py-2">
                  <span v-if="row.differences.length === 0" class="text-xs text-emerald-700">✓ coincide</span>
                  <ul v-else class="space-y-0.5 text-xs text-red-700">
                    <li v-for="difference in row.differences" :key="difference.field">
                      <strong>{{ sheetFieldLabels[difference.field] }}:</strong> tú {{ difference.coach ?? '—' }} · federación {{ difference.official ?? '—' }}
                    </li>
                  </ul>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="data.unmatchedOfficial.length > 0" class="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p class="font-medium">En el acta oficial pero sin ficha en la plantilla ({{ data.unmatchedOfficial.length }})</p>
          <p class="text-xs text-amber-800">Añade la ficha (o corrige el nombre o el dorsal) para que se empareje la próxima vez.</p>
          <ul class="mt-2 flex flex-wrap gap-2">
            <li v-for="line in data.unmatchedOfficial" :key="line.id">
              <Badge :tone="line.played ? 'amber' : 'slate'">
                <span v-if="line.shirtNumber" class="mr-1 text-amber-700/70">{{ line.shirtNumber }}</span>{{ line.fullName }}<template v-if="line.played"> · {{ line.minutesPlayed }}'</template>
              </Badge>
            </li>
          </ul>
        </div>

        <p class="mt-3 text-xs text-slate-500">
          Las líneas se emparejan por nombre (la federación escribe «APELLIDOS, NOMBRE» y a veces solo el nombre de pila) y por dorsal.
          Se comparan presencia, titularidad, minutos, goles y tarjetas; el acta oficial no recoge asistencias, tiros ni paradas.
        </p>
      </template>
    </section>

    <OfficialSheetPanel :match-id="matchId" :sheet="data.official" :highlight-team-id="data.squad.teamId" @refreshed="load()" />
  </template>
</template>
