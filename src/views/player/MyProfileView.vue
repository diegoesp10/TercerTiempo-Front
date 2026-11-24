<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import ChangePasswordCard from '@/components/auth/ChangePasswordCard.vue';
import PlayerPhotoWizard from '@/components/players/PlayerPhotoWizard.vue';
import PublicProfileToggle from '@/components/players/PublicProfileToggle.vue';
import MyClubFirstCard from '@/components/settings/MyClubFirstCard.vue';
import ThemeSettingsCard from '@/components/settings/ThemeSettingsCard.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import TeamName from '@/components/teams/TeamName.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAuthStore } from '@/stores/auth';
import type { PlayerDto } from '@/types/api';
import { positionLabels } from '@/utils/format';

/**
 * «Mi perfil» del jugador: su cuenta, no sus números (esos están en «Mi panel»). La foto, quién ve su perfil completo,
 * los ajustes de la app y el vínculo con su plantilla. Su ficha pública, la que ven los demás, es otra página.
 */
const auth = useAuthStore();
const squad = computed(() => auth.playerSquad);

// Lo guardado en el navegador puede ser de hace días (el club pudo cambiar algo): se pide la cuenta al entrar.
onMounted(() => {
  auth.refreshAccount().catch(() => undefined);
});

const photoOpen = ref(false);
function onPhotoSaved(player: PlayerDto) {
  auth.setPlayer(player);
}

const leaving = ref(false);
const leaveError = ref<string | null>(null);
/** Equipo del que se acaba de desvincular, para confirmárselo. */
const leftTeam = ref<string | null>(null);

async function leave() {
  const current = squad.value;
  if (!current) return;
  const ok = await confirmDialog({
    title: 'Desvincularte de la plantilla',
    message:
      `Tu cuenta dejará de ser tu ficha de ${current.teamName}: no verás la plantilla, sus convocatorias ni sus entrenamientos, ` +
      'y no te llegarán sus avisos. Tus actas se quedan en la plantilla. Para volver, pide el código de tu ficha a tu club o a tu cuerpo técnico.',
    confirmLabel: 'Desvincularme',
    danger: true,
  });
  if (!ok) return;
  leaving.value = true;
  leaveError.value = null;
  try {
    auth.setPlayer(await api.players.leaveSquad());
    leftTeam.value = current.teamName;
  } catch (e) {
    leaveError.value = errorMessage(e);
  } finally {
    leaving.value = false;
  }
}
</script>

<template>
  <div v-if="auth.player">
    <PageHeader title="Mi perfil" subtitle="Tu foto, quién ve tu perfil completo, tus ajustes y tu plantilla. Tus números están en «Mi panel»." />

    <div class="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:items-start">
      <!-- Quién eres: foto, nombre y equipo, sin cifras. -->
      <aside class="card flex flex-col items-center text-center lg:sticky lg:top-24">
        <PlayerAvatar :src="auth.player.photoUrl" :name="auth.displayName" size="xl" />
        <button type="button" class="btn-secondary mt-3 px-3 py-1.5 text-xs" @click="photoOpen = true">
          <Icon icon="camera" class="h-3 w-3" />{{ auth.player.photoUrl ? 'Cambiar mi foto' : 'Subir mi foto' }}
        </button>
        <h2 class="mt-4 break-words font-display text-2xl font-bold leading-tight text-slate-900">{{ auth.displayName }}</h2>
        <div class="mt-2 flex flex-wrap justify-center gap-1.5">
          <Badge tone="green">Jugador</Badge>
          <Badge tone="slate">{{ positionLabels[auth.player.position] }}</Badge>
        </div>
        <dl class="mt-5 w-full space-y-3 border-t border-line pt-4 text-left text-sm">
          <div>
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Equipo</dt>
            <dd class="mt-0.5 font-medium text-slate-900">
              <RouterLink v-if="squad" :to="{ name: 'squad', params: { squadId: squad.squadId } }" class="hover:text-brand-500 hover:underline" title="Abrir la plantilla">
                <TeamName :name="squad.teamName" :crest-url="squad.teamCrestUrl" />
              </RouterLink>
              <span v-else class="font-normal text-slate-500">Sin plantilla</span>
            </dd>
          </div>
          <div v-if="squad">
            <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Competición</dt>
            <dd class="mt-0.5 text-slate-700">{{ squad.competitionName }} · {{ squad.seasonLabel }}</dd>
          </div>
        </dl>
      </aside>

      <div class="min-w-0 space-y-6">
        <section v-if="squad" class="card">
          <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900"><Icon icon="eye" class="h-4 w-4 text-slate-500" />Quién ve tu perfil</h2>
          <p class="mt-1 text-sm text-slate-500">Tu club y tu plantilla ven siempre tu perfil completo. Fuera de ellos, lo decides tú:</p>
          <PublicProfileToggle class="mt-4" />
          <RouterLink
            v-if="squad.rosterEntryId"
            :to="{ name: 'player-card', params: { teamId: squad.teamId, entryId: squad.rosterEntryId } }"
            class="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent-400 hover:underline"
          >
            Ver mi ficha como la ven los demás<Icon icon="chevron-right" class="h-3 w-3" />
          </RouterLink>
        </section>

        <h2 id="ajustes" class="pt-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Ajustes</h2>
        <ThemeSettingsCard />
        <MyClubFirstCard />
        <ChangePasswordCard />

        <section class="card">
          <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900"><Icon icon="user-group" class="h-4 w-4 text-slate-500" />Tu plantilla</h2>
          <template v-if="squad">
            <p class="mt-1 text-sm text-slate-600">
              Tu cuenta es tu ficha de <strong>{{ squad.teamName }}</strong> ({{ squad.seasonLabel }}): por eso ves la plantilla, sus convocatorias y
              sus entrenamientos, y te llegan sus avisos.
            </p>
            <p class="mt-2 text-sm text-slate-600">
              Si te desvinculas, tu cuenta deja de ser esa ficha. Tus actas y tu historial se quedan en la plantilla; para volver, pide el código de tu
              ficha a tu club o a tu cuerpo técnico.
            </p>
            <Alert v-if="leaveError" kind="error" class="mt-3">{{ leaveError }}</Alert>
            <button
              type="button"
              class="btn-secondary mt-4 border-red-400/60 text-red-600 hover:border-red-500 hover:bg-red-500/10"
              :disabled="leaving"
              :title="leaving ? 'Desvinculando tu cuenta…' : undefined"
              @click="leave"
            >
              <Icon icon="link-slash" class="h-3.5 w-3.5" />Desvincularme de la plantilla
            </button>
          </template>
          <template v-else>
            <Alert v-if="leftTeam" kind="success" class="mt-3">Ya no estás vinculado a {{ leftTeam }}. Tus actas siguen en su plantilla.</Alert>
            <p class="mt-2 text-sm text-slate-600">
              Todavía no estás vinculado a ninguna plantilla. Pide a tu club o a tu entrenador el código personal de tu ficha: al introducirlo, tu
              cuenta pasa a ser esa ficha.
            </p>
            <RouterLink to="/invitacion" class="btn-primary mt-4">Tengo un código de invitación</RouterLink>
          </template>
        </section>
      </div>
    </div>

    <PlayerPhotoWizard :open="photoOpen" :has-photo="!!auth.player.photoUrl" @close="photoOpen = false" @saved="onPhotoSaved" />
  </div>
</template>
