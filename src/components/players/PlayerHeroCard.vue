<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { apiBaseUrl } from '@/api/http';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import { crestFor } from '@/utils/crests';

/**
 * Cabecera de ficha de jugador, al estilo de las tarjetas de estadísticas de los medios deportivos: el equipo en
 * pequeño, el nombre a gran tamaño, una banda oscura con las tres o cuatro cifras que importan y, si el club ha subido
 * su foto, el jugador recortado a la derecha. Sin foto, el dorsal ocupa ese sitio.
 */
export interface HeroStat {
  label: string;
  value: string | number | null | undefined;
}

const props = defineProps<{
  team: string;
  /** Escudo del equipo, junto a su nombre. */
  teamCrestUrl?: string | null;
  teamId?: string | null;
  name: string;
  meta?: string;
  number?: number | null;
  photoUrl?: string | null;
  stats: HeroStat[];
}>();

const failed = ref(false);
watch(() => props.photoUrl, () => { failed.value = false; });
const photo = computed(() => {
  if (!props.photoUrl || failed.value) return null;
  return props.photoUrl.startsWith('/') ? `${apiBaseUrl}${props.photoUrl}` : props.photoUrl;
});

const nameParts = computed(() => {
  const words = props.name.trim().split(/\s+/);
  if (words.length < 2) return { first: '', last: props.name };
  return { first: words[0] ?? '', last: words.slice(1).join(' ') };
});
</script>

<template>
  <section class="hero-card relative overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <div class="relative z-10 grid gap-6 p-6 sm:p-8" :class="photo || number ? 'lg:grid-cols-[1fr_auto]' : ''">
      <div class="min-w-0">
        <!-- Con el id del equipo, el equipo lleva a su página. -->
        <RouterLink
          v-if="teamId"
          :to="{ name: 'team', params: { teamId } }"
          class="eyebrow inline-flex items-center gap-2 rounded hover:underline focus-visible:underline"
          :title="`Ver ${team}`"
        >
          <TeamCrest :src="crestFor(teamCrestUrl, teamId)" :name="team" size="xs" />
          {{ team }}
        </RouterLink>
        <p v-else class="eyebrow flex items-center gap-2">
          <TeamCrest :src="crestFor(teamCrestUrl, teamId)" :name="team" size="xs" />
          {{ team }}
        </p>
        <!-- En pantallas pequeñas la foto grande no cabe: va como avatar junto al nombre. -->
        <PlayerAvatar v-if="photoUrl" :src="photoUrl" :name="name" size="lg" class="mt-3 lg:hidden" />
        <h1 class="mt-2 font-display leading-[0.92] text-slate-900">
          <span v-if="nameParts.first" class="block text-2xl font-semibold tracking-tight text-slate-500 sm:text-3xl">{{ nameParts.first }}</span>
          <span class="block break-words font-extrabold tracking-[-0.03em]" style="font-size: clamp(2.4rem, 8.5vw, 4.75rem)">{{ nameParts.last }}</span>
        </h1>
        <p v-if="meta" class="mt-3 text-sm text-slate-500">{{ meta }}</p>
        <div class="mt-5 flex flex-wrap items-center gap-3">
          <slot name="actions" />
        </div>
      </div>

      <div v-if="photo || number" class="relative hidden lg:block lg:w-64">
        <img v-if="photo" :src="photo" :alt="name" class="absolute bottom-0 right-0 h-[115%] max-w-none object-contain object-bottom drop-shadow-2xl" @error="failed = true" />
        <span v-else class="absolute -bottom-6 right-0 select-none font-display text-[11rem] font-black leading-none tracking-[-0.06em] text-slate-900/8">{{ number }}</span>
      </div>
    </div>

    <dl class="hero-strip relative z-20 mx-4 -mb-px grid grid-cols-[repeat(auto-fit,minmax(5.5rem,1fr))] gap-x-4 gap-y-4 rounded-t-xl px-4 py-4 text-white sm:mx-6 sm:grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))] sm:gap-x-6 sm:px-7 sm:py-5">
      <div v-for="stat in stats" :key="stat.label" class="min-w-0">
        <dt class="font-display text-[11px] font-semibold uppercase tracking-[0.16em] text-white/65">{{ stat.label }}</dt>
        <dd class="mt-0.5 font-display text-3xl font-extrabold leading-none tabular-nums tracking-tight sm:text-4xl">{{ stat.value ?? '—' }}</dd>
      </div>
    </dl>
  </section>
</template>

<style scoped>
.hero-strip {
  background: linear-gradient(135deg, #0f2a66 0%, #0a1f4d 60%, #081a40 100%);
}
:root[data-theme="dark"] .hero-strip {
  background: linear-gradient(135deg, #16388a 0%, #10286a 60%, #0c2158 100%);
}
</style>
