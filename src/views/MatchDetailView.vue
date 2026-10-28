<script setup lang="ts">
import { ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import OfficialSheetPanel from '@/components/sheet/OfficialSheetPanel.vue';
import MatchOfficialsPanel from '@/components/referees/MatchOfficialsPanel.vue';
import MatchVideos from '@/components/videos/MatchVideos.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import GoalMarks from '@/components/sheet/GoalMarks.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { useViewer } from '@/composables/useViewer';
import { formatKickoff, matchStatusLabels, positionShortLabels, visibilityLabels } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';
import PlayerName from '@/components/players/PlayerName.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';

const props = defineProps<{ matchId: string }>();

const auth = useAuthStore();
const { signedIn } = useViewer();
const route = useRoute();
const router = useRouter();
const { data, loading, error } = useAsync(() => api.matches.get(props.matchId));

// Quien gestiona uno de los dos equipos (su club o su cuerpo técnico) ve el partido como el cuerpo técnico: con la
// previa, el acta interna, el comparador y el vídeo. Si el club aún no tenía la plantilla de esa temporada, se abre.
const opening = ref(false);
const openError = ref<string | null>(null);
watch(data, async (detail) => {
  if (!detail?.managedTeamId) return;
  opening.value = true;
  try {
    let squadId = detail.managedSquadId;
    if (!squadId) {
      squadId = (await api.clubs.openSquad(detail.managedTeamId, detail.match.id)).squadId;
      void auth.refreshAccount();
    }
    await router.replace({ name: 'sheet', params: { squadId, matchId: detail.match.id }, query: route.query });
  } catch (e) {
    openError.value = errorMessage(e);
    opening.value = false;
  }
}, { immediate: true });
</script>

<template>
  <Spinner v-if="(loading && !data) || opening" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <Alert v-if="openError" kind="error" class="mb-4">No se pudo abrir la vista del cuerpo técnico: {{ openError }}</Alert>
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          <strong v-if="data.competitionName" class="text-slate-700">{{ data.competitionName }}</strong>
          <template v-if="data.seasonLabel"> · temporada {{ data.seasonLabel }}</template>
          · Jornada {{ data.match.matchday }} · {{ formatKickoff(data.match.kickoffAt) }}<span v-if="data.match.venue"> · {{ data.match.venue }}</span>
        </span>
        <Badge :tone="data.match.status === 'Played' ? 'slate' : 'blue'">{{ matchStatusLabels[data.match.status] }}</Badge>
      </div>
      <div class="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-center">
        <RouterLink :to="{ name: 'team', params: { teamId: data.match.homeTeam.id } }" class="flex min-w-0 flex-col items-center gap-2 break-words text-sm font-semibold text-slate-900 hover:text-accent-400 sm:text-lg">
          <TeamCrest :src="data.match.homeTeam.crestUrl" :name="data.match.homeTeam.name" :short-name="data.match.homeTeam.shortName" size="lg" />
          {{ data.match.homeTeam.name }}
        </RouterLink>
        <div class="text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
          <template v-if="data.match.status === 'Played'">{{ data.match.homeGoals }} - {{ data.match.awayGoals }}</template>
          <span v-else class="text-slate-300">vs</span>
        </div>
        <RouterLink :to="{ name: 'team', params: { teamId: data.match.awayTeam.id } }" class="flex min-w-0 flex-col items-center gap-2 break-words text-sm font-semibold text-slate-900 hover:text-accent-400 sm:text-lg">
          <TeamCrest :src="data.match.awayTeam.crestUrl" :name="data.match.awayTeam.name" :short-name="data.match.awayTeam.shortName" size="lg" />
          {{ data.match.awayTeam.name }}
        </RouterLink>
      </div>
    </div>

    <div class="mt-6">
      <OfficialSheetPanel :match-id="data.match.id" :highlight-team-id="data.managedTeamId" />
    </div>

    <!-- El equipo arbitral y las notas de los dos equipos son públicos; se puntúa desde la vista del cuerpo técnico. -->
    <div v-if="data.match.status === 'Played'" class="mt-6">
      <MatchOfficialsPanel :match-id="data.match.id" />
    </div>

    <!-- El vídeo se sube desde el acta interna del equipo y solo existe cuando ya se ha jugado. -->
    <div v-if="data.match.status === 'Played'" class="mt-6">
      <MatchVideos :match-id="data.match.id" />
    </div>

    <Alert v-if="data.sheets.length === 0" kind="info" class="mt-6 leading-relaxed">
      Ninguno de los dos equipos tiene todavía plantilla en Tercer Tiempo, así que no hay actas internas que mostrar. El acta pública de la federación y el vídeo, si lo hay, son públicos.
    </Alert>

    <section v-for="sheet in data.sheets" :key="sheet.squadId" class="card mt-6">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-slate-900">
          Acta interna de <TeamName :name="sheet.teamName" :team-id="sheet.teamId" size="sm" />
          <Badge :tone="sheet.visibility === 'Public' ? 'green' : 'slate'" class="ml-2">{{ visibilityLabels[sheet.visibility] }}</Badge>
        </h2>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <RouterLink v-if="sheet.visible" :to="{ name: 'squad', params: { squadId: sheet.squadId } }" class="text-accent-400 hover:underline">Ver plantilla</RouterLink>
          <RouterLink
            v-if="data.managedSquadId === sheet.squadId && data.match.status === 'Played'"
            :to="{ name: 'sheet', params: { squadId: sheet.squadId, matchId: data.match.id }, query: { tab: 'interna' } }"
            class="font-medium text-accent-400 hover:underline"
          >
            Editar acta
          </RouterLink>
          <RouterLink
            v-if="sheet.visible"
            :to="{ name: 'sheet', params: { squadId: sheet.squadId, matchId: data.match.id }, query: { tab: 'comparador' } }"
            class="text-accent-400 hover:underline"
          >
            Comparar con el acta pública
          </RouterLink>
        </div>
      </div>

      <p v-if="!sheet.visible && sheet.visibility === 'Public'" class="text-sm text-slate-500">
        Plantilla pública: su acta interna la ven las cuentas de los equipos con licencia vigente en Tercer Tiempo.
        <template v-if="!signedIn"><RouterLink to="/login" class="font-medium text-accent-400 hover:underline">Entra con tu cuenta</RouterLink> para verla.</template>
      </p>
      <p v-else-if="!sheet.visible" class="text-sm text-slate-500">
        Acta privada: solo su club, su cuerpo técnico y sus jugadores vinculados pueden verla. Será pública cuando la plantilla decida compartirla.
      </p>
      <p v-else-if="sheet.entries.length === 0" class="text-sm text-slate-500">El cuerpo técnico todavía no ha registrado el acta de este partido.</p>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="py-2 pr-3 text-left">Jugador</th>
              <th class="px-2 py-2 text-center">Min</th>
              <th class="px-2 py-2 text-center">G</th>
              <th class="col-sm px-2 py-2 text-center">A</th>
              <th class="col-sm px-2 py-2 text-center">Tiros</th>
              <th class="col-md px-2 py-2 text-center">Ent</th>
              <th class="col-md px-2 py-2 text-center">Int</th>
              <th class="col-md px-2 py-2 text-center">Par</th>
              <th class="px-2 py-2 text-center">TA/TR</th>
              <th class="px-2 py-2 text-center">Nota</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in sheet.entries" :key="p.id" :class="p.squadPlayerId === auth.playerSquad?.squadPlayerId ? 'bg-brand-500/10' : ''">
              <td class="py-2 pr-3 whitespace-nowrap">
                <span v-if="p.shirtNumber" class="mr-1 text-slate-400">{{ p.shirtNumber }}</span>
                <PlayerName :name="p.playerName" :photo-url="p.playerPhotoUrl" class="font-medium text-slate-800" />
                <span class="ml-1 text-xs text-slate-400">
                  <template v-if="p.position">{{ positionShortLabels[p.position] }}</template>
                  <template v-if="p.started"> · titular</template>
                </span>
              </td>
              <td class="px-2 py-2 text-center tabular-nums">{{ p.minutesPlayed }}</td>
              <td class="px-2 py-2 text-center"><GoalMarks :goals="p.goals" /></td>
              <td class="col-sm px-2 py-2 text-center tabular-nums">{{ p.assists }}</td>
              <td class="col-sm px-2 py-2 text-center tabular-nums">{{ p.shotsOnTarget }}/{{ p.shots }}</td>
              <td class="col-md px-2 py-2 text-center tabular-nums">{{ p.tackles }}</td>
              <td class="col-md px-2 py-2 text-center tabular-nums">{{ p.interceptions }}</td>
              <td class="col-md px-2 py-2 text-center tabular-nums">{{ p.saves }}</td>
              <td class="px-2 py-2 text-center"><CardMarks :yellow-cards="p.yellowCards" :red-card="p.redCard" /></td>
              <td class="px-2 py-2 text-center"><RatingBadge :rating="p.rating" size="sm" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
