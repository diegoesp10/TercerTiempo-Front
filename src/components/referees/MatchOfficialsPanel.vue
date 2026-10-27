<script setup lang="ts">
import { computed, reactive, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Spinner from '@/components/ui/Spinner.vue';
import StarInput from '@/components/referees/StarInput.vue';
import StarRating from '@/components/referees/StarRating.vue';
import TeamRatingItem from '@/components/referees/TeamRatingItem.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import type { MatchOfficialDto, MatchOfficialsDto } from '@/types/api';
import { formatScore, officialRoleLabels } from '@/utils/format';

/**
 * Equipo arbitral de un partido con las notas de los dos equipos: cuánto, por qué y quién las puso. Lo ve cualquiera,
 * con cuenta o sin ella. El club o el cuerpo técnico de uno de los dos equipos (con licencia) puntúa a cada uno una sola
 * vez, de 0 a 10 y con un comentario opcional, y lo confirma dos veces antes de guardarlo: la nota es definitiva.
 */
const props = defineProps<{ matchId: string }>();
const auth = useAuthStore();

const data = shallowRef<MatchOfficialsDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
const saving = ref<string | null>(null);
const saved = ref<string | null>(null);
const drafts = reactive<Record<string, { score: number | null; comment: string }>>({});

function fill(dto: MatchOfficialsDto) {
  data.value = dto;
  for (const official of dto.officials) drafts[official.refereeId] ??= { score: null, comment: '' };
}

async function load() {
  loading.value = true;
  try {
    fill(await api.referees.matchOfficials(props.matchId));
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
watch(() => props.matchId, () => {
  error.value = null;
  void load();
}, { immediate: true });

const teams = computed(() => (data.value ? [data.value.homeTeam, data.value.awayTeam] : []));
const ratingOf = (official: MatchOfficialDto, teamId: string) => official.teamRatings.find((r) => r.teamId === teamId);
const canRate = (official: MatchOfficialDto) => !!data.value?.canRate && official.myScore === null;
const voter = computed(() => auth.account?.club?.name ?? auth.account?.coach?.displayName ?? 'tu cuenta');

async function save(official: MatchOfficialDto) {
  const draft = drafts[official.refereeId];
  if (!draft || draft.score === null || !data.value) return;
  const score = draft.score;
  const comment = draft.comment.trim();
  const team = data.value.raterTeamName ?? 'tu equipo';
  const role = officialRoleLabels[official.role].toLowerCase();

  const first = await confirmDialog({
    title: `¿Un ${score} a ${official.name}?`,
    message: comment
      ? `Es la nota de ${team} a su actuación como ${role}, con este comentario: «${comment}»`
      : `Es la nota de ${team} a su actuación como ${role}, sin comentario. Si quieres explicar por qué, escríbelo antes de guardarla.`,
    confirmLabel: 'Continuar',
    cancelLabel: 'Revisarla',
  });
  if (!first) return;
  const second = await confirmDialog({
    title: '¿Seguro? La nota es definitiva',
    message: `Una vez guardada no se puede cambiar ni borrar. Será pública, a nombre de ${voter.value}, y la verá cualquiera, también sin cuenta.`,
    confirmLabel: `Sí, guardar el ${score}`,
    cancelLabel: 'No, volver',
  });
  if (!second) return;

  saving.value = official.refereeId;
  saved.value = null;
  error.value = null;
  try {
    fill(await api.referees.rate(props.matchId, official.refereeId, {
      score,
      comment: comment || null,
      teamId: data.value.raterTeamId,
      confirmed: true,
    }));
    saved.value = official.refereeId;
  } catch (e) {
    error.value = errorMessage(e);
    await load();
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
          Cada equipo puntúa de 0 a 10 al árbitro, a los asistentes y al cuarto árbitro, una sola vez y con un comentario si quiere explicar la nota.
          Las notas son públicas y definitivas, con quién las puso.
          <template v-if="data?.canRate && data.raterTeamName"> Puntúas en nombre de <strong class="text-slate-700">{{ data.raterTeamName }}</strong>.</template>
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
      <Alert v-else-if="data.raterTeamId && !data.played" kind="info" class="mt-4">Se puntúa cuando el partido se haya jugado.</Alert>
      <Alert v-else-if="data.needsLicense" kind="info" class="mt-4">Con la licencia vigente de tu club podrás puntuar al equipo arbitral de tus partidos.</Alert>

      <ul v-if="data.officials.length" class="mt-4 space-y-3">
        <li v-for="official in data.officials" :key="official.refereeId" class="rounded-xl border border-line p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="min-w-0">
              <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">{{ officialRoleLabels[official.role] }}</p>
              <RouterLink :to="{ name: 'referee', params: { refereeId: official.refereeId } }" class="font-semibold text-slate-900 hover:text-accent-400">{{ official.name }}</RouterLink>
            </div>
            <div class="flex items-center gap-2 text-xs text-slate-500">
              <StarRating :score="official.average" size="sm" />
              <span>
                <strong class="text-slate-700">{{ formatScore(official.average) }}</strong> ·
                {{ official.ratings === 1 ? '1 nota' : `${official.ratings} notas` }} {{ official.role === 'Referee' ? 'como principal' : 'como asistente' }}
              </span>
            </div>
          </div>

          <div v-if="data.played" class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <template v-for="team in teams" :key="team.id">
              <TeamRatingItem v-if="ratingOf(official, team.id)" :rating="ratingOf(official, team.id)!" />
              <p v-else class="rounded-xl border border-dashed border-line p-3 text-xs text-slate-500">
                <strong class="text-slate-600">{{ team.name }}</strong> todavía no le ha puesto nota.
              </p>
            </template>
          </div>

          <div v-if="canRate(official) && drafts[official.refereeId]" class="mt-3 space-y-2 border-t border-line pt-3">
            <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Tu nota en nombre de {{ data.raterTeamName }}</p>
            <StarInput v-model="drafts[official.refereeId]!.score" :disabled="saving === official.refereeId" :label="`Nota de 0 a 10 para ${official.name}`" />
            <textarea
              v-model="drafts[official.refereeId]!.comment"
              rows="2"
              maxlength="1000"
              class="input w-full text-sm"
              placeholder="Por qué esta nota (opcional, pero ayuda a entenderla)"
              :aria-label="`Comentario sobre ${official.name}`"
            />
            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                class="btn-primary px-3 py-1.5 text-xs"
                v-busy="saving === official.refereeId"
                :disabled="saving !== null || drafts[official.refereeId]!.score === null"
                @click="save(official)"
              >Guardar nota</button>
              <span class="text-xs text-slate-500">Se pide confirmarla dos veces: después no se puede cambiar.</span>
            </div>
          </div>
          <p v-else-if="saved === official.refereeId" class="mt-3 text-xs font-medium text-emerald-600">Nota guardada. Ya es definitiva y pública.</p>
        </li>
      </ul>
    </template>
  </section>
</template>
