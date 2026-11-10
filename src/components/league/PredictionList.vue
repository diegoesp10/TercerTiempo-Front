<script setup lang="ts">
import TeamCrest from '@/components/teams/TeamCrest.vue';
import { metricColors, percent, type PredictionMetric } from '@/charts/predictions';
import type { TeamPredictionDto } from '@/types/api';

/**
 * Probabilidades de cada equipo en pantallas estrechas: una fila por equipo con sus barras de campeón, ascenso y
 * descenso a lo ancho, en lugar del gráfico de barras agrupadas, que en un móvil dejaba los nombres y las barras
 * montados unos sobre otros.
 */
const props = defineProps<{
  teams: TeamPredictionDto[];
  metrics: PredictionMetric[];
  labels: Record<PredictionMetric, string>;
  highlightTeamIds?: string[];
}>();

// En cada fila no caben los nombres: cada probabilidad lleva el icono y el color de la leyenda de arriba.
const icons: Record<PredictionMetric, string> = { champion: 'trophy', promotion: 'arrow-trend-up', relegation: 'arrow-trend-down' };
const isMine = (team: TeamPredictionDto) => props.highlightTeamIds?.includes(team.teamId) ?? false;
const points = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 0 });
// Las probabilidades pequeñas se siguen viendo: un trazo mínimo en lugar de una barra vacía.
const barWidth = (value: number) => `${value > 0 ? Math.max(value * 100, 2) : 0}%`;
</script>

<template>
  <div>
    <ul class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      <li v-for="metric in metrics" :key="metric" class="flex items-center gap-1.5">
        <Icon :icon="icons[metric]" class="text-[11px]" :style="{ color: metricColors[metric] }" />{{ labels[metric] }}
      </li>
    </ul>
    <ol class="mt-2 divide-y divide-line">
      <li
        v-for="(team, index) in teams"
        :key="team.teamId"
        class="-mx-2 rounded-lg px-2 py-2.5"
        :class="{ 'my-club-row': isMine(team) }"
      >
        <div class="flex items-center gap-2">
          <span class="w-5 shrink-0 text-right font-figures text-xs text-slate-500" title="Puesto final esperado">{{ index + 1 }}</span>
          <TeamCrest :src="team.crestUrl" :name="team.teamName" :short-name="team.shortName" size="xs" />
          <RouterLink :to="{ name: 'team', params: { teamId: team.teamId } }" class="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">
            {{ team.teamName }}
          </RouterLink>
          <span class="shrink-0 font-figures text-xs text-slate-500" title="Puntos al final de la liga, de media">≈ {{ points(team.expectedPoints) }} pts</span>
        </div>
        <div class="mt-1.5 grid gap-x-3 pl-7" :class="metrics.length === 3 ? 'grid-cols-3' : 'grid-cols-2'">
          <div v-for="metric in metrics" :key="metric" class="min-w-0" :aria-label="`${labels[metric]}: ${percent(team[metric])}`">
            <div class="flex items-center justify-between gap-1">
              <!-- Font Awesome fija el ancho en em: el tamaño del icono va con el de la letra. -->
              <Icon :icon="icons[metric]" class="shrink-0 text-[10px]" :style="{ color: metricColors[metric] }" />
              <span class="whitespace-nowrap font-figures text-xs font-semibold text-slate-800">{{ percent(team[metric]) }}</span>
            </div>
            <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div class="h-full rounded-full" :style="{ width: barWidth(team[metric]), background: metricColors[metric] }" />
            </div>
          </div>
        </div>
      </li>
    </ol>
  </div>
</template>
