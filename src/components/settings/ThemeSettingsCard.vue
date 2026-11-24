<script setup lang="ts">
import { useSettingsStore, type ThemePreference } from '@/stores/settings';

// Tema de la app (se guarda en el dispositivo). Lo usan «Ajustes» y «Mi perfil» del jugador.
const settings = useSettingsStore();

const themes: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'light', label: 'Claro', description: 'Fondo claro, para trabajar de día o con mucha luz.' },
  { value: 'dark', label: 'Oscuro', description: 'Fondo oscuro, el tema por defecto de Tercer Tiempo.' },
  { value: 'system', label: 'Según el sistema', description: 'Sigue la preferencia de tu dispositivo y cambia con ella.' },
];
</script>

<template>
  <section class="card">
    <h2 class="flex items-center gap-2 text-lg font-bold text-slate-900"><Icon icon="palette" class="h-4 w-4 text-slate-500" />Apariencia</h2>
    <p class="mt-1 text-sm text-slate-500">Elige el tema de la aplicación. Se guarda en este dispositivo.</p>

    <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Tema">
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
</template>
