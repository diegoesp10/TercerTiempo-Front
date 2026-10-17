<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api';
import PerformanceForm from '@/components/performance/PerformanceForm.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import type { PerformanceDto } from '@/types/api';
import { formatKickoff, matchStatusLabels, positionLabels } from '@/utils/format';

const props = defineProps<{ matchId: string }>();

const auth = useAuthStore();
const { data, loading, error, run } = useAsync(() => api.matches.get(props.matchId));

const myTeamInvolved = computed(() => {
  const teamId = auth.membership?.teamId;
  return !!teamId && !!data.value && (data.value.match.homeTeam.id === teamId || data.value.match.awayTeam.id === teamId);
});

const canLog = computed(() => auth.canLogPerformance && myTeamInvolved.value && data.value?.match.status === 'Played');

const squadPerformances = computed(() => {
  if (!data.value) return [];
  const teamId = auth.membership?.teamId;
  return teamId ? data.value.performances.filter((p) => p.teamId === teamId) : data.value.performances;
});

function onSaved(_performance: PerformanceDto) {
  void run();
}
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <RouterLink to="/partidos" class="text-sm text-slate-500 hover:text-slate-800">← Partidos</RouterLink>

    <div class="card mt-3">
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

    <section v-if="canLog" class="card mt-6">
      <h2 class="font-semibold text-slate-900">{{ data.myPerformance ? 'Tu rendimiento en este partido' : 'Registra tu rendimiento' }}</h2>
      <p class="mb-4 text-sm text-slate-500">Datos reales, sin trampas: son la base de tus estadísticas y de la comparativa con el equipo y la liga.</p>
      <PerformanceForm
        :key="data.myPerformance?.updatedAt ?? 'new'"
        :match-id="data.match.id"
        :initial="data.myPerformance"
        :position="auth.player?.position ?? 'Midfielder'"
        @saved="onSaved"
      />
    </section>

    <Alert v-else-if="auth.isAuthenticated && myTeamInvolved && data.match.status !== 'Played'" kind="info" class="mt-6">
      Podrás registrar tu rendimiento cuando el partido esté finalizado.
    </Alert>
    <Alert v-else-if="auth.isAuthenticated && myTeamInvolved && !auth.canLogPerformance" kind="warning" class="mt-6">
      Tu pertenencia a la plantilla está pendiente de validar: todavía no puedes registrar rendimiento.
    </Alert>

    <section class="card mt-6">
      <h2 class="mb-3 font-semibold text-slate-900">Rendimiento registrado{{ auth.membership ? ' por tu plantilla' : '' }}</h2>
      <p v-if="squadPerformances.length === 0" class="text-sm text-slate-500">Nadie ha registrado todavía su rendimiento en este partido.</p>
      <div v-else class="overflow-x-auto">
        <table class="min-w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th class="py-2 pr-3 text-left">Jugador</th>
              <th class="py-2 px-2 text-center">Min</th>
              <th class="py-2 px-2 text-center">G</th>
              <th class="py-2 px-2 text-center">A</th>
              <th class="py-2 px-2 text-center">Tiros</th>
              <th class="py-2 px-2 text-center">Entradas</th>
              <th class="py-2 px-2 text-center">Paradas</th>
              <th class="py-2 px-2 text-center">TA/TR</th>
              <th class="py-2 px-2 text-center">Nota</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="p in squadPerformances" :key="p.id" :class="p.playerId === auth.player?.id ? 'bg-emerald-50' : ''">
              <td class="py-2 pr-3">
                <p class="font-medium text-slate-800">{{ p.playerName }}</p>
                <p class="text-xs text-slate-500">{{ positionLabels[p.playerPosition] }}<span v-if="p.started"> · titular</span></p>
              </td>
              <td class="py-2 px-2 text-center tabular-nums">{{ p.minutesPlayed }}</td>
              <td class="py-2 px-2 text-center tabular-nums">{{ p.goals }}</td>
              <td class="py-2 px-2 text-center tabular-nums">{{ p.assists }}</td>
              <td class="py-2 px-2 text-center tabular-nums">{{ p.shotsOnTarget }}/{{ p.shots }}</td>
              <td class="py-2 px-2 text-center tabular-nums">{{ p.tackles }}</td>
              <td class="py-2 px-2 text-center tabular-nums">{{ p.saves }}</td>
              <td class="py-2 px-2 text-center tabular-nums">{{ p.yellowCards }}/{{ p.redCard ? 1 : 0 }}</td>
              <td class="py-2 px-2 text-center font-semibold tabular-nums">{{ p.selfRating }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </template>
</template>
