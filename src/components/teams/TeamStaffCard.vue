<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import { officialStaffLabel, staffRoleLabels } from '@/utils/format';
import type { TeamStaffDto, TeamStaffMemberDto } from '@/types/api';

// Cuerpo técnico en la ficha del equipo: el de las actas oficiales de la temporada, que es público. Quien aún no tiene
// perfil en la app sale con el nombre del acta y se dice. A las cuentas con sesión se suman el enlace al perfil y los
// nombrados por el club que aún no figuran en ningún acta. Lo interno (citaciones, convocatorias, entrenamientos) sigue
// siendo de la plantilla.
const props = defineProps<{ staff: TeamStaffDto | null | undefined; linked: boolean }>();

const members = computed(() => props.staff?.members ?? []);
const groups = computed(() => [
  { key: 'current', title: null, items: members.value.filter((m) => m.current) },
  { key: 'before', title: 'Antes en la temporada', items: members.value.filter((m) => !m.current) },
].filter((g) => g.items.length));
const sheets = computed(() => props.staff?.sheets ?? 0);
const nobodyInApp = computed(() => members.value.length > 0 && members.value.every((m) => !m.hasProfile));

function role(member: TeamStaffMemberDto) {
  if (member.officialRole) return officialStaffLabel(member.officialRole, member.officialRoleLabel);
  return member.role ? staffRoleLabels[member.role] : 'Cuerpo técnico';
}

const shortDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });

function detail(member: TeamStaffMemberDto) {
  if (!member.officialRole) return 'nombrado por el club en Tercer Tiempo';
  const actas = `${member.appearances} ${member.appearances === 1 ? 'acta' : 'actas'}`;
  if (member.current) return member.appearances === sheets.value ? `en todas las actas (${actas})` : `en ${member.appearances} de ${sheets.value} actas`;
  return member.lastSeen ? `${actas}, la última el ${shortDate(member.lastSeen)}` : actas;
}
</script>

<template>
  <section class="card">
    <div class="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <h2 class="font-semibold text-slate-900">Cuerpo técnico</h2>
      <span v-if="sheets" class="text-xs text-slate-500">según {{ sheets }} {{ sheets === 1 ? 'acta' : 'actas' }} de la federación</span>
    </div>

    <p v-if="!members.length" class="text-sm text-slate-600">
      Las actas de la federación de esta temporada todavía no traen el cuerpo técnico de este equipo.
    </p>

    <template v-else>
      <p v-if="nobodyInApp" class="mb-2 rounded-lg bg-surface-2 px-3 py-2 text-xs text-slate-600">
        Este cuerpo técnico aún no tiene perfil en Tercer Tiempo: los nombres son los de las actas oficiales.
      </p>

      <template v-for="group in groups" :key="group.key">
        <p v-if="group.title" class="eyebrow mb-1 mt-4">{{ group.title }}</p>
        <ul class="divide-y divide-slate-100">
          <li v-for="member in group.items" :key="member.name" class="flex items-center gap-2 py-2" :class="{ 'opacity-80': !member.current }">
            <PlayerAvatar :src="null" :name="member.name" size="sm" />
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                <RouterLink
                  v-if="linked && member.coachId"
                  :to="{ name: 'coach', params: { coachId: member.coachId } }"
                  class="font-medium text-slate-800 hover:text-brand-500 hover:underline"
                >{{ member.name }}</RouterLink>
                <span v-else class="font-medium text-slate-800">{{ member.name }}</span>
                <Badge v-if="!member.hasProfile && !nobodyInApp" tone="slate" title="Figura en las actas oficiales, pero todavía no tiene perfil en Tercer Tiempo">
                  Sin perfil en la app aún
                </Badge>
              </span>
              <span class="block text-xs text-slate-500">{{ role(member) }} · {{ detail(member) }}</span>
            </span>
          </li>
        </ul>
      </template>
    </template>

    <p class="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
      Las actas oficiales son públicas. Las citaciones, convocatorias y entrenamientos del cuerpo técnico son privados de la plantilla.
    </p>
  </section>
</template>
