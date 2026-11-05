<script setup lang="ts">
import { computed, ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import TeamName from '@/components/teams/TeamName.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useAlertsStore } from '@/stores/alerts';
import { useAuthStore } from '@/stores/auth';
import type { CallUpResponse, MyCallUpDto, MyTrainingDto } from '@/types/api';
import { opponentOf } from '@/utils/crests';
import { attendanceStatusLabels, attendanceStatusTone, callUpResponseLabels, callUpResponseTone, formatDayHeading, formatDurationMinutes, formatKickoff, formatTime } from '@/utils/format';

/**
 * Lado del jugador: las convocatorias que tiene que firmar y los próximos entrenamientos, para avisar si falta. Los
 * avisos de «no puedo» son solo de entrenamientos: la convocatoria la emite el cuerpo técnico y el jugador la firma.
 */
const auth = useAuthStore();
const alerts = useAlertsStore();
const squad = computed(() => auth.playerSquad);

const callUps = useAsync(() => (squad.value ? api.trainings.myCallUps() : Promise.resolve([] as MyCallUpDto[])), { redirectOnError: false });
const trainings = useAsync(() => (squad.value ? api.trainings.mine() : Promise.resolve([] as MyTrainingDto[])), { redirectOnError: false });

const open = computed(() => (callUps.data.value ?? []).filter((c) => !c.closed));
const past = computed(() => (callUps.data.value ?? []).filter((c) => c.closed));

const busy = ref<string | null>(null);
const actionError = ref<string | null>(null);
const absenceFor = ref<string | null>(null);
const absenceReason = ref('');

async function respond(callUp: MyCallUpDto, response: CallUpResponse) {
  busy.value = callUp.callUpId;
  actionError.value = null;
  try {
    await api.trainings.respondCallUp(callUp.callUpId, response);
    await callUps.run();
    void alerts.load();
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

async function absence(item: MyTrainingDto, willMiss: boolean) {
  busy.value = item.session.id;
  actionError.value = null;
  try {
    await api.trainings.reportAbsence(item.session.id, willMiss, willMiss ? absenceReason.value.trim() || null : null);
    absenceFor.value = null;
    absenceReason.value = '';
    await trainings.run();
    void alerts.load();
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

const fixture = (c: MyCallUpDto) => (squad.value ? opponentOf(c.match, squad.value.teamId) : c.match.awayTeam);
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <PageHeader title="Mis convocatorias" subtitle="Las convocatorias de tu equipo que tienes que contestar y los próximos entrenamientos." />

    <Alert v-if="!squad" kind="info">
      Todavía no estás vinculado a ninguna plantilla. <RouterLink to="/invitacion" class="font-medium underline">Vincúlate con el código de tu cuerpo técnico</RouterLink> y aquí verás tus convocatorias y entrenamientos.
    </Alert>

    <template v-else>
      <Alert v-if="actionError" kind="error" class="mb-4">{{ actionError }}</Alert>
      <Alert v-if="callUps.error.value" kind="error" class="mb-4">{{ callUps.error.value }}</Alert>

      <section class="mb-8">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Convocatorias</h2>
        <Spinner v-if="callUps.loading.value && !callUps.data.value" />
        <p v-else-if="open.length === 0" class="text-sm text-slate-500">No tienes convocatorias pendientes: cuando el cuerpo técnico publique la del próximo partido, te avisará la campanita.</p>
        <ul v-else class="space-y-3">
          <li v-for="c in open" :key="c.callUpId" class="card" :class="c.mine.called ? 'border-brand-500/50' : ''">
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-900">
                  {{ c.mine.called ? 'Vas convocado' : 'No vas convocado' }}
                  <Badge :tone="c.mine.called ? callUpResponseTone[c.mine.response] : c.mine.response === 'Acknowledged' ? 'slate' : 'amber'">
                    {{ c.mine.called ? callUpResponseLabels[c.mine.response] : c.mine.response === 'Acknowledged' ? 'Enterado' : 'Sin firmar' }}
                  </Badge>
                </p>
                <p class="text-sm text-slate-700">
                  J{{ c.match.matchday }} · <TeamName prefix="vs" :name="fixture(c).name" :crest-url="fixture(c).crestUrl" :short-name="fixture(c).shortName" :team-id="fixture(c).id" /> · {{ formatKickoff(c.match.kickoffAt) }}
                  <template v-if="c.match.venue"> · {{ c.match.venue }}</template>
                </p>
                <p v-if="c.mine.called && c.meetAt" class="text-sm text-slate-600">Cita: {{ formatKickoff(c.meetAt) }}<template v-if="c.meetPlace"> en {{ c.meetPlace }}</template>.</p>
                <p v-if="c.notes" class="mt-1 whitespace-pre-line text-sm text-slate-600">{{ c.notes }}</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <button v-if="c.mine.called && c.mine.response !== 'Confirmed'" type="button" class="btn-primary px-3 py-1.5 text-xs" v-busy="busy === c.callUpId" :disabled="busy !== null" @click="respond(c, 'Confirmed')"><Icon icon="check" class="mr-1.5 h-3 w-3" />Firmar la convocatoria</button>
                <button v-else-if="!c.mine.called && c.mine.response !== 'Acknowledged'" type="button" class="btn-secondary px-3 py-1.5 text-xs" v-busy="busy === c.callUpId" :disabled="busy !== null" @click="respond(c, 'Acknowledged')">Enterado</button>
                <RouterLink :to="{ name: 'squad-callup', params: { squadId: c.squadId, matchId: c.match.id } }" class="btn-ghost px-3 py-1.5 text-xs">Ver la convocatoria</RouterLink>
              </div>
            </div>
            <p v-if="c.mine.called" class="mt-2 text-xs text-slate-500">Si no vas a poder ir, díselo a tu cuerpo técnico: la convocatoria la cambian ellos.</p>
          </li>
        </ul>
        <details v-if="past.length > 0" class="mt-3">
          <summary class="cursor-pointer text-sm text-slate-500">Partidos ya jugados ({{ past.length }})</summary>
          <ul class="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
            <li v-for="c in past" :key="c.callUpId" class="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span>J{{ c.match.matchday }} · <TeamName prefix="vs" :name="fixture(c).name" :crest-url="fixture(c).crestUrl" :short-name="fixture(c).shortName" /> · {{ formatKickoff(c.match.kickoffAt) }}</span>
              <Badge :tone="c.mine.called ? callUpResponseTone[c.mine.response] : 'slate'">{{ c.mine.called ? `Convocado · ${callUpResponseLabels[c.mine.response]}` : 'No convocado' }}</Badge>
            </li>
          </ul>
        </details>
      </section>

      <section>
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Próximos entrenamientos</h2>
          <RouterLink :to="{ name: 'squad-trainings', params: { squadId: squad.squadId } }" class="text-sm text-accent-400 hover:underline">Ver el calendario</RouterLink>
        </div>
        <Alert v-if="trainings.error.value" kind="error" class="mb-3">{{ trainings.error.value }}</Alert>
        <Spinner v-if="trainings.loading.value && !trainings.data.value" />
        <p v-else-if="!trainings.data.value?.length" class="text-sm text-slate-500">El cuerpo técnico no ha preparado todavía ningún entrenamiento.</p>
        <ul v-else class="space-y-2">
          <li v-for="item in trainings.data.value" :key="item.session.id" class="card p-3 sm:p-3">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <div class="min-w-0">
                <RouterLink :to="{ name: 'squad-trainings', params: { squadId: item.squadId }, query: { sesion: item.session.id } }" class="font-medium text-slate-900 hover:text-accent-400">{{ item.session.title }}</RouterLink>
                <p class="text-xs text-slate-500">
                  {{ formatDayHeading(item.session.startsAt) }} · {{ formatTime(item.session.startsAt) }} · {{ formatDurationMinutes(item.session.durationMinutes) }}
                  <template v-if="item.session.location"> · {{ item.session.location }}</template>
                  · {{ item.session.itemsCount }} ejercicios
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Badge v-if="item.session.mine" :tone="attendanceStatusTone[item.session.mine.status]">{{ attendanceStatusLabels[item.session.mine.status] }}</Badge>
                <button v-if="item.session.mine?.status === 'WillMiss'" type="button" class="btn-secondary px-3 py-1 text-xs" v-busy="busy === item.session.id" :disabled="busy !== null" @click="absence(item, false)">Al final sí voy</button>
                <button v-else-if="absenceFor !== item.session.id" type="button" class="btn-secondary px-3 py-1 text-xs" :disabled="busy !== null" @click="absenceFor = item.session.id">No podré ir</button>
              </div>
            </div>
            <form v-if="absenceFor === item.session.id" class="mt-2 flex flex-wrap gap-2" @submit.prevent="absence(item, true)">
              <input v-model="absenceReason" type="text" maxlength="200" class="input min-w-0 flex-1 px-2 py-1 text-sm" placeholder="Motivo (opcional)" />
              <button type="submit" class="btn-primary px-3 py-1 text-xs" v-busy="busy === item.session.id" :disabled="busy !== null">Avisar al cuerpo técnico</button>
              <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="absenceFor = null">Cancelar</button>
            </form>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
