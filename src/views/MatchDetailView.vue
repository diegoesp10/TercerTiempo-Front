<script setup lang="ts">
import { api } from '@/api';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import RatingBadge from '@/components/ui/RatingBadge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { formatKickoff, matchStatusLabels, positionShortLabels, visibilityLabels } from '@/utils/format';

const props = defineProps<{ matchId: string }>();

const auth = useAuthStore();
const { data, loading, error } = useAsync(() => api.matches.get(props.matchId));
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <div class="card">
      <div class="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>Jornada {{ data.match.matchday }} · {{ formatKickoff(data.match.kickoffAt) }}<span v-if="data.match.venue"> · {{ data.match.venue }}</span></span>
        <Badge :tone="data.match.status === 'Played' ? 'slate' : 'blue'">{{ matchStatusLabels[data.match.status] }}</Badge>
      </div>
      <div class="mt-4 grid grid-cols-3 items-center text-center">
        <RouterLink :to="{ name: 'team', params: { teamId: data.match.homeTeam.id } }" class="text-lg font-semibold text-slate-900 hover:text-emerald-700">
          {{ data.match.homeTeam.name }}
        </RouterLink>
        <div class="text-3xl font-bold tabular-nums text-slate-900">
          <template v-if="data.match.status === 'Played'">{{ data.match.homeGoals }} - {{ data.match.awayGoals }}</template>
          <span v-else class="text-slate-300">vs</span>
        </div>
        <RouterLink :to="{ name: 'team', params: { teamId: data.match.awayTeam.id } }" class="text-lg font-semibold text-slate-900 hover:text-emerald-700">
          {{ data.match.awayTeam.name }}
        </RouterLink>
      </div>
    </div>

    <Alert v-if="data.sheets.length === 0" kind="info" class="mt-6">
      Ninguno de los dos equipos tiene todavía plantilla en Tercer Tiempo, así que no hay actas que mostrar.
    </Alert>

    <section v-for="sheet in data.sheets" :key="sheet.squadId" class="card mt-6">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="font-semibold text-slate-900">
          Acta de {{ sheet.teamName }}
          <Badge :tone="sheet.visibility === 'Public' ? 'green' : 'slate'" class="ml-2">{{ visibilityLabels[sheet.visibility] }}</Badge>
        </h2>
        <div class="flex gap-3 text-sm">
          <RouterLink v-if="sheet.visible" :to="{ name: 'squad', params: { squadId: sheet.squadId } }" class="text-emerald-700 hover:underline">Ver plantilla</RouterLink>
          <RouterLink
            v-if="auth.isStaffOf(sheet.squadId) && data.match.status === 'Played'"
            :to="{ name: 'sheet', params: { squadId: sheet.squadId, matchId: data.match.id } }"
            class="font-medium text-emerald-700 hover:underline"
          >
            Editar acta
          </RouterLink>
        </div>
      </div>

      <p v-if="!sheet.visible" class="text-sm text-slate-500">
        Acta privada: solo el cuerpo técnico y los jugadores vinculados a la plantilla pueden verla.
      </p>
      <p v-else-if="sheet.entries.length === 0" class="text-sm text-slate-500">El cuerpo técnico todavía no ha registrado el acta de este partido.</p>

      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="py-2 pr-3 text-left">Jugador</th>
              <th class="px-2 py-2 text-center">Min</th>
              <th class="px-2 py-2 text-center">G</th>
              <th class="px-2 py-2 text-center">A</th>
              <th class="px-2 py-2 text-center">Tiros</th>
              <th class="px-2 py-2 text-center">PC</th>
              <th class="px-2 py-2 text-center">Ent</th>
              <th class="px-2 py-2 text-center">Int</th>
              <th class="px-2 py-2 text-center">Par</th>
              <th class="px-2 py-2 text-center">TA/TR</th>
              <th class="px-2 py-2 text-center">Nota</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in sheet.entries" :key="p.id" :class="p.squadPlayerId === auth.playerSquad?.squadPlayerId ? 'bg-emerald-50' : ''">
              <td class="py-2 pr-3 whitespace-nowrap">
                <span v-if="p.shirtNumber" class="mr-1 text-slate-400">{{ p.shirtNumber }}</span>
                <span class="font-medium text-slate-800">{{ p.playerName }}</span>
                <span class="ml-1 text-xs text-slate-400">
                  <template v-if="p.position">{{ positionShortLabels[p.position] }}</template>
                  <template v-if="p.started"> · titular</template>
                </span>
              </td>
              <td class="px-2 py-2 text-center tabular-nums">{{ p.minutesPlayed }}</td>
              <td class="px-2 py-2 text-center font-semibold tabular-nums">{{ p.goals }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ p.assists }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ p.shotsOnTarget }}/{{ p.shots }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ p.keyPasses }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ p.tackles }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ p.interceptions }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ p.saves }}</td>
              <td class="px-2 py-2 text-center tabular-nums">{{ p.yellowCards }}/{{ p.redCard ? 1 : 0 }}</td>
              <td class="px-2 py-2 text-center"><RatingBadge :rating="p.rating" size="sm" /></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
