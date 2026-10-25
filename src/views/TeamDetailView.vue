<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import MatchRow from '@/components/matches/MatchRow.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import Skeleton from '@/components/ui/Skeleton.vue';
import Spinner from '@/components/ui/Spinner.vue';
import ClubRosterEditor from '@/components/teams/ClubRosterEditor.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import RosterStatsSummary from '@/components/teams/RosterStatsSummary.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { useAsync } from '@/composables/useAsync';
import { useAuthStore } from '@/stores/auth';
import { formatKickoff, levelLabels, positionLabels, visibilityLabels } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';

const props = defineProps<{ teamId: string }>();

const auth = useAuthStore();
const router = useRouter();

const { data, loading, error } = useAsync(() => api.teams.get(props.teamId));

// Enlaces de antes (?jugador=, del buscador o de una búsqueda reciente): llevan a la ficha del jugador.
const route = useRoute();
if (typeof route.query.jugador === 'string' && auth.isAuthenticated)
  void router.replace({ name: 'player-card', params: { teamId: props.teamId, entryId: route.query.jugador } });
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
  return m.homeTeam.id === props.teamId ? { home: true, team: m.awayTeam } : { home: false, team: m.homeTeam };
});

/** Ficha del club según la federación: campo (con enlace a cómo llegar), sede y equipación. */
const profile = computed(() => data.value?.profile ?? null);
const groundAddress = computed(() => [profile.value?.groundAddress, profile.value?.groundLocality].filter(Boolean).join(', '));
const mapsUrl = computed(() => {
  const query = [profile.value?.ground, profile.value?.groundAddress, profile.value?.groundLocality ?? profile.value?.locality].filter(Boolean).join(', ');
  return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
});
/** Sede sin repetir lo que la federación ya mete en el domicilio ("…, 33013 Oviedo"). */
const seatAddress = computed(() => {
  const address = profile.value?.address ?? '';
  const lower = address.toLowerCase();
  const parts = [address];
  const town = [profile.value?.postalCode, profile.value?.locality].filter((p) => p && !lower.includes(p.toLowerCase())).join(' ');
  if (town) parts.push(town);
  if (profile.value?.province && !lower.includes(profile.value.province.toLowerCase())) parts.push(profile.value.province);
  return parts.filter(Boolean).join(', ');
});
const websiteUrl = computed(() => (profile.value?.website ? (/^https?:\/\//i.test(profile.value.website) ? profile.value.website : `https://${profile.value.website}`) : null));
const kit = computed(() =>
  [
    profile.value?.shirtColor && `camiseta ${profile.value.shirtColor.toLowerCase()}`,
    profile.value?.shortsColor && `pantalón ${profile.value.shortsColor.toLowerCase()}`,
    profile.value?.socksColor && `medias ${profile.value.socksColor.toLowerCase()}`,
  ]
    .filter(Boolean)
    .join(' · '),
);

/** El club corrige la plantilla publicada de sus propios equipos. */
function onRosterUpdated(roster: typeof data.value extends infer T ? (T extends { roster: infer R } ? R : never) : never) {
  if (data.value) data.value = { ...data.value, roster, rosterPublished: roster.length > 0 };
}

/** Cifras de la clasificación: la posición, destacada, y el resto en la misma fila. */
const standingFigures = computed(() => {
  const st = data.value?.standing;
  if (!st) return [];
  return [
    { label: 'Posición', value: `${st.position}º` },
    { label: 'Puntos', value: st.points },
    { label: 'Jugados', value: st.played },
    { label: 'G-E-P', value: `${st.won}-${st.drawn}-${st.lost}` },
    { label: 'Goles', value: `${st.goalsFor}:${st.goalsAgainst}` },
    { label: 'Diferencia', value: st.goalDifference > 0 ? `+${st.goalDifference}` : st.goalDifference },
  ];
});

const isMyClubTeam = computed(() => auth.club?.teams.some((t) => t.teamId === props.teamId) ?? false);
const linking = ref(false);
const linkError = ref<string | null>(null);

/** Cuenta de club: vincula el equipo al club para poder nombrar a sus técnicos. */
async function linkToClub() {
  linking.value = true;
  linkError.value = null;
  try {
    await api.clubs.addTeam(props.teamId);
    await auth.refreshAccount();
    await router.push({ name: 'home' });
  } catch (e) {
    linkError.value = errorMessage(e);
  } finally {
    linking.value = false;
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
        <TeamCrest :src="data.crestUrl" :name="data.name" :short-name="data.shortName" size="lg" />
        <RouterLink v-if="data.squad?.canView" :to="{ name: 'squad', params: { squadId: data.squad.squadId } }" class="btn-primary">
          {{ data.squad.isMine ? 'Mi plantilla' : 'Ver plantilla' }}
        </RouterLink>
        <RouterLink v-else-if="auth.isClub && isMyClubTeam" to="/" class="btn-primary">Nombrar técnicos</RouterLink>
        <button v-else-if="auth.isClub" type="button" class="btn-primary" v-busy="linking" :disabled="linking" @click="linkToClub">
          {{ linking ? 'Vinculando…' : 'Vincular a mi club' }}
        </button>
      </template>
    </PageHeader>

    <Alert v-if="linkError" kind="error" class="mb-4">{{ linkError }}</Alert>

    <div v-if="standingFigures.length" class="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
      <div v-for="(figure, i) in standingFigures" :key="figure.label" class="relative min-w-0 rounded-xl border border-line bg-surface px-2 pb-3 pt-2.5 text-center shadow-card sm:px-3">
        <span v-if="i === 0" class="absolute inset-x-3 top-0 h-0.5 rounded-b bg-brand-500" aria-hidden="true" />
        <p class="truncate font-display text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-500 sm:text-[11px] sm:tracking-[0.12em]">{{ figure.label }}</p>
        <p class="mt-1 font-figures text-xl font-extrabold leading-none tabular-nums text-slate-900 sm:text-2xl">{{ figure.value }}</p>
      </div>
    </div>

    <!-- Ficha del club según la federación: campo donde juega de local, sede y equipación -->
    <section v-if="profile" class="card mb-6">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold text-slate-900">El club</h2>
          <p class="mt-1 text-sm text-slate-600">
            {{ profile.officialName ?? data.name }}<template v-if="profile.locality"> · {{ profile.locality }}</template><template v-if="profile.province"> ({{ profile.province }})</template>
          </p>
        </div>
        <a v-if="data.officialUrl" :href="data.officialUrl" target="_blank" rel="noopener" class="text-xs text-accent-400 hover:underline">Ficha en la federación ↗</a>
      </div>
      <dl class="mt-4 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div v-if="profile.ground">
          <dt class="eyebrow">Campo (como local)</dt>
          <dd class="mt-1 font-medium text-slate-900">
            {{ profile.ground }}<span v-if="profile.groundSurface" class="font-normal text-slate-500"> · {{ profile.groundSurface }}</span>
          </dd>
          <dd v-if="groundAddress" class="text-slate-600">{{ groundAddress }}</dd>
          <dd v-if="mapsUrl" class="mt-1"><a :href="mapsUrl" target="_blank" rel="noopener" class="text-accent-400 hover:underline">Cómo llegar ↗</a></dd>
        </div>
        <div v-if="seatAddress || websiteUrl">
          <dt class="eyebrow">Sede</dt>
          <dd v-if="seatAddress" class="mt-1 text-slate-700">{{ seatAddress }}</dd>
          <dd v-if="websiteUrl" class="mt-1"><a :href="websiteUrl" target="_blank" rel="noopener" class="text-accent-400 hover:underline">{{ profile.website }}</a></dd>
        </div>
        <div v-if="kit">
          <dt class="eyebrow">Equipación</dt>
          <dd class="mt-1 text-slate-700">{{ kit }}</dd>
        </div>
      </dl>
    </section>

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
            ¿Eres de su cuerpo técnico? Pide a tu club un código de acceso y <RouterLink to="/codigo-acceso" class="font-medium text-accent-400 hover:underline">canjéalo</RouterLink>.
          </template>
          <template v-else-if="auth.isPlayer">
            ¿Juegas en este equipo? Pide el código a tu cuerpo técnico y
            <RouterLink to="/invitacion" class="font-medium text-accent-400 hover:underline">vincúlate a tu ficha</RouterLink>.
          </template>
          <template v-else>
            <RouterLink to="/registro" class="font-medium text-accent-400 hover:underline">Date de alta</RouterLink> si formas parte del equipo.
          </template>
        </template>

        <template v-else-if="!data.squad">
          <template v-if="auth.isCoach">
            La plantilla se crea cuando un técnico nombrado por el club canjea su código de acceso: se importan las fichas
            publicadas por futbolasturiano.es (si las hay) y nace privada. El club o entrenador genera después un código personal para cada jugador.
          </template>
          <template v-else-if="auth.isClub">
            Vincula el equipo a tu club y nombra a su cuerpo técnico: al canjear el código de acceso se crea la plantilla.
          </template>
          <template v-else-if="auth.isPlayer">Pide a tu cuerpo técnico que la cree: después tu club o entrenador te facilitará un código personal para vincular tu ficha.</template>
          <template v-else>
            ¿Eres del club o de su cuerpo técnico? <RouterLink to="/registro" class="font-medium text-accent-400 hover:underline">Date de alta</RouterLink>.
          </template>
        </template>

        <template v-else>Las actas de sus partidos y las estadísticas de sus jugadores están disponibles en la plantilla.</template>
      </div>
    </section>

    <!-- Próximo partido -->
    <section v-if="nextMatch && nextOpponent" class="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-accent-400/30 bg-brand-500/10 p-4">
      <div class="w-16 shrink-0 text-center">
        <p class="text-xs uppercase text-accent-400">Jornada</p>
        <p class="font-display text-3xl font-bold text-slate-900">{{ nextMatch.matchday }}</p>
      </div>
      <div class="min-w-0 flex-1 basis-56">
        <p class="text-xs font-semibold uppercase tracking-wide text-emerald-700">Próximo partido</p>
        <RouterLink :to="{ name: 'match', params: { matchId: nextMatch.id } }" class="block truncate text-lg font-semibold text-slate-900 hover:text-accent-400">
          <TeamName :name="nextOpponent.team.name" :crest-url="nextOpponent.team.crestUrl" :short-name="nextOpponent.team.shortName" size="sm">
            <span class="text-slate-400">vs</span> {{ nextOpponent.team.name }}
          </TeamName>
          <span class="ml-1 text-sm font-normal" :class="nextOpponent.home ? 'text-emerald-700' : 'text-slate-500'">{{ nextOpponent.home ? 'en casa' : 'fuera' }}</span>
        </RouterLink>
        <p class="text-sm text-slate-600">{{ formatKickoff(nextMatch.kickoffAt) }}<span v-if="nextMatch.venue"> · {{ nextMatch.venue }}</span></p>
      </div>
      <RouterLink :to="{ name: 'league', query: { competition: data.season.competitionId } }" class="btn-secondary w-full sm:w-auto">
        Ver la jornada completa
      </RouterLink>
    </section>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <section class="lg:col-span-3">
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Resultados</h2>
        <Skeleton v-if="matches.loading.value && !matches.data.value" :count="6" label="Cargando el calendario…" />
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

        <ClubRosterEditor v-if="auth.isClub && isMyClubTeam" :team-id="data.id" :roster="data.roster" @updated="onRosterUpdated" />

        <p v-else-if="!data.rosterPublished" class="text-sm text-slate-600">
          El proveedor no publica la plantilla de este equipo. El cuerpo técnico puede añadir las fichas a mano.
        </p>

        <div v-else class="overflow-x-auto">
          <table class="min-w-full text-sm">
            <thead class="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th class="py-2 pr-3 text-left">#</th>
                <th class="py-2 pr-3 text-left">Jugador</th>
                <th class="py-2 text-left" title="Goles, tarjetas y minutos según las actas oficiales">Temporada</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              <tr v-for="entry in data.roster" :key="entry.id">
                <td class="py-2 pr-3 tabular-nums text-slate-500">{{ entry.shirtNumber ?? '—' }}</td>
                <td class="py-2 pr-3 whitespace-nowrap">
                  <span class="inline-flex items-center gap-2">
                    <PlayerAvatar :src="entry.photoUrl" :name="entry.fullName" size="sm" />
                    <span>
                      <RouterLink
                        v-if="auth.isAuthenticated"
                        :to="{ name: 'player-card', params: { teamId: data.id, entryId: entry.id } }"
                        class="font-medium text-slate-800 hover:text-brand-500 hover:underline"
                      >{{ entry.fullName }}</RouterLink>
                      <span v-else class="font-medium text-slate-800">{{ entry.fullName }}</span>
                      <span class="block text-xs text-slate-500">{{ entry.position ? positionLabels[entry.position] : 'Sin posición' }}</span>
                    </span>
                  </span>
                </td>
                <td class="py-2 whitespace-nowrap"><RosterStatsSummary :stats="entry.stats" /></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  </template>
</template>
