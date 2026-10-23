<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { ApiError, errorMessage } from '@/api/http';
import { teamStatsApi } from '@/api/teamStats';
import Alert from '@/components/ui/Alert.vue';
import type { TeamMatchStatsDto, TeamMatchStatsInput } from '@/types/api';
import { formatKickoff } from '@/utils/format';

/**
 * Datos del equipo en el partido que no trae el acta pública (córners, posesión, tiros, fueras de juego, faltas y
 * goles a balón parado). El cuerpo técnico los rellena; el resto de quien ve la plantilla los consulta.
 */
const props = defineProps<{
  squadId: string;
  matchId: string;
  stats: TeamMatchStatsDto | null | undefined;
  canEdit: boolean;
  teamName: string;
  opponentName: string;
}>();

const emit = defineEmits<{ saved: [stats: TeamMatchStatsDto] }>();

type CountKey = Exclude<keyof TeamMatchStatsInput, 'possessionPct' | 'notes'>;

/** Cada fila compara a tu equipo con el rival. */
const rows: { label: string; mine: CountKey; theirs: CountKey; max: number }[] = [
  { label: 'Córners', mine: 'cornersFor', theirs: 'cornersAgainst', max: 50 },
  { label: 'Tiros', mine: 'shotsFor', theirs: 'shotsAgainst', max: 100 },
  { label: 'Tiros a puerta', mine: 'shotsOnTargetFor', theirs: 'shotsOnTargetAgainst', max: 100 },
  { label: 'Fueras de juego', mine: 'offsidesFor', theirs: 'offsidesAgainst', max: 50 },
  { label: 'Faltas cometidas', mine: 'foulsCommitted', theirs: 'foulsReceived', max: 100 },
  { label: 'Goles a balón parado', mine: 'setPieceGoalsFor', theirs: 'setPieceGoalsAgainst', max: 30 },
];

const empty = (): TeamMatchStatsInput => ({
  possessionPct: null,
  cornersFor: 0,
  cornersAgainst: 0,
  shotsFor: 0,
  shotsAgainst: 0,
  shotsOnTargetFor: 0,
  shotsOnTargetAgainst: 0,
  offsidesFor: 0,
  offsidesAgainst: 0,
  foulsCommitted: 0,
  foulsReceived: 0,
  setPieceGoalsFor: 0,
  setPieceGoalsAgainst: 0,
  notes: null,
});

const form = reactive<TeamMatchStatsInput>(empty());
const saved = ref<TeamMatchStatsDto | null>(null);

function load(stats: TeamMatchStatsDto | null | undefined) {
  saved.value = stats ?? null;
  const { updatedAt: _, ...values } = stats ?? { ...empty(), updatedAt: '' };
  Object.assign(form, values);
}
watch(() => props.stats, load, { immediate: true });

const possessionAgainst = computed(() => (form.possessionPct === null ? null : 100 - form.possessionPct));
const dirty = computed(() => {
  const base: TeamMatchStatsInput = saved.value ?? empty();
  return (Object.keys(base) as (keyof TeamMatchStatsInput)[]).some((k) => k !== ('updatedAt' as never) && (form[k] ?? null) !== (base[k] ?? null));
});

const saving = ref(false);
const error = ref<string | null>(null);
const notice = ref(false);

async function save() {
  saving.value = true;
  error.value = null;
  notice.value = false;
  try {
    const result = await teamStatsApi.record(props.squadId, props.matchId, {
      ...form,
      possessionPct: form.possessionPct === null || (form.possessionPct as unknown) === '' ? null : Number(form.possessionPct),
      notes: form.notes?.trim() ? form.notes.trim() : null,
    });
    load(result);
    notice.value = true;
    emit('saved', result);
  } catch (e) {
    error.value = e instanceof ApiError && Object.keys(e.fieldErrors).length > 0
      ? Object.values(e.fieldErrors).flat().join(' ')
      : errorMessage(e);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <section class="card">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 class="font-semibold text-slate-900">Datos del equipo</h2>
        <p class="text-xs text-slate-500">
          Lo que no trae el acta pública: córners, posesión, tiros, fueras de juego, faltas y goles a balón parado.
          <template v-if="saved"> Actualizado el {{ formatKickoff(saved.updatedAt) }}.</template>
        </p>
      </div>
      <button v-if="canEdit" type="button" class="btn-primary" v-busy="saving" :disabled="saving || !dirty" @click="save">
        {{ saving ? 'Guardando…' : 'Guardar datos del equipo' }}
      </button>
    </div>

    <Alert v-if="error" kind="error" class="mb-3">{{ error }}</Alert>
    <Alert v-if="notice" kind="success" class="mb-3">Datos del equipo guardados.</Alert>

    <p v-if="!canEdit && !saved" class="text-sm text-slate-500">El cuerpo técnico todavía no ha apuntado los datos del equipo de este partido.</p>

    <template v-else>
      <div class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="px-2 py-2 text-left"></th>
              <th class="px-2 py-2 text-center text-accent-400">{{ teamName }}</th>
              <th class="px-2 py-2 text-center">{{ opponentName }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr>
              <td class="px-2 py-1.5 font-medium text-slate-700">Posesión (%)</td>
              <td class="px-2 py-1.5 text-center">
                <input
                  v-if="canEdit"
                  v-model.number="form.possessionPct"
                  type="number"
                  min="0"
                  max="100"
                  class="input w-20 px-1 py-1 text-center"
                  placeholder="—"
                  aria-label="Posesión de tu equipo"
                />
                <span v-else class="tabular-nums">{{ form.possessionPct ?? '—' }}</span>
              </td>
              <td class="px-2 py-1.5 text-center tabular-nums text-slate-500">{{ possessionAgainst ?? '—' }}</td>
            </tr>
            <tr v-for="row in rows" :key="row.mine">
              <td class="px-2 py-1.5 font-medium text-slate-700">{{ row.label }}</td>
              <td v-for="key in [row.mine, row.theirs]" :key="key" class="px-2 py-1.5 text-center">
                <input
                  v-if="canEdit"
                  v-model.number="form[key]"
                  type="number"
                  min="0"
                  :max="row.max"
                  class="input w-20 px-1 py-1 text-center"
                  :aria-label="`${row.label}: ${key === row.mine ? teamName : opponentName}`"
                />
                <span v-else class="tabular-nums">{{ form[key] }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="mt-2 text-xs text-slate-500">En «Faltas cometidas», la columna del rival son las faltas que te hicieron (faltas recibidas).</p>

      <label class="mt-4 block">
        <span class="label">Notas del partido</span>
        <textarea
          v-if="canEdit"
          v-model="form.notes"
          rows="3"
          maxlength="2000"
          class="input mt-1 w-full"
          placeholder="Planteamiento, balón parado, qué funcionó y qué no… (opcional)"
        />
        <p v-else class="mt-1 whitespace-pre-line text-sm text-slate-700">{{ form.notes || '—' }}</p>
      </label>
    </template>
  </section>
</template>
