<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { membershipStatusLabels, positionLabels } from '@/utils/format';

const props = defineProps<{ teamId: string }>();

const auth = useAuthStore();
const { data, loading, error, run } = useAsync(() => api.teams.get(props.teamId));

const isMyTeam = computed(() => auth.membership?.teamId === props.teamId);
const canJoin = computed(() => auth.isAuthenticated && !auth.hasTeam);

const joining = ref<string | null>(null);
const joinError = ref<string | null>(null);

async function join(rosterEntryId: string | null) {
  joining.value = rosterEntryId ?? 'free';
  joinError.value = null;
  try {
    auth.setPlayer(await api.players.joinTeam({ teamId: props.teamId, rosterEntryId, shirtNumber: null }));
    await run();
  } catch (e) {
    joinError.value = errorMessage(e);
  } finally {
    joining.value = null;
  }
}

async function leave() {
  if (!confirm('¿Seguro que quieres abandonar la plantilla? Tus registros de rendimiento se conservan.')) return;
  joinError.value = null;
  try {
    auth.setPlayer(await api.players.leaveTeam());
    await run();
  } catch (e) {
    joinError.value = errorMessage(e);
  }
}
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <PageHeader :title="data.name" :subtitle="`${data.season.competitionName} · ${data.season.label}`">
      <template #actions>
        <RouterLink v-if="isMyTeam" to="/partidos" class="btn-primary">Ver partidos</RouterLink>
        <button v-if="isMyTeam" type="button" class="btn-secondary" @click="leave">Abandonar plantilla</button>
      </template>
    </PageHeader>

    <Alert v-if="joinError" kind="error" class="mb-4">{{ joinError }}</Alert>
    <Alert v-if="isMyTeam && auth.membership?.status === 'Pending'" kind="warning" class="mb-4">
      Tu pertenencia está <strong>pendiente de validar</strong>: no apareces en la plantilla del proveedor. Hasta que se valide no podrás registrar rendimiento.
    </Alert>

    <div v-if="data.standing" class="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Posición</p><p class="text-xl font-semibold">{{ data.standing.position }}º</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Puntos</p><p class="text-xl font-semibold">{{ data.standing.points }}</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Jugados</p><p class="text-xl font-semibold">{{ data.standing.played }}</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">G-E-P</p><p class="text-xl font-semibold">{{ data.standing.won }}-{{ data.standing.drawn }}-{{ data.standing.lost }}</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Goles</p><p class="text-xl font-semibold">{{ data.standing.goalsFor }}:{{ data.standing.goalsAgainst }}</p></div>
      <div class="card py-3 text-center"><p class="text-xs text-slate-500">Diferencia</p><p class="text-xl font-semibold">{{ data.standing.goalDifference > 0 ? '+' : '' }}{{ data.standing.goalDifference }}</p></div>
    </div>

    <div class="grid gap-6 lg:grid-cols-5">
      <section class="card lg:col-span-3">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-semibold text-slate-900">Plantilla (según el proveedor)</h2>
          <span class="text-xs text-slate-500">{{ data.roster.length }} jugadores</span>
        </div>

        <p v-if="data.roster.length === 0" class="text-sm text-slate-500">Todavía no hay plantilla sincronizada para este equipo.</p>

        <table v-else class="min-w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="py-2 pr-3 text-left">#</th>
              <th class="py-2 pr-3 text-left">Jugador</th>
              <th class="py-2 pr-3 text-left">Posición</th>
              <th class="py-2 text-right"></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="entry in data.roster" :key="entry.id">
              <td class="py-2 pr-3 tabular-nums text-slate-500">{{ entry.shirtNumber ?? '—' }}</td>
              <td class="py-2 pr-3 font-medium text-slate-800">{{ entry.fullName }}</td>
              <td class="py-2 pr-3 text-slate-600">{{ entry.position ? positionLabels[entry.position] : '—' }}</td>
              <td class="py-2 text-right">
                <Badge v-if="entry.claimed" tone="green">En la plataforma</Badge>
                <button
                  v-else-if="canJoin"
                  type="button"
                  class="btn-secondary px-3 py-1 text-xs"
                  :disabled="joining !== null"
                  @click="join(entry.id)"
                >
                  {{ joining === entry.id ? 'Uniéndote…' : 'Soy yo' }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="canJoin" class="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
          ¿No apareces en la lista?
          <button type="button" class="font-medium text-emerald-700 hover:underline" :disabled="joining !== null" @click="join(null)">
            Unirme igualmente (pendiente de validación)
          </button>
        </div>
        <p v-else-if="!auth.isAuthenticated" class="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-600">
          <RouterLink to="/registro" class="font-medium text-emerald-700 hover:underline">Date de alta</RouterLink> para reclamar tu ficha.
        </p>
      </section>

      <section class="card lg:col-span-2">
        <h2 class="mb-3 font-semibold text-slate-900">Jugadores en la plataforma</h2>
        <p v-if="data.registeredPlayers.length === 0" class="text-sm text-slate-500">Nadie de este equipo se ha registrado todavía.</p>
        <ul v-else class="divide-y divide-slate-100 text-sm">
          <li v-for="member in data.registeredPlayers" :key="member.playerId" class="flex items-center justify-between py-2">
            <div>
              <p class="font-medium text-slate-800">
                <span v-if="member.shirtNumber" class="mr-1 text-slate-400">{{ member.shirtNumber }}</span>{{ member.displayName }}
              </p>
              <p class="text-xs text-slate-500">{{ positionLabels[member.position] }}</p>
            </div>
            <Badge :tone="member.status === 'Active' ? 'green' : 'amber'">{{ membershipStatusLabels[member.status] }}</Badge>
          </li>
        </ul>
      </section>
    </div>
  </template>
</template>
