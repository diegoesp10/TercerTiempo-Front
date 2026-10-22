<script setup lang="ts">
import ClubCrestEditor from '@/components/clubs/ClubCrestEditor.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import Badge from '@/components/ui/Badge.vue';
import PageHeader from '@/components/ui/PageHeader.vue';
import { useAuthStore } from '@/stores/auth';
import { useSettingsStore, type ThemePreference } from '@/stores/settings';
import { accountTypeLabels } from '@/utils/format';

const auth = useAuthStore();
const settings = useSettingsStore();

const themes: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'light', label: 'Claro', description: 'Fondo claro, para trabajar de día o con mucha luz.' },
  { value: 'dark', label: 'Oscuro', description: 'Fondo oscuro, el tema por defecto de Tercer Tiempo.' },
  { value: 'system', label: 'Según el sistema', description: 'Sigue la preferencia de tu dispositivo y cambia con ella.' },
];
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <PageHeader title="Ajustes" subtitle="Preferencias de la interfaz. Se guardan en este dispositivo." />

    <section class="card">
      <h2 class="text-lg font-bold text-slate-900">Apariencia</h2>
      <p class="mt-1 text-sm text-slate-500">Elige el tema de la aplicación.</p>

      <div class="mt-4 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tema">
        <button
          v-for="option in themes"
          :key="option.value"
          type="button"
          role="radio"
          :aria-checked="settings.theme === option.value"
          class="rounded-lg border p-4 text-left transition"
          :class="settings.theme === option.value ? 'border-brand-500 bg-brand-500/10 ring-2 ring-brand-500/30' : 'border-line bg-surface hover:border-brand-400'"
          @click="settings.setTheme(option.value)"
        >
          <span class="mb-3 block h-10 rounded-md border border-line" :class="option.value === 'light' ? 'bg-[#eef1f6]' : option.value === 'dark' ? 'bg-[#0a1120]' : 'bg-gradient-to-r from-[#eef1f6] to-[#0a1120]'" aria-hidden="true" />
          <span class="block font-semibold text-slate-900">{{ option.label }}</span>
          <span class="mt-1 block text-xs text-slate-500">{{ option.description }}</span>
        </button>
      </div>
      <p class="mt-3 text-xs text-slate-500">Tema en uso: <strong>{{ settings.isDark ? 'oscuro' : 'claro' }}</strong>. También puedes alternarlo desde el icono de la barra superior.</p>
    </section>

    <ClubCrestEditor v-if="auth.isClub" class="mt-6" />

    <section v-if="auth.isAuthenticated && auth.account" class="card mt-6">
      <h2 class="text-lg font-bold text-slate-900">Cuenta</h2>
      <dl class="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Nombre</dt>
          <dd class="mt-0.5 flex items-center gap-2 font-medium text-slate-900">
            <TeamCrest v-if="auth.isClub" :src="auth.clubCrestUrl" :name="auth.displayName" size="sm" />
            {{ auth.displayName }}
          </dd>
        </div>
        <div>
          <dt class="text-xs font-semibold uppercase tracking-wide text-slate-500">Tipo de cuenta</dt>
          <dd class="mt-0.5"><Badge :tone="auth.isCoach ? 'blue' : auth.isClub ? 'amber' : 'green'">{{ accountTypeLabels[auth.account.type] }}</Badge></dd>
        </div>
      </dl>
    </section>
  </div>
</template>
