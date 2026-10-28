<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api';
import MatchRow from '@/components/matches/MatchRow.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import SuggestionsPanel from '@/components/suggestions/SuggestionsPanel.vue';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';
import { downloadPaperSheet } from '@/utils/paperSheet';
import TeamName from '@/components/teams/TeamName.vue';
import { opponentOf } from '@/utils/crests';
import { useViewer } from '@/composables/useViewer';

const { squadId, detail } = useSquad();

const { data, loading, error, run } = useAsync(() => api.squads.matches(squadId.value));

const teamId = computed(() => detail.value?.summary.teamId ?? '');
const canManage = computed(() => detail.value?.canManage ?? false);
// El club propietario y el cuerpo técnico revisan las sugerencias de los jugadores y preparan los partidos (previa).
const canReview = computed(() => detail.value?.canInvitePlayers ?? false);
// El administrador las ve, pero no las resuelve.
const { isAdmin } = useViewer();

const played = computed(() => (data.value ?? []).filter((m) => m.match.status === 'Played').reverse());
const upcoming = computed(() => (data.value ?? []).filter((m) => m.match.status !== 'Played'));
const pending = computed(() => played.value.filter((m) => m.entriesRecorded === 0).length);
const nextMatch = computed(() => upcoming.value[0]?.match ?? null);

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
    <Alert v-if="canManage && pending > 0" kind="warning" class="mb-4">
      <strong>{{ pending }}</strong> {{ pending === 1 ? 'partido disputado sin acta' : 'partidos disputados sin acta' }}. Entra en cada uno para registrarla.
    </Alert>

    <div v-if="canReview" class="card mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="flex items-center gap-2 font-semibold text-slate-900"><Icon icon="file-pdf" class="h-4 w-4 text-accent-400" />Acta en papel</h2>
        <p class="text-xs text-slate-500">PDF para imprimir y apuntar el partido a mano (mismas columnas que el acta interna); después la pasas a la app.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <button v-if="nextMatch" type="button" class="btn-primary min-w-0 max-w-full" @click="downloadPaper(true)">
          Próximo partido · J{{ nextMatch.matchday }}
          <TeamName prefix="vs" :name="opponentOf(nextMatch, teamId).name" :crest-url="opponentOf(nextMatch, teamId).crestUrl" :short-name="opponentOf(nextMatch, teamId).shortName" />
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
          <template #badge>
            <Badge v-if="item.entriesRecorded > 0" tone="blue">{{ item.entriesRecorded }} en el acta</Badge>
            <Badge v-else-if="canManage" tone="amber">Sin acta</Badge>
          </template>
        </MatchRow>
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Próximos</h2>
      <p v-if="upcoming.length === 0" class="text-sm text-slate-500">No quedan partidos programados.</p>
      <div v-else class="space-y-2">
        <MatchRow
          v-for="item in upcoming"
          :key="item.match.id"
          :match="item.match"
          :team-id="teamId"
          :to="canReview ? { name: 'sheet', params: { squadId, matchId: item.match.id }, query: { tab: 'previa' } } : undefined"
        >
          <template v-if="canReview" #badge>
            <span class="inline-flex items-center gap-1 text-xs font-medium text-brand-500"><Icon icon="chart-line" class="h-3 w-3" />Previa</span>
          </template>
        </MatchRow>
      </div>
    </section>
  </template>
</template>
