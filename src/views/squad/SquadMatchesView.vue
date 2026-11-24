<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api';
import MatchRow from '@/components/matches/MatchRow.vue';
import NextMatchCard from '@/components/matches/NextMatchCard.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import SuggestionsPanel from '@/components/suggestions/SuggestionsPanel.vue';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';
import { downloadPaperSheet } from '@/utils/paperSheet';
import { useViewer } from '@/composables/useViewer';
import { useAuthStore } from '@/stores/auth';
import { callUpResponseLabels, callUpResponseTone, matchDisplayStatus, nextMatchOf, opponentLabel, type Tone } from '@/utils/format';
import type { CallUpSummaryDto, MatchDto } from '@/types/api';

const auth = useAuthStore();
const { squadId, detail } = useSquad();

const { data, loading, error, run } = useAsync(() => api.squads.matches(squadId.value));

const teamId = computed(() => detail.value?.summary.teamId ?? '');
const canManage = computed(() => detail.value?.canManage ?? false);
// El club propietario y el cuerpo técnico revisan las sugerencias de los jugadores y preparan los partidos (previa).
const canReview = computed(() => detail.value?.canInvitePlayers ?? false);
// El administrador las ve, pero no las resuelve.
const { isAdmin } = useViewer();
// Cuántas líneas tiene el acta interna es cosa de quien la lleva; al jugador no le dice nada.
const showsSheetCount = computed(() => canManage.value || canReview.value || isAdmin.value);

// Los que ya pasaron de hora sin resultado van con los disputados («Sin resultado»); su acta interna se abre cuando
// llega el resultado.
const isPlayed = (m: { match: MatchDto }) => ['Played', 'AwaitingResult'].includes(matchDisplayStatus(m.match));
const played = computed(() => (data.value ?? []).filter(isPlayed).reverse());
const upcoming = computed(() => (data.value ?? []).filter((m) => !isPlayed(m)));
const pending = computed(() => played.value.filter((m) => m.match.status === 'Played' && m.entriesRecorded === 0).length);
// El próximo va destacado arriba del todo y no se repite en «Próximos».
const next = computed(() => nextMatchOf(upcoming.value, (m) => m.match));
const nextMatch = computed(() => next.value?.match ?? null);
const laterMatches = computed(() => upcoming.value.filter((m) => m !== next.value));

// Convocatorias de los próximos partidos (solo quien es de la plantilla las ve; a los demás la API no se las da).
const isInsider = computed(() => canReview.value || detail.value?.summary.myRole !== null || auth.playerSquad?.squadId === squadId.value);
const callUps = useAsync(() => (isInsider.value ? api.trainings.callUps(squadId.value) : Promise.resolve([] as CallUpSummaryDto[])), { redirectOnError: false });
const callUpOf = (matchId: string) => callUps.data.value?.find((c) => c.matchId === matchId) ?? null;

/** Al jugador, cómo va en la convocatoria enviada; al club y al cuerpo técnico, cuántos van o que está en borrador. */
function callUpBadge(matchId: string): { tone: Tone; label: string } | null {
  const callUp = callUpOf(matchId);
  if (!callUp) return null;
  if (callUp.status !== 'Published') return canReview.value ? { tone: 'amber', label: 'Convocatoria en borrador' } : null;
  if (!callUp.mine) return { tone: 'green', label: `${callUp.counts.called} convocados` };
  return callUp.mine.called
    ? { tone: callUpResponseTone[callUp.mine.response], label: `Convocado · ${callUpResponseLabels[callUp.mine.response]}` }
    : { tone: 'slate', label: 'No convocado' };
}

const nextBadge = computed<{ tone: Tone; label: string } | null>(() => {
  if (!nextMatch.value) return null;
  const badge = callUpBadge(nextMatch.value.id);
  if (badge) return badge;
  return canReview.value && callUps.data.value ? { tone: 'slate', label: 'Convocatoria sin preparar' } : null;
});

// El jugador va a su convocatoria (allí la firma) en cuanto se la envían.
const myNextCallUp = computed(() => {
  const callUp = nextMatch.value ? callUpOf(nextMatch.value.id) : null;
  return callUp?.status === 'Published' ? callUp.mine : null;
});
const myCallUpAction = computed(() => {
  const mine = myNextCallUp.value;
  if (!mine) return null;
  if (mine.response === 'Pending' && nextMatch.value?.status !== 'InProgress')
    return { label: mine.called ? 'Firmar la convocatoria' : 'Darme por enterado', primary: true };
  return { label: 'Ver la convocatoria', primary: false };
});

/** Acta en papel para apuntar en directo: la del próximo partido sale con la cabecera rellena. */
function downloadPaper(withNextMatch: boolean) {
  const summary = detail.value?.summary;
  if (!summary) return;
  void downloadPaperSheet({
    teamName: summary.teamName,
    teamId: summary.teamId,
    teamCrestUrl: summary.teamCrestUrl,
    competition: summary.competitionName,
    season: summary.seasonLabel,
    match: withNextMatch ? nextMatch.value : null,
  });
}
</script>

<template>
  <!-- Al recargar (tras resolver una sugerencia) se mantiene la lista: el panel de sugerencias no se vuelve a montar. -->
  <Skeleton v-if="loading && !data" :count="8" label="Cargando partidos y actas…" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <!-- Al club y al cuerpo técnico, la previa y la convocatoria van en botones; a los demás el rival lleva al partido. -->
    <NextMatchCard v-if="nextMatch" class="mb-6" :match="nextMatch" :team-id="teamId" :to="canReview ? null : undefined">
      <template v-if="nextBadge" #badges>
        <Badge :tone="nextBadge.tone">{{ nextBadge.label }}</Badge>
      </template>
      <template v-if="canReview" #actions>
        <RouterLink :to="{ name: 'sheet', params: { squadId, matchId: nextMatch.id }, query: { tab: 'previa' } }" class="btn-secondary">
          <Icon icon="chart-line" class="mr-1.5 h-3.5 w-3.5" />Previa
        </RouterLink>
        <RouterLink :to="{ name: 'sheet', params: { squadId, matchId: nextMatch.id }, query: { tab: 'convocatoria' } }" class="btn-primary">
          <Icon icon="users" class="mr-1.5 h-3.5 w-3.5" />Convocatoria
        </RouterLink>
      </template>
      <template v-else-if="myCallUpAction" #actions>
        <RouterLink :to="{ name: 'sheet', params: { squadId, matchId: nextMatch.id }, query: { tab: 'convocatoria' } }" :class="myCallUpAction.primary ? 'btn-primary' : 'btn-secondary'">
          {{ myCallUpAction.label }}
        </RouterLink>
      </template>
    </NextMatchCard>

    <Alert v-if="canManage && pending > 0" kind="warning" class="mb-4">
      <strong>{{ pending }}</strong> {{ pending === 1 ? 'partido disputado sin acta' : 'partidos disputados sin acta' }}. Entra en cada uno para registrarla.
    </Alert>

    <div v-if="canReview" class="card mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="file-pdf" class="h-4 w-4 text-accent-400" />Acta en papel</h2>
        <p class="text-xs text-slate-500">PDF para imprimir y apuntar el partido a mano (mismas columnas que el acta interna); después la pasas a la app.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button
          v-if="nextMatch"
          type="button"
          class="btn-primary"
          :title="`Con la cabecera rellena: jornada ${nextMatch.matchday}, ${opponentLabel(nextMatch, teamId)}`"
          @click="downloadPaper(true)"
        >
          Del próximo partido
        </button>
        <button type="button" class="btn-secondary" @click="downloadPaper(false)">En blanco</button>
      </div>
    </div>

    <SuggestionsPanel v-if="canReview || isAdmin" class="mb-8" :squad-id="squadId" :team-id="teamId" :readonly="!canReview" @changed="run" />

    <section class="mb-8">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Disputados</h2>
      <p v-if="played.length === 0" class="text-sm text-slate-500">Aún no se ha disputado ningún partido.</p>
      <div v-else class="space-y-2">
        <MatchRow
          v-for="item in played"
          :key="item.match.id"
          :match="item.match"
          :team-id="teamId"
          :to="{ name: 'sheet', params: { squadId, matchId: item.match.id } }"
        >
          <template v-if="showsSheetCount" #badge>
            <Badge v-if="item.entriesRecorded > 0" tone="blue">{{ item.entriesRecorded }} en el acta</Badge>
            <Badge v-else-if="canManage && item.match.status === 'Played'" tone="amber">Sin acta</Badge>
          </template>
        </MatchRow>
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Próximos</h2>
      <p v-if="laterMatches.length === 0" class="text-sm text-slate-500">{{ nextMatch ? 'Después del próximo no hay más partidos programados.' : 'No quedan partidos programados.' }}</p>
      <div v-else class="space-y-2">
        <MatchRow
          v-for="item in laterMatches"
          :key="item.match.id"
          :match="item.match"
          :team-id="teamId"
          :to="canReview ? { name: 'sheet', params: { squadId, matchId: item.match.id }, query: { tab: 'previa' } } : undefined"
        >
          <template v-if="canReview || callUpBadge(item.match.id)" #badge>
            <Badge v-if="callUpBadge(item.match.id)" :tone="callUpBadge(item.match.id)!.tone">{{ callUpBadge(item.match.id)!.label }}</Badge>
            <span v-if="canReview" class="inline-flex items-center gap-1 text-xs font-medium text-brand-500"><Icon icon="chart-line" class="h-3 w-3" />Previa</span>
          </template>
        </MatchRow>
      </div>
    </section>
  </template>
</template>
