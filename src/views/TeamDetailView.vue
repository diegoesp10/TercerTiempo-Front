<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import MatchRow from '@/components/matches/MatchRow.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { formatKickoff, levelLabels, positionLabels, visibilityLabels } from '@/utils/format';

const props = defineProps<{ teamId: string }>();

const auth = useAuthStore();
const router = useRouter();

const { data, loading, error } = useAsync(() => api.teams.get(props.teamId));
const matches = useAsync(() => api.teams.matches(props.teamId));

const played = computed(() => (matches.data.value ?? []).filter((m) => m.status === 'Played').reverse());
const upcoming = computed(() => (matches.data.value ?? []).filter((m) => m.status !== 'Played'));

/** Próximo partido por fecha (no por jornada: un aplazado de una jornada anterior puede jugarse más tarde). */
const nextMatch = computed(() => {
  const now = Date.now() - 2 * 60 * 60 * 1000;
  return (
    upcoming.value
      .filter((m) => m.status === 'Scheduled' || m.status === 'InProgress')
      .filter((m) => new Date(m.kickoffAt).getTime() >= now)
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())[0] ?? null
  );
});
const nextOpponent = computed(() => {
  const m = nextMatch.value;
  if (!m) return null;
  return m.homeTeam.id === props.teamId ? { prefix: 'vs', team: m.awayTeam } : { prefix: '@', team: m.homeTeam };
});

const claiming = ref(false);
const claimError = ref<string | null>(null);

async function claim() {
  claiming.value = true;
  claimError.value = null;
  try {
    const squad = await api.squads.claim(props.teamId);
    await auth.refreshAccount();
    await router.push({ name: 'squad', params: { squadId: squad.summary.id } });
  } catch (e) {
    claimError.value = errorMessage(e);
  } finally {
    claiming.value = false;
  }
}
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <RouterLink :to="{ name: 'teams', query: { competition: data.season.competitionId } }" class="text-sm text-slate-500 hover:text-slate-800">
      ← {{ data.season.competitionName }}
    </RouterLink>

    <PageHeader :title="data.name" :subtitle="`${levelLabels[data.season.level]} · ${data.season.competitionName} · ${data.season.label}`" class="mt-2">
      <template #actions>
        <img v-if="data.crestUrl" :src="data.crestUrl" :alt="data.name" class="h-12 w-12 object-contain" />
        <RouterLink v-if="data.squad?.canView" :to="{ name: 'squad', params: { squadId: data.squad.squadId } }" class="btn-primary">
          {{ data.squad.isMine ? 'Mi plantilla' : 'Ver plantilla' }}
        </RouterLink>
        <button v-else-if="auth.isCoach && !data.squad" type="button" class="btn-primary" :disabled="claiming" @click="claim">
          {{ claiming ? 'Creando…' : 'Crear plantilla' }}
        </button>
      </template>
    </PageHeader>

    <Alert v-if="claimError" kind="error" class="mb-4">{{ claimError }}</Alert>

    <div v-if="data.standing" class="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Posición</p><p class="text-xl font-semibold">{{ data.standing.position }}º</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Puntos</p><p class="text-xl font-semibold">{{ data.standing.points }}</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Jugados</p><p class="text-xl font-semibold">{{ data.standing.played }}</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">G-E-P</p><p class="text-xl font-semibold">{{ data.standing.won }}-{{ data.standing.drawn }}-{{ data.standing.lost }}</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Goles</p><p class="text-xl font-semibold">{{ data.standing.goalsFor }}:{{ data.standing.goalsAgainst }}</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Diferencia</p><p class="text-xl font-semibold">{{ data.standing.goalDifference > 0 ? '+' : '' }}{{ data.standing.goalDifference }}</p></div>
    </div>

    <!-- Plantilla en Tercer Tiempo -->
    <section class="card mb-6">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 class="font-semibold text-slate-900">Plantilla en Tercer Tiempo</h2>
          <p v-if="data.squad" class="mt-1 text-sm text-slate-600">
            <Badge :tone="data.squad.visibility === 'Public' ? 'green' : 'slate'" class="mr-1">{{ visibilityLabels[data.squad.visibility] }}</Badge>
            {{ data.squad.playersCount }} jugadores · {{ data.squad.staffCount }} en el cuerpo técnico
            <span v-if="data.squad.isMine" class="ml-1 font-medium text-emerald-700">· es tu plantilla</span>
          </p>
          <p v-else class="mt-1 text-sm text-slate-600">Este equipo todavía no tiene plantilla en Tercer Tiempo.</p>
        </div>
        <RouterLink v-if="data.squad?.canView" :to="{ name: 'squad-stats', params: { squadId: data.squad.squadId } }" class="btn-secondary">
          Estadísticas
        </RouterLink>
      </div>

      <div class="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
        <template v-if="data.squad && !data.squad.canView">
          Es <strong>privada</strong>: solo su cuerpo técnico y sus jugadores vinculados pueden ver las actas y las estadísticas.
          <template v-if="auth.isCoach">
            ¿Eres de su cuerpo técnico? <RouterLink to="/invitacion" class="font-medium text-emerald-700 hover:underline">Únete con el código de invitación</RouterLink>.
          </template>
          <template v-else-if="auth.isPlayer">
            ¿Juegas en este equipo? Pide el código a tu cuerpo técnico y
            <RouterLink to="/invitacion" class="font-medium text-emerald-700 hover:underline">vincúlate a tu ficha</RouterLink>.
          </template>
          <template v-else>
            <RouterLink to="/registro" class="font-medium text-emerald-700 hover:underline">Date de alta</RouterLink> si formas parte del equipo.
          </template>
        </template>

        <template v-else-if="!data.squad">
          <template v-if="auth.isCoach">
            Al crearla se importan las fichas publicadas por futbolasturiano.es (si las hay), podrás completarla a mano y
            obtendrás un código de invitación para el resto del staff y los jugadores. Nace privada.
          </template>
          <template v-else-if="auth.isPlayer">Pide a tu cuerpo técnico que la cree: después podrás vincularte a tu ficha con su código de invitación.</template>
          <template v-else>
            ¿Eres de su cuerpo técnico? <RouterLink to="/registro" class="font-medium text-emerald-700 hover:underline">Date de alta</RouterLink> y créala en un minuto.
          </template>
        </template>

        <template v-else>Las actas de sus partidos y las estadísticas de sus jugadores están disponibles en la plantilla.</template>
      </div>
    </section>

    <!-- Próximo partido -->
    <section v-if="nextMatch && nextOpponent" class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
      <div class="w-16 shrink-0 text-center">
        <p class="text-xs uppercase text-emerald-700">Jornada</p>
        <p class="text-2xl font-semibold text-emerald-900">{{ nextMatch.matchday }}</p>
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Próximo partido</p>
        <RouterLink :to="{ name: 'match', params: { matchId: nextMatch.id } }" class="block truncate text-lg font-semibold text-slate-900 hover:text-emerald-700">
          <span class="text-slate-400">{{ nextOpponent.prefix }}</span> {{ nextOpponent.team.name }}
        </RouterLink>
        <p class="text-sm text-slate-600">{{ formatKickoff(nextMatch.kickoffAt) }}<span v-if="nextMatch.venue"> · {{ nextMatch.venue }}</span></p>
      </div>
      <RouterLink :to="{ name: 'league', query: { competition: data.season.competitionId } }" class="btn-secondary">
        Ver la jornada completa
      </RouterLink>
    </section>

    <div class="grid gap-6 lg:grid-cols-5">
      <section class="lg:col-span-3">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Resultados</h2>
        <Spinner v-if="matches.loading.value" />
        <Alert v-else-if="matches.error.value" kind="error">{{ matches.error.value }}</Alert>
        <template v-else>
          <p v-if="played.length === 0" class="text-sm text-slate-500">Aún no se ha disputado ningún partido.</p>
          <div v-else class="space-y-2">
            <MatchRow v-for="match in played" :key="match.id" :match="match" :team-id="data.id" />
          </div>

          <h2 class="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-slate-500">Próximos partidos</h2>
          <p v-if="upcoming.length === 0" class="text-sm text-slate-500">No quedan partidos programados.</p>
          <div v-else class="space-y-2">
            <MatchRow v-for="match in upcoming" :key="match.id" :match="match" :team-id="data.id" />
          </div>
        </template>
      </section>

      <section class="card self-start lg:col-span-2">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold text-slate-900">Plantilla según futbolasturiano.es</h2>
          <span v-if="data.rosterPublished" class="text-xs text-slate-500">{{ data.roster.length }} jugadores</span>
        </div>

        <p v-if="!data.rosterPublished" class="text-sm text-slate-600">
          El proveedor no publica la plantilla de este equipo. El cuerpo técnico puede añadir las fichas a mano.
        </p>

        <table v-else class="min-w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="py-2 pr-3 text-left">#</th>
              <th class="py-2 pr-3 text-left">Jugador</th>
              <th class="py-2 text-left">Posición</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="entry in data.roster" :key="entry.id">
              <td class="py-2 pr-3 tabular-nums text-slate-500">{{ entry.shirtNumber ?? '—' }}</td>
              <td class="py-2 pr-3 font-medium text-slate-800">{{ entry.fullName }}</td>
              <td class="py-2 text-slate-600">{{ entry.position ? positionLabels[entry.position] : '—' }}</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  </template>
</template>
