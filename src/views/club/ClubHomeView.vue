<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import LicensePanel from '@/components/licensing/LicensePanel.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import Spinner from '@/components/ui/Spinner.vue';
import SquadAccessCard from '@/components/squads/SquadAccessCard.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import type { AppointmentDto, ClubDto, ClubFilialDto, StaffRole } from '@/types/api';
import { appointmentStatusLabels, appointmentStatusTone, formatDate, formatKickoff, licenseStatusLabels, licenseStatusTone, staffRoleLabels, staffRoleOptions } from '@/utils/format';
import { confirmDialog } from '@/composables/useConfirm';
import TeamName from '@/components/teams/TeamName.vue';

const auth = useAuthStore();

const { data, loading, error, run } = useAsync(() => api.clubs.me());
const club = computed<ClubDto | null>(() => data.value);

const busy = ref(false);
const actionError = ref<string | null>(null);
const notice = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

async function act(fn: () => Promise<string | void>) {
  busy.value = true;
  actionError.value = null;
  notice.value = null;
  fieldErrors.value = {};
  try {
    notice.value = (await fn()) || null;
  } catch (e) {
    actionError.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    busy.value = false;
  }
}

// --- Equipos del club ---
// La licencia es del club y cubre el primer equipo y sus filiales: no se vinculan equipos de otros clubes. Si el
// proveedor publica un filial nuevo del club, aparece aquí para añadirlo.
function addFilial(filial: ClubFilialDto) {
  void act(async () => {
    data.value = await api.clubs.addTeam(filial.teamId);
    await auth.refreshAccount();
    return `${filial.teamName} ya está cubierto por la licencia del club.`;
  });
}

async function removeTeam(teamId: string, teamName: string) {
  const ok = await confirmDialog({
    title: `Quitar ${teamName}`,
    message: 'Dejará de estar cubierto por la licencia del club y de aparecer en tu club. Los nombramientos ya emitidos no cambian.',
    confirmLabel: 'Quitar',
    danger: true,
  });
  if (!ok) return;
  void act(async () => {
    data.value = await api.clubs.removeTeam(teamId);
    await auth.refreshAccount();
  });
}

// --- Nombramientos ---
const appointmentForm = reactive<{ teamId: string; coachName: string; email: string; role: StaffRole; validUntil: string }>({
  teamId: '',
  coachName: '',
  email: '',
  role: 'HeadCoach',
  validUntil: '',
});

const selectedTeam = computed(() => club.value?.teams.find((t) => t.teamId === appointmentForm.teamId) ?? null);
const lastCreated = shallowRef<AppointmentDto | null>(null);

function createAppointment() {
  void act(async () => {
    lastCreated.value = await api.clubs.createAppointment({
      teamId: appointmentForm.teamId,
      coachName: appointmentForm.coachName.trim(),
      email: appointmentForm.email.trim() || null,
      role: appointmentForm.role,
      validUntil: appointmentForm.validUntil || null,
    });
    appointmentForm.coachName = '';
    appointmentForm.email = '';
    appointmentForm.validUntil = '';
    await run();
  });
}

const editingId = ref<string | null>(null);
const editValidUntil = ref('');

function startEdit(appointment: AppointmentDto) {
  editingId.value = appointment.id;
  editValidUntil.value = appointment.validUntil;
}

function saveValidity(appointment: AppointmentDto) {
  void act(async () => {
    await api.clubs.updateAppointment(appointment.id, editValidUntil.value);
    editingId.value = null;
    await run();
    return `Nombramiento de ${appointment.coachName} válido hasta ${formatDate(editValidUntil.value)}.`;
  });
}

async function revoke(appointment: AppointmentDto) {
  if (!(await confirmDialog({ title: `Revocar el nombramiento de ${appointment.coachName}`, message: 'Si ya lo canjeó, saldrá del cuerpo técnico de la plantilla.', confirmLabel: 'Revocar', danger: true }))) return;
  void act(async () => {
    await api.clubs.revokeAppointment(appointment.id);
    if (lastCreated.value?.id === appointment.id) lastCreated.value = null;
    await run();
    return 'Nombramiento revocado.';
  });
}

const copied = ref<string | null>(null);
async function copyCode(appointment: AppointmentDto) {
  if (!appointment.accessCode) return;
  try {
    await navigator.clipboard.writeText(appointment.accessCode);
    copied.value = appointment.id;
    setTimeout(() => (copied.value = null), 2000);
  } catch {
    /* portapapeles no disponible: el código queda visible */
  }
}

const sortedAppointments = computed(() => {
  const order: Record<string, number> = { Pending: 0, Active: 1, Expired: 2, Revoked: 3 };
  return [...(club.value?.appointments ?? [])].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || b.createdAt.localeCompare(a.createdAt));
});
</script>

<template>
  <PageHeader :title="club?.name ?? auth.displayName" subtitle="Equipos del club y nombramientos de sus técnicos por temporada.">
    <template #actions>
      <RouterLink to="/ajustes" title="Cambiar el escudo en Ajustes" class="inline-flex size-14 shrink-0 items-center justify-center rounded-full leading-none ring-offset-2 ring-offset-canvas transition-shadow hover:ring-2 hover:ring-brand-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
        <TeamCrest :src="auth.clubCrestUrl" :name="club?.name ?? auth.displayName" size="lg" />
      </RouterLink>
    </template>
  </PageHeader>

  <Spinner v-if="loading && !club" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="club">
    <Alert v-if="actionError" kind="error" class="mb-4">{{ actionError }}</Alert>
    <Alert v-if="notice" kind="success" class="mb-4">{{ notice }}</Alert>

    <!-- Lo primero al entrar: la plantilla de cada equipo, que es donde se trabaja -->
    <div v-if="club.teams.length > 0" class="mb-6 grid gap-4" :class="club.teams.length > 1 ? 'lg:grid-cols-2' : ''">
      <template v-for="team in club.teams" :key="`access-${team.teamId}`">
        <SquadAccessCard
          v-if="team.squadId"
          :squad-id="team.squadId"
          :team-name="team.teamName"
          :team-short-name="team.teamShortName"
          :crest-url="team.teamCrestUrl"
          :subtitle="team.competitionName ? `${team.competitionName} · ${team.seasonLabel}` : null"
        >
          <template #badges>
            <Badge :tone="licenseStatusTone[team.license]">Licencia {{ licenseStatusLabels[team.license].toLowerCase() }}</Badge>
            <Badge :tone="team.activeAppointments > 0 ? 'green' : 'amber'">{{ team.activeAppointments }} {{ team.activeAppointments === 1 ? 'técnico vigente' : 'técnicos vigentes' }}</Badge>
          </template>
        </SquadAccessCard>
        <article v-else class="card flex items-center gap-4">
          <TeamCrest :src="team.teamCrestUrl" :name="team.teamName" :short-name="team.teamShortName" size="lg" />
          <div class="min-w-0 flex-1">
            <p class="eyebrow">Gestión de plantilla</p>
            <h2 class="truncate text-lg font-semibold text-slate-900">{{ team.teamName }}</h2>
            <p class="text-sm text-slate-500">Todavía no tiene plantilla: se crea cuando un técnico canjea su nombramiento. Nómbralo más abajo.</p>
          </div>
        </article>
      </template>
    </div>

    <!-- Filiales del club publicados después del alta -->
    <section v-if="club.availableFilials.length" class="card mb-6">
      <h2 class="font-semibold text-slate-900">Filiales sin añadir</h2>
      <p class="mt-1 text-sm text-slate-500">
        Equipos de tu club que el proveedor ha publicado después de tu alta. Al añadirlos quedan cubiertos por la misma licencia, sin coste extra, con su propio cupo de técnicos.
      </p>
      <ul class="mt-3 divide-y divide-slate-100">
        <li v-for="filial in club.availableFilials" :key="filial.teamId" class="flex flex-wrap items-center gap-3 py-3">
          <TeamCrest :src="filial.teamCrestUrl" :name="filial.teamName" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-slate-900">{{ filial.teamName }}</p>
            <p v-if="filial.competitionName" class="text-xs text-slate-500">{{ filial.competitionName }}</p>
          </div>
          <button type="button" class="btn-primary px-3 py-1.5 text-xs" v-busy="busy" :disabled="busy" @click="addFilial(filial)">
            <Icon icon="plus" class="h-3 w-3" />Añadir a la licencia
          </button>
        </li>
      </ul>
    </section>

    <!-- Equipos -->
    <section class="card mb-6">
      <h2 class="font-semibold text-slate-900">Equipos del club</h2>
      <p class="mt-1 text-xs text-slate-500">El primer equipo y sus filiales, todos con la misma licencia del club. Cada equipo tiene su propio cupo de técnicos según el plan.</p>
      <p v-if="club.teams.length === 0" class="mt-2 text-sm text-slate-500">
        Ningún equipo del proveedor se reconoció con el nombre del club.
      </p>
      <ul v-else class="mt-3 divide-y divide-slate-100">
        <li v-for="team in club.teams" :key="team.teamId" class="flex flex-wrap items-center gap-3 py-3">
          <TeamCrest :src="team.teamCrestUrl" :name="team.teamName" :short-name="team.teamShortName" />
          <div class="min-w-0 flex-1">
            <RouterLink :to="{ name: 'team', params: { teamId: team.teamId } }" class="font-medium text-slate-900 hover:text-accent-400">{{ team.teamName }}</RouterLink>
            <p class="text-xs text-slate-500">
              <template v-if="team.competitionName">{{ team.competitionName }} · {{ team.seasonLabel }}<template v-if="team.seasonEndsOn"> · temporada hasta {{ formatDate(team.seasonEndsOn) }}</template></template>
              <template v-else>Sin temporada en curso en el proveedor</template>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <Badge :tone="licenseStatusTone[team.license]" :title="`Licencia ${licenseStatusLabels[team.license].toLowerCase()} · hasta el ${formatDate(team.licenseValidUntil)}`">Licencia {{ licenseStatusLabels[team.license].toLowerCase() }}</Badge>
            <Badge :tone="team.activeAppointments > 0 ? 'green' : 'amber'">{{ team.activeAppointments }} {{ team.activeAppointments === 1 ? 'técnico vigente' : 'técnicos vigentes' }}</Badge>
            <button
              v-if="club.teams.length > 1"
              type="button"
              class="btn-ghost px-2 py-1 text-xs text-red-600 hover:bg-red-50"
              v-busy="busy"
              :disabled="busy"
              @click="removeTeam(team.teamId, team.teamName)"
            >Quitar</button>
          </div>
        </li>
      </ul>
    </section>

    <LicensePanel class="mb-6" />

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Nuevo nombramiento -->
      <section class="card self-start">
        <h2 class="font-semibold text-slate-900">Nombrar a un técnico</h2>
        <p class="mt-1 text-xs text-slate-500">
          Obtendrás un código de acceso para entregarle. Al canjearlo entra en el cuerpo técnico de la plantilla del equipo
          (se crea si no existe) hasta la fecha de validez, nunca más allá de la temporada.
        </p>
        <form class="mt-4 space-y-3" @submit.prevent="createAppointment">
          <div>
            <label class="label" for="ap-team">Equipo</label>
            <SearchSelect
              id="ap-team"
              :model-value="appointmentForm.teamId || null"
              placeholder="— Elige un equipo —"
              :options="club.teams.map((t) => ({ value: t.teamId, label: t.teamName, hint: t.competitionName ?? undefined, disabled: !t.seasonId, crest: t.teamCrestUrl ?? `/api/teams/${t.teamId}/crest` }))"
              @update:model-value="appointmentForm.teamId = String($event ?? '')"
            />
            <p v-if="fieldErrors.teamId" class="field-error">{{ fieldErrors.teamId[0] }}</p>
          </div>
          <div>
            <label class="label" for="ap-name">Nombre del técnico</label>
            <input id="ap-name" v-model="appointmentForm.coachName" type="text" required maxlength="100" class="input" />
            <p v-if="fieldErrors.coachName" class="field-error">{{ fieldErrors.coachName[0] }}</p>
          </div>
          <div>
            <label class="label" for="ap-email">Email (opcional)</label>
            <input id="ap-email" v-model="appointmentForm.email" type="email" class="input" />
            <p v-if="fieldErrors.email" class="field-error">{{ fieldErrors.email[0] }}</p>
          </div>
          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label class="label" for="ap-role">Rol</label>
              <SearchSelect
                id="ap-role"
                :model-value="appointmentForm.role"
                :options="staffRoleOptions"
                @update:model-value="appointmentForm.role = ($event as StaffRole | null) ?? 'HeadCoach'"
              />
            </div>
            <div>
              <label class="label" for="ap-until">Válido hasta</label>
              <input id="ap-until" v-model="appointmentForm.validUntil" type="date" class="input" :max="selectedTeam?.seasonEndsOn ?? undefined" />
              <p class="mt-1 text-xs text-slate-400">Vacío = fin de temporada<template v-if="selectedTeam?.seasonEndsOn"> ({{ formatDate(selectedTeam.seasonEndsOn) }})</template>.</p>
            </div>
          </div>
          <button type="submit" class="btn-primary w-full" v-busy="busy" :disabled="busy || !appointmentForm.teamId || !appointmentForm.coachName.trim()">
            {{ busy ? 'Creando…' : 'Crear nombramiento y código' }}
          </button>
        </form>

        <div v-if="lastCreated?.accessCode" class="mt-4 rounded-xl border border-accent-400/40 bg-brand-500/10 p-4">
          <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Código de acceso para {{ lastCreated.coachName }}</p>
          <p class="mt-1 font-mono text-2xl font-semibold tracking-[0.3em] text-slate-900">{{ lastCreated.accessCode }}</p>
          <p class="mt-1 text-xs text-slate-600">
            <TeamName :name="lastCreated.teamName" :team-id="lastCreated.teamId" /> · {{ lastCreated.seasonLabel }} · hasta {{ formatDate(lastCreated.validUntil) }}. Con él se da de alta en
            <RouterLink :to="{ name: 'register', query: { code: lastCreated.accessCode } }" class="font-medium underline">Darme de alta</RouterLink>
            o, si ya tiene cuenta, lo canjea desde su panel.
          </p>
          <button type="button" class="btn-secondary mt-2 px-3 py-1 text-xs" @click="copyCode(lastCreated)">{{ copied === lastCreated.id ? 'Copiado ✓' : 'Copiar código' }}</button>
        </div>
      </section>

      <!-- Nombramientos -->
      <section class="card lg:col-span-2">
        <h2 class="font-semibold text-slate-900">Nombramientos</h2>
        <p v-if="sortedAppointments.length === 0" class="mt-2 text-sm text-slate-500">Todavía no has nombrado a ningún técnico.</p>
        <div v-else class="mt-3 overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="py-2 pr-3 text-left">Técnico</th>
                <th class="col-sm py-2 pr-3 text-left">Equipo</th>
                <th class="py-2 pr-3 text-left">Estado</th>
                <th class="col-md py-2 pr-3 text-left">Validez</th>
                <th class="py-2 text-right"></th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="appointment in sortedAppointments" :key="appointment.id" :class="appointment.status === 'Revoked' || appointment.status === 'Expired' ? 'text-slate-400' : ''">
                <td class="py-2 pr-3">
                  <p class="font-medium" :class="appointment.status === 'Active' || appointment.status === 'Pending' ? 'text-slate-800' : ''">{{ appointment.coachName }}</p>
                  <p class="text-xs text-slate-500">
                    {{ staffRoleLabels[appointment.role] }}<template v-if="appointment.coachDisplayName"> · cuenta: {{ appointment.coachDisplayName }}</template><template v-else-if="appointment.email"> · {{ appointment.email }}</template>
                  </p>
                </td>
                <td class="col-sm py-2 pr-3">
                  <p><TeamName :name="appointment.teamName" :team-id="appointment.teamId" /></p>
                  <p class="text-xs text-slate-500">{{ appointment.seasonLabel }}</p>
                </td>
                <td class="py-2 pr-3">
                  <Badge :tone="appointmentStatusTone(appointment.status)">{{ appointmentStatusLabels[appointment.status] }}</Badge>
                  <div v-if="appointment.accessCode" class="mt-1 flex items-center gap-2">
                    <span class="font-mono text-sm tracking-widest text-slate-800">{{ appointment.accessCode }}</span>
                    <button type="button" class="btn-ghost px-2 py-0.5 text-xs" @click="copyCode(appointment)">{{ copied === appointment.id ? '✓' : 'Copiar' }}</button>
                  </div>
                  <p v-else-if="appointment.redeemedAt" class="mt-1 text-xs text-slate-500">Canjeado el {{ formatKickoff(appointment.redeemedAt) }}</p>
                </td>
                <td class="col-md py-2 pr-3 whitespace-nowrap">
                  <template v-if="editingId === appointment.id">
                    <input v-model="editValidUntil" type="date" class="input w-40 px-2 py-1" aria-label="Válido hasta" />
                  </template>
                  <template v-else>{{ formatDate(appointment.validFrom) }} → {{ formatDate(appointment.validUntil) }}</template>
                </td>
                <td class="py-2 text-right whitespace-nowrap">
                  <template v-if="appointment.status === 'Revoked'"></template>
                  <template v-else-if="editingId === appointment.id">
                    <button type="button" class="btn-primary px-3 py-1 text-xs" v-busy="busy" :disabled="busy" @click="saveValidity(appointment)">Guardar</button>
                    <button type="button" class="btn-ghost ml-1 px-3 py-1 text-xs" @click="editingId = null">Cancelar</button>
                  </template>
                  <template v-else>
                    <button type="button" class="btn-ghost px-3 py-1 text-xs" v-busy="busy" :disabled="busy" @click="startEdit(appointment)">Validez</button>
                    <button type="button" class="btn-ghost px-3 py-1 text-xs text-red-600 hover:bg-red-50" v-busy="busy" :disabled="busy" @click="revoke(appointment)">Revocar</button>
                  </template>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </template>
</template>
