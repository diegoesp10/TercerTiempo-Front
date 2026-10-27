<script setup lang="ts">
import { reactive, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StarInput from '@/components/referees/StarInput.vue';
import StarRating from '@/components/referees/StarRating.vue';
import type { MatchOfficialDto, MatchOfficialsDto } from '@/types/api';
import { formatScore, officialRoleLabels } from '@/utils/format';

const dutyOf = (official: MatchOfficialDto) => (official.role === 'Referee' ? 'como principal' : 'como asistente');

/**
 * Equipo arbitral de un partido y la nota que le pone el equipo de la cuenta (su club o su cuerpo técnico): de 0 a 10 a
 * cada uno, con un comentario opcional. Solo con el partido ya jugado; las notas las ven los demás clubes y técnicos.
 */
const props = defineProps<{ matchId: string }>();

const data = shallowRef<MatchOfficialsDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref<string | null>(null);
const saved = ref<string | null>(null);
const drafts = reactive<Record<string, { score: number | null; comment: string }>>({});

function fill(dto: MatchOfficialsDto) {
  data.value = dto;
  for (const official of dto.officials)
    drafts[official.refereeId] = { score: official.myScore, comment: official.myComment ?? '' };
}

async function load() {
  loading.value = true;
  error.value = null;
  try {
    fill(await api.referees.matchOfficials(props.matchId));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch(() => props.matchId, load, { immediate: true });

const changed = (official: MatchOfficialDto) => {
  const draft = drafts[official.refereeId];
  return !!draft && draft.score !== null && (draft.score !== official.myScore || draft.comment.trim() !== (official.myComment ?? ''));
};

async function save(official: MatchOfficialDto) {
  const draft = drafts[official.refereeId];
  if (!draft || draft.score === null) return;
  saving.value = official.refereeId;
  saved.value = null;
  error.value = null;
  try {
    fill(await api.referees.rate(props.matchId, official.refereeId, {
      score: draft.score,
      comment: draft.comment.trim() || null,
      teamId: data.value?.raterTeamId ?? null,
    }));
    saved.value = official.refereeId;
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    saving.value = null;
  }
}
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900">Equipo arbitral</h2>
        <p class="mt-1 max-w-2xl text-xs text-slate-500">
          Puntúa de 0 a 10 al árbitro, a los asistentes y al cuarto árbitro<template v-if="data?.raterTeamName"> en nombre de <strong class="text-slate-700">{{ data.raterTeamName }}</strong></template>,
          con un comentario si quieres explicar la nota. Es una referencia para los clubes: la ven los demás clubes y cuerpos técnicos, nunca los jugadores ni el público.
        </p>
      </div>
      <RouterLink :to="{ name: 'referees', query: data?.categoryKey ? { categoria: data.categoryKey } : {} }" class="btn-ghost px-3 py-1.5 text-xs">
        <Icon icon="flag" class="h-3.5 w-3.5" />{{ data?.category ? `Árbitros de ${data.category}` : 'Todos los árbitros' }}
      </RouterLink>
    </div>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>
    <Spinner v-if="loading && !data" class="my-6" />

    <template v-else-if="data">
      <p v-if="data.officials.length === 0" class="mt-4 text-sm text-slate-500">
        Todavía no tenemos el equipo arbitral de este partido: sale del acta de la federación o de futbolasturiano.es cuando lo publican.
      </p>
      <Alert v-else-if="!data.played" kind="info" class="mt-4">Se puntúa cuando el partido se haya jugado.</Alert>

      <ul v-if="data.officials.length" class="mt-4 space-y-3">
        <li v-for="official in data.officials" :key="official.refereeId" class="rounded-xl border border-line bg-surface-2 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ officialRoleLabels[official.role] }}</p>
              <RouterLink :to="{ name: 'referee', params: { refereeId: official.refereeId } }" class="font-semibold text-slate-900 hover:text-accent-400">{{ official.name }}</RouterLink>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <StarRating :score="official.average" size="sm" />
              <span><strong class="text-slate-700">{{ formatScore(official.average) }}</strong> · {{ official.ratings === 1 ? '1 nota' : `${official.ratings} notas` }} {{ dutyOf(official) }}</span>
            </div>
          </div>

          <div v-if="data.canRate && drafts[official.refereeId]" class="mt-3 space-y-2 border-t border-line pt-3">
            <StarInput v-model="drafts[official.refereeId]!.score" :disabled="saving === official.refereeId" :label="`Nota de 0 a 10 para ${official.name}`" />
            <textarea
              v-model="drafts[official.refereeId]!.comment"
              rows="2"
              maxlength="1000"
              class="input w-full text-sm"
              placeholder="Comentario opcional: por qué esta nota"
              :aria-label="`Comentario sobre ${official.name}`"
            />
            <div class="flex flex-wrap items-center gap-3">
              <button type="button" class="btn-primary px-3 py-1.5 text-xs" v-busy="saving === official.refereeId" :disabled="saving !== null || !changed(official)" @click="save(official)">
                {{ official.myScore === null ? 'Guardar nota' : 'Cambiar nota' }}
              </button>
              <span v-if="saved === official.refereeId" class="text-xs font-medium text-emerald-600">Nota guardada.</span>
              <span v-else-if="official.myScore !== null" class="text-xs text-slate-500">Tu equipo le puso un {{ official.myScore }}.</span>
            </div>
          </div>
        </li>
      </ul>
    </template>
  </section>
</template>
