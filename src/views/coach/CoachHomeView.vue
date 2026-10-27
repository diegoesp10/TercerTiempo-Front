<script setup lang="ts">
import { computed } from 'vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Spinner from '@/components/ui/Spinner.vue';
import SquadAccessCard from '@/components/squads/SquadAccessCard.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { appointmentStatusLabels, appointmentStatusTone, formatDate, staffRoleLabels, visibilityLabels } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';
import DashboardSearch from '@/components/search/DashboardSearch.vue';
import RefereesDashboardCard from '@/components/referees/RefereesDashboardCard.vue';

const auth = useAuthStore();

// La cuenta trae las plantillas vigentes y todos los nombramientos; se refresca al entrar.
const { loading, error } = useAsync(() => auth.refreshAccount());

const squads = computed(() => auth.coachSquads);
const appointments = computed(() => auth.coach?.appointments ?? []);
const pastAppointments = computed(() => appointments.value.filter((a) => a.status !== 'Active'));
</script>

<template>
  <PageHeader :title="`Hola, ${auth.displayName}`" subtitle="Plantillas en las que formas parte del cuerpo técnico esta temporada.">
    <template #actions>
      <RouterLink to="/codigo-acceso" :class="squads.length > 0 ? 'btn-secondary' : 'btn-primary'">Canjear un código de acceso</RouterLink>
    </template>
  </PageHeader>

  <DashboardSearch class="mb-6" />

  <Spinner v-if="loading && squads.length === 0" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else>
    <div v-if="squads.length === 0" class="card">
      <h2 class="font-semibold text-slate-900">No tienes ningún nombramiento vigente</h2>
      <p class="mt-3 text-sm text-slate-600">
        Tu club te nombra para un equipo y una temporada y te entrega un <strong>código de acceso</strong>. Al
        <RouterLink to="/codigo-acceso" class="font-medium text-accent-400 hover:underline">canjearlo</RouterLink>
        entras en el cuerpo técnico de la plantilla y puedes registrar sus actas hasta que el nombramiento caduque.
      </p>
    </div>

    <!-- Lo primero al entrar: la plantilla, que es donde trabaja el cuerpo técnico -->
    <div v-else class="grid gap-4" :class="squads.length > 1 ? 'lg:grid-cols-2' : ''">
      <SquadAccessCard
        v-for="squad in squads"
        :key="squad.id"
        :squad-id="squad.id"
        :team-name="squad.teamName"
        :team-short-name="squad.teamShortName"
        :crest-url="squad.teamCrestUrl"
        :subtitle="`${squad.competitionName} · ${squad.seasonLabel}`"
      >
        <template #badges>
          <Badge v-if="squad.myRole" tone="blue">{{ staffRoleLabels[squad.myRole] }}</Badge>
          <Badge :tone="squad.visibility === 'Public' ? 'green' : 'slate'">{{ visibilityLabels[squad.visibility] }}</Badge>
          <span class="text-xs text-slate-500">{{ squad.playersCount }} jugadores · {{ squad.staffCount }} en el staff</span>
        </template>
      </SquadAccessCard>
    </div>

    <RefereesDashboardCard v-if="squads.length > 0" class="mt-6" />

    <section v-if="appointments.length > 0" class="card mt-6">
      <h2 class="font-semibold text-slate-900">Mis nombramientos</h2>
      <ul class="mt-3 divide-y divide-slate-100 text-sm">
        <li v-for="appointment in appointments" :key="appointment.id" class="flex flex-wrap items-center justify-between gap-2 py-2">
          <div>
            <p class="font-medium text-slate-800"><TeamName :name="appointment.teamName" :team-id="appointment.teamId" /> <span class="text-slate-400">· {{ appointment.clubName }}</span></p>
            <p class="text-xs text-slate-500">
              {{ appointment.competitionName }} · {{ appointment.seasonLabel }} · {{ staffRoleLabels[appointment.role] }} ·
              {{ formatDate(appointment.validFrom) }} → {{ formatDate(appointment.validUntil) }}
            </p>
          </div>
          <Badge :tone="appointmentStatusTone(appointment.status)">{{ appointmentStatusLabels[appointment.status] }}</Badge>
        </li>
      </ul>
      <p v-if="pastAppointments.length > 0" class="mt-3 text-xs text-slate-500">
        Los nombramientos caducados o revocados dejan de dar acceso a la plantilla; las actas que registraste se conservan.
      </p>
    </section>
  </template>
</template>
