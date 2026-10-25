<script setup lang="ts">
import { computed, watch } from 'vue';
import { api } from '@/api';
import VideoPlayer from '@/components/videos/VideoPlayer.vue';
import Badge from '@/components/ui/Badge.vue';
import BrandMark from '@/components/layout/BrandMark.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { formatBytes, formatKickoff, videoPartLabels } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';

// Visor público de un vídeo por enlace compartido: no hace falta cuenta; el enlace caduca o se revoca desde la app.
const props = defineProps<{ token: string }>();

const { data, loading, error, run } = useAsync(() => api.videos.shared(props.token), { redirectOnError: false });
watch(() => props.token, () => { data.value = null; void run(); });
const streamUrl = computed(() => api.videos.sharedStreamUrl(props.token));
const score = computed(() => (data.value && data.value.match.homeGoals !== null ? `${data.value.match.homeGoals} - ${data.value.match.awayGoals}` : 'vs'));
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <Spinner v-if="loading && !data" />

    <div v-else-if="error" class="card mx-auto max-w-lg text-center">
      <BrandMark class="mx-auto h-14 w-14" />
      <h1 class="mt-4 text-xl font-bold text-slate-900">Este enlace ya no sirve</h1>
      <p class="mt-2 text-sm text-slate-600">{{ error }}</p>
      <p class="mt-4 text-xs text-slate-500">Pide a quien te lo envió que genere uno nuevo desde Tercer Tiempo.</p>
    </div>

    <template v-else-if="data">
      <div class="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p class="eyebrow">Vídeo compartido · {{ videoPartLabels[data.part] }}</p>
          <h1 class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-bold text-slate-900 sm:text-3xl">
            <TeamName :name="data.match.homeTeam.name" :crest-url="data.match.homeTeam.crestUrl" :short-name="data.match.homeTeam.shortName" size="md" />
            <span class="font-display text-brand-500">{{ score }}</span>
            <TeamName :name="data.match.awayTeam.name" :crest-url="data.match.awayTeam.crestUrl" :short-name="data.match.awayTeam.shortName" size="md" />
          </h1>
          <p class="mt-1 text-sm text-slate-500">
            Jornada {{ data.match.matchday }} · {{ formatKickoff(data.match.kickoffAt) }} · grabado por <TeamName :name="data.teamName" :team-id="data.teamId" :crest-url="data.teamCrestUrl" />
            <template v-if="data.title && data.title !== data.match.homeTeam.name"> · {{ data.title }}</template>
          </p>
        </div>
        <Badge tone="amber">Enlace válido hasta el {{ formatKickoff(data.expiresAt) }}</Badge>
      </div>

      <VideoPlayer :src="streamUrl" :type="data.contentType" :title="data.title" />

      <p class="mt-3 text-xs text-slate-500">{{ formatBytes(data.sizeBytes) }} · el vídeo se reproduce desde Tercer Tiempo sin descargarlo entero; puedes saltar en la línea de tiempo.</p>
    </template>
  </div>
</template>
