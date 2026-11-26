<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import OfficialSheetPanel from '@/components/sheet/OfficialSheetPanel.vue';
import MatchOfficialsPanel from '@/components/referees/MatchOfficialsPanel.vue';
import MatchVideos from '@/components/videos/MatchVideos.vue';
import RequestAccessModal from '@/components/passes/RequestAccessModal.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import CardMarks from '@/components/sheet/CardMarks.vue';
import GoalMarks from '@/components/sheet/GoalMarks.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useSort, type SortValue } from '@/composables/useSort';
import { useAuthStore } from '@/stores/auth';
import { useViewer } from '@/composables/useViewer';
import { awaitingResultHint, formatKickoff, matchDisplayLabels, matchDisplayStatus, passPrice, positionShortLabels, visibilityLabels } from '@/utils/format';
import type { MatchSquadSheetDto, PerformanceDto } from '@/types/api';
import TeamName from '@/components/teams/TeamName.vue';
import PlayerName from '@/components/players/PlayerName.vue';
import StarterMark from '@/components/sheet/StarterMark.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';

const props = defineProps<{ matchId: string }>();

const auth = useAuthStore();
const { signedIn } = useViewer();
const route = useRoute();
const router = useRouter();
const { data, loading, error, run } = useAsync(() => api.matches.get(props.matchId), { revalidate: true });

// Solicitud de acceso a lo interno de un partido (acta interna y vídeo) de una plantilla abierta a solicitudes.
const requesting = ref<{ sheet: MatchSquadSheetDto; video: boolean } | null>(null);
const requested = ref(false);

function openRequest(squadId: string, video = false) {
  const sheet = data.value?.sheets.find((s) => s.squadId === squadId);
  if (sheet?.access?.canRequest) requesting.value = { sheet, video };
}

async function onRequested() {
  requested.value = true;
  await run();
}

// Plantillas cuyo vídeo privado se puede pedir desde aquí (abiertas a solicitudes y sin pase de vídeo todavía).
const requestableSquads = computed(() => data.value?.sheets.filter((s) => s.access?.canRequest && !s.access.videoPass).map((s) => s.squadId) ?? []);

// Quien gestiona uno de los dos equipos (su club o su cuerpo técnico) ve el partido como el cuerpo técnico: con la
// previa, el acta interna, el comparador y el vídeo. Si el club aún no tenía la plantilla de esa temporada, se abre.
// Con ?vista=visitante se queda aquí: así ve lo del rival que le hayan dado con un pase.
const asVisitor = computed(() => route.query.vista === 'visitante');
const opening = ref(false);
const openError = ref<string | null>(null);
watch(data, async (detail) => {
  if (!detail?.managedTeamId || asVisitor.value) return;
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

// Las actas internas de los dos equipos comparten el orden: se ordenan todas las líneas juntas y cada tabla se queda
// con las suyas. `lineup` no tiene columna: es el orden del acta (titulares, minutos, dorsal) y el de partida.
interface EntryRow { entry: PerformanceDto; squadId: string; order: number }
const entryRows = computed<EntryRow[]>(() =>
  (data.value?.sheets ?? []).flatMap((s) => s.entries.map((entry) => ({ entry, squadId: s.squadId }))).map((row, order) => ({ ...row, order })));
type EntrySortKey = 'lineup' | 'player' | 'minutes' | 'goals' | 'assists' | 'shots' | 'tackles' | 'interceptions' | 'saves' | 'cards' | 'rating';
const entryGetters: Record<EntrySortKey, (r: EntryRow) => SortValue> = {
  lineup: (r) => r.order,
  player: (r) => r.entry.playerName,
  minutes: (r) => r.entry.minutesPlayed,
  goals: (r) => r.entry.goals,
  assists: (r) => r.entry.assists,
  shots: (r) => r.entry.shotsOnTarget * 1000 + r.entry.shots,
  tackles: (r) => r.entry.tackles,
  interceptions: (r) => r.entry.interceptions,
  saves: (r) => r.entry.saves,
  cards: (r) => (r.entry.redCard ? 10 : 0) + r.entry.yellowCards,
  rating: (r) => r.entry.rating,
};
const { sorted: sortedEntries, sortBy, state } = useSort<EntryRow, EntrySortKey>(entryRows, entryGetters, 'lineup', {
  desc: false,
  ascendingFirst: ['lineup', 'player'],
});
const entriesOf = (sheet: MatchSquadSheetDto) => sortedEntries.value.filter((r) => r.squadId === sheet.squadId).map((r) => r.entry);
</script>

<template>
  <Spinner v-if="(loading && !data) || opening" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <Alert v-if="openError" kind="error" class="mb-4">No se pudo abrir la vista del cuerpo técnico: {{ openError }}</Alert>
    <Alert v-if="asVisitor && data.managedSquadId" kind="info" class="mb-4">
      Estás viendo el partido como visitante: lo de tu rival que te hayan dado con un pase.
      <RouterLink :to="{ name: 'sheet', params: { squadId: data.managedSquadId, matchId: data.match.id } }" class="font-medium underline">Volver a la vista de tu equipo</RouterLink>
    </Alert>
    <div class="card">
      <!-- El título de la página para lectores de pantalla y buscadores: el marcador ya lo dice a la vista. -->
      <h1 class="sr-only">{{ data.match.homeTeam.name }} {{ data.match.status === 'Played' ? `${data.match.homeGoals}-${data.match.awayGoals}` : 'contra' }} {{ data.match.awayTeam.name }}</h1>
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          <strong v-if="data.competitionName" class="text-slate-700">{{ data.competitionName }}</strong>
          <template v-if="data.seasonLabel"> · temporada {{ data.seasonLabel }}</template>
          · Jornada {{ data.match.matchday }} · {{ formatKickoff(data.match.kickoffAt) }}<span v-if="data.match.venue"> · {{ data.match.venue }}</span>
        </span>
        <Badge :tone="['Played', 'AwaitingResult'].includes(matchDisplayStatus(data.match)) ? 'slate' : 'blue'" :title="matchDisplayStatus(data.match) === 'AwaitingResult' ? awaitingResultHint : undefined">{{ matchDisplayLabels[matchDisplayStatus(data.match)] }}</Badge>
      </div>
      <div class="mt-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-center">
        <RouterLink :to="{ name: 'team', params: { teamId: data.match.homeTeam.id } }" class="flex min-w-0 flex-col items-center gap-2 break-words text-sm font-semibold text-slate-900 hover:text-accent-400 sm:text-lg">
          <TeamCrest :src="data.match.homeTeam.crestUrl" :name="data.match.homeTeam.name" :short-name="data.match.homeTeam.shortName" size="lg" />
          {{ data.match.homeTeam.name }}
        </RouterLink>
        <div class="text-2xl font-bold tabular-nums text-slate-900 sm:text-3xl">
          <template v-if="data.match.status === 'Played'">{{ data.match.homeGoals }} - {{ data.match.awayGoals }}</template>
          <span v-else class="text-slate-400">vs</span>
        </div>
        <RouterLink :to="{ name: 'team', params: { teamId: data.match.awayTeam.id } }" class="flex min-w-0 flex-col items-center gap-2 break-words text-sm font-semibold text-slate-900 hover:text-accent-400 sm:text-lg">
          <TeamCrest :src="data.match.awayTeam.crestUrl" :name="data.match.awayTeam.name" :short-name="data.match.awayTeam.shortName" size="lg" />
          {{ data.match.awayTeam.name }}
        </RouterLink>
      </div>
    </div>

    <div class="mt-6">
      <OfficialSheetPanel :match-id="data.match.id" :match="data.match" :highlight-team-id="data.managedTeamId" />
    </div>

    <!-- El equipo arbitral y las notas de los dos equipos son públicos; se puntúa desde la vista del cuerpo técnico. -->
    <div v-if="data.match.status === 'Played'" class="mt-6">
      <MatchOfficialsPanel :match-id="data.match.id" />
    </div>

    <!-- El vídeo se sube desde el acta interna del equipo y solo existe cuando ya se ha jugado. -->
    <div v-if="data.match.status === 'Played'" class="mt-6">
      <MatchVideos :match-id="data.match.id" :requestable="requestableSquads" @request="openRequest($event, true)" />
    </div>

    <Alert v-if="data.sheets.length === 0" kind="info" class="mt-6 leading-relaxed">
      Ninguno de los dos equipos tiene todavía plantilla en Tercer Tiempo, así que no hay actas internas que mostrar. El acta pública de la federación sí se puede consultar.
    </Alert>

    <Alert v-if="requested" kind="success" class="mt-6">
      Solicitud enviada. Cuando el club la apruebe tendrás el código en <RouterLink to="/mis-pases" class="font-medium underline">Mis pases</RouterLink>.
    </Alert>

    <section v-for="sheet in data.sheets" :key="sheet.squadId" class="card mt-6">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="min-w-0 font-semibold text-slate-900">
          Acta interna de <TeamName :name="sheet.teamName" :team-id="sheet.teamId" size="sm" />
          <Badge v-if="!sheet.insider && sheet.access?.sheetPass" tone="green" class="ml-2"><Icon icon="ticket" class="mr-1 h-3 w-3" />Con tu pase</Badge>
          <Badge v-else :tone="sheet.visibility === 'Public' ? 'green' : 'slate'" class="ml-2">{{ visibilityLabels[sheet.visibility] }}</Badge>
        </h2>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <RouterLink v-if="sheet.visible && sheet.insider" :to="{ name: 'squad', params: { squadId: sheet.squadId } }" class="text-accent-400 hover:underline">Ver plantilla</RouterLink>
          <RouterLink
            v-if="data.managedSquadId === sheet.squadId && data.match.status === 'Played'"
            :to="{ name: 'sheet', params: { squadId: sheet.squadId, matchId: data.match.id }, query: { tab: 'interna' } }"
            class="font-medium text-accent-400 hover:underline"
          >
            Editar acta
          </RouterLink>
          <RouterLink
            v-if="sheet.visible && sheet.insider"
            :to="{ name: 'sheet', params: { squadId: sheet.squadId, matchId: data.match.id }, query: { tab: 'comparador' } }"
            class="text-accent-400 hover:underline"
          >
            Comparar con el acta pública
          </RouterLink>
        </div>
      </div>

      <p v-if="!sheet.visible && sheet.insider" class="text-sm text-slate-500">
        El equipo no tiene la licencia vigente: su acta interna no está disponible hasta que el club la renueve.
      </p>
      <div v-else-if="!sheet.visible && sheet.access" class="space-y-2 text-sm text-slate-600">
        <p v-if="sheet.access.sheetPass">
          Tienes un pase de esta acta, pero el equipo no tiene la licencia vigente: volverás a verla cuando el club la renueve.
        </p>
        <template v-else-if="sheet.access.readyPassCode">
          <p>
            El club ha aprobado tu solicitud. Canjea tu pase
            (<strong class="text-slate-900">{{ passPrice(sheet.access.readyPassPriceCents ?? 0, sheet.access.currency) }}</strong>) para verlo aquí.
          </p>
          <RouterLink :to="{ name: 'pass', params: { code: sheet.access.readyPassCode } }" class="btn-primary btn-sm">
            <Icon icon="ticket" class="mr-1.5 h-3 w-3" />Canjear el pase
          </RouterLink>
        </template>
        <p v-else-if="sheet.access.requestStatus === 'Pending'">
          <Icon icon="hourglass-half" class="mr-1 h-3.5 w-3.5 text-warning" />Tu solicitud está pendiente: el club todavía no la ha decidido.
          <RouterLink to="/mis-pases" class="font-medium text-accent-400 hover:underline">Ver mis pases</RouterLink>
        </p>
        <template v-else-if="sheet.access.canRequest">
          <p>
            <Icon icon="lock" class="mr-1 h-3.5 w-3.5 text-slate-400" />Acta interna privada. El club da acceso a este partido:
            acta interna <strong class="text-slate-900">{{ passPrice(sheet.access.sheetPriceCents, sheet.access.currency) }}</strong>
            <template v-if="sheet.access.hasVideo"> · vídeo <strong class="text-slate-900">{{ passPrice(sheet.access.videoPriceCents, sheet.access.currency) }}</strong></template>.
          </p>
          <p v-if="sheet.access.requestStatus === 'Rejected'" class="text-xs text-slate-500">El club rechazó tu última solicitud; puedes volver a pedirlo.</p>
          <button v-if="signedIn" type="button" class="btn-primary btn-sm" @click="openRequest(sheet.squadId)">
            <Icon icon="ticket" class="mr-1.5 h-3 w-3" />Solicitar acceso
          </button>
          <p v-else><RouterLink to="/login" class="font-medium text-accent-400 hover:underline">Entra con tu cuenta</RouterLink> para solicitarlo.</p>
        </template>
        <p v-else>Acta privada: solo su club, su cuerpo técnico y sus jugadores vinculados pueden verla.</p>
        <p v-if="signedIn && !sheet.access.sheetPass" class="text-xs text-slate-500">
          ¿El club te ha dado un código? <RouterLink :to="{ name: 'pass' }" class="font-medium text-accent-400 hover:underline">Canjéalo aquí</RouterLink>.
        </p>
      </div>
      <p v-else-if="!sheet.visible" class="text-sm text-slate-500">
        Acta privada: solo su club, su cuerpo técnico y sus jugadores vinculados pueden verla.
      </p>
      <p v-else-if="sheet.entries.length === 0" class="text-sm text-slate-500">El cuerpo técnico todavía no ha registrado el acta de este partido.</p>

      <div v-else class="overflow-x-auto">
        <table class="table-sticky min-w-full text-sm">
          <thead class="text-xs text-slate-500">
            <tr>
              <SortHeader class="py-2 pl-2 pr-3 text-left" label="Jugador" v-bind="state('player')" @sort="sortBy('player')" />
              <SortHeader class="px-2 py-2 text-center" label="Min" title="Minutos" v-bind="state('minutes')" @sort="sortBy('minutes')" />
              <SortHeader class="px-2 py-2 text-center" label="G" title="Goles" v-bind="state('goals')" @sort="sortBy('goals')" />
              <SortHeader class="col-sm px-2 py-2 text-center" label="A" title="Asistencias" v-bind="state('assists')" @sort="sortBy('assists')" />
              <SortHeader class="col-sm px-2 py-2 text-center" label="Tiros" title="Tiros a puerta / tiros" v-bind="state('shots')" @sort="sortBy('shots')" />
              <SortHeader class="col-md px-2 py-2 text-center" label="Ent" title="Entradas" v-bind="state('tackles')" @sort="sortBy('tackles')" />
              <SortHeader class="col-md px-2 py-2 text-center" label="Int" title="Intercepciones" v-bind="state('interceptions')" @sort="sortBy('interceptions')" />
              <SortHeader class="col-md px-2 py-2 text-center" label="Par" title="Paradas" v-bind="state('saves')" @sort="sortBy('saves')" />
              <SortHeader class="px-2 py-2 text-center" label="TA/TR" title="Tarjetas (la roja pesa más)" v-bind="state('cards')" @sort="sortBy('cards')" />
              <SortHeader class="px-2 py-2 text-center" label="Nota" v-bind="state('rating')" @sort="sortBy('rating')" />
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in entriesOf(sheet)" :key="p.id" :class="p.squadPlayerId === auth.playerSquad?.squadPlayerId ? 'bg-brand-500/10' : p.started ? '' : 'bg-slate-500/[0.06]'">
              <td class="py-2 pl-2 pr-3 lg:whitespace-nowrap" :class="p.started ? 'shadow-[inset_3px_0_0_var(--color-emerald-500)]' : ''">
                <PlayerName :name="p.playerName" :photo-url="p.playerPhotoUrl" class="font-medium text-slate-800" />
                <span v-if="p.position" class="ml-1 text-xs text-slate-400">{{ positionShortLabels[p.position] }}</span>
                <StarterMark :started="p.started" class="ml-1.5" />
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

    <RequestAccessModal
      v-if="requesting?.sheet.access"
      :open="requesting !== null"
      :squad-id="requesting.sheet.squadId"
      :match-id="data.match.id"
      :team-name="requesting.sheet.teamName"
      :access="requesting.sheet.access"
      :prefer-video="requesting.video"
      @close="requesting = null"
      @requested="onRequested"
    />
  </template>
</template>
