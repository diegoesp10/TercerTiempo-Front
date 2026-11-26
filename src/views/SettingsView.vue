<script setup lang="ts">
import ClubCrestEditor from '@/components/clubs/ClubCrestEditor.vue';
import ChangePasswordCard from '@/components/auth/ChangePasswordCard.vue';
import MyClubFirstCard from '@/components/settings/MyClubFirstCard.vue';
import ThemeSettingsCard from '@/components/settings/ThemeSettingsCard.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useBackFallback } from '@/composables/useBackFallback';
import { useAuthStore } from '@/stores/auth';
import { accountTypeLabels } from '@/utils/format';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';

// Ajustes del club, del técnico y de quien entra sin cuenta. El jugador los tiene dentro de «Mi perfil» (el router le
// lleva allí).
const auth = useAuthStore();

// Se entra desde la rueda del perfil: «Volver» (arriba a la izquierda, como en toda la app) regresa a él.
useBackFallback(() => (auth.profileRoute ? { to: auth.profileRoute, label: 'Volver a mi perfil' } : { to: { name: 'home' }, label: 'Volver al inicio' }));
</script>

<template>
  <div class="mx-auto max-w-narrow">
    <PageHeader title="Ajustes" subtitle="El tema y tus preferencias se guardan en este dispositivo; la contraseña, en tu cuenta." />

    <ThemeSettingsCard />

    <MyClubFirstCard v-if="auth.isAuthenticated" class="mt-6" />

    <ClubCrestEditor v-if="auth.isClub" class="mt-6" />

    <section v-if="auth.isAuthenticated && auth.account" class="card mt-6">
      <h2 class="text-lg font-bold text-slate-900">Cuenta</h2>
      <dl class="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</dt>
          <dd class="mt-0.5 flex items-center gap-2 font-medium text-slate-900">
            <TeamCrest v-if="auth.isClub" :src="auth.clubCrestUrl" :name="auth.displayName" size="sm" />
            <PlayerAvatar v-else-if="auth.isCoach" :src="auth.coach?.photoUrl" :name="auth.displayName" size="sm" />
            {{ auth.displayName }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de cuenta</dt>
          <dd class="mt-0.5"><Badge :tone="auth.isCoach ? 'blue' : auth.isClub ? 'amber' : 'green'">{{ accountTypeLabels[auth.account.type] }}</Badge></dd>
        </div>
      </dl>
    </section>

    <ChangePasswordCard v-if="auth.isAuthenticated && auth.account" class="mt-6" />
  </div>
</template>
