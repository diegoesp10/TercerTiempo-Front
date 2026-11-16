<script setup lang="ts">
import Badge from '@/components/ui/Badge.vue';
import TeamName from '@/components/teams/TeamName.vue';
import type { SquadAgendaItemDto, TrainingSummaryDto } from '@/types/api';
import { opponentOf } from '@/utils/crests';
import { callUpResponseLabels, callUpResponseTone, formatDayHeading, formatDurationMinutes, formatTime, toDateKey } from '@/utils/format';

/**
 * La agenda de la plantilla en lista: entrenamientos y partidos juntos, por orden de fecha. El partido va con balón y
 * borde azul, y enlaza a su convocatoria; el entrenamiento, con silbato, y se abre donde diga el padre. Lo ya realizado
 * va atenuado con un check. En el panel de inicio se usa en versión compacta (una línea por elemento).
 */
const props = withDefaults(
  defineProps<{
    items: SquadAgendaItemDto[];
    squadId: string;
    teamId: string;
    canManage?: boolean;
    compact?: boolean;
  }>(),
  { canManage: false, compact: false },
);
const emit = defineEmits<{ training: [session: TrainingSummaryDto] }>();

const today = toDateKey(new Date());
const tomorrow = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateKey(d);
})();

function day(at: string) {
  const key = toDateKey(new Date(at));
  if (key === today) return 'Hoy';
  if (key === tomorrow) return 'Mañana';
  return formatDayHeading(at);
}

const score = (item: SquadAgendaItemDto) =>
  item.match && item.match.homeGoals !== null && item.match.awayGoals !== null ? `${item.match.homeGoals}-${item.match.awayGoals}` : null;
const rival = (item: SquadAgendaItemDto) => opponentOf(item.match!, props.teamId);
const key = (item: SquadAgendaItemDto) => (item.kind === 'Match' ? `m:${item.match!.id}` : `t:${item.training!.id}`);
</script>

<template>
  <ul :class="compact ? 'divide-y divide-line' : 'space-y-2'">
    <li v-for="item in items" :key="key(item)">
      <!-- Partido: a su convocatoria -->
      <RouterLink
        v-if="item.kind === 'Match'"
        :to="{ name: 'squad-callup', params: { squadId, matchId: item.match!.id } }"
        class="flex items-start gap-3 transition"
        :class="[
          compact ? 'rounded-lg px-1 py-2 hover:bg-surface-2' : 'card border-l-4 border-l-brand-500 p-3 hover:border-brand-400/60 sm:p-3',
          item.done ? (compact ? 'opacity-60' : 'border-dashed border-l-slate-500 bg-surface-2/60 opacity-70') : '',
        ]"
      >
        <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" :class="item.done ? 'bg-surface-2 text-slate-500' : 'bg-brand-500 text-white'">
          <Icon :icon="item.done ? 'circle-check' : 'futbol'" class="h-3.5 w-3.5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex min-w-0 items-center gap-1 font-medium" :class="item.done ? 'text-slate-500' : 'text-slate-900'">
            <span class="shrink-0">Partido · J{{ item.match!.matchday }}</span>
            <TeamName class="min-w-0" prefix="vs" :name="rival(item).name" :crest-url="rival(item).crestUrl" :short-name="rival(item).shortName" />
          </span>
          <span class="block text-xs text-slate-500">{{ day(item.startsAt) }} · {{ formatTime(item.startsAt) }}<template v-if="item.match!.venue && !compact"> · {{ item.match!.venue }}</template></span>
          <span class="mt-1 flex flex-wrap gap-1 text-xs">
            <template v-if="item.done">
              <Badge tone="slate">Ya realizado<template v-if="score(item)"> · {{ score(item) }}</template></Badge>
            </template>
            <Badge v-else-if="!item.callUp" tone="slate">{{ canManage ? 'Convocatoria sin preparar' : 'Convocatoria sin enviar' }}</Badge>
            <Badge v-else-if="item.callUp.status === 'Draft'" tone="amber">Convocatoria en borrador</Badge>
            <template v-else>
              <Badge tone="green">{{ item.callUp.counts.called }} convocados</Badge>
              <Badge v-if="canManage" :tone="item.callUp.counts.seen >= item.callUp.counts.sent ? 'green' : 'slate'">
                <Icon icon="check-double" class="mr-1 h-3 w-3" :class="item.callUp.counts.seen > 0 ? 'text-emerald-500' : ''" />{{ item.callUp.counts.seen }}/{{ item.callUp.counts.sent }} vistas
              </Badge>
              <Badge v-if="canManage && item.callUp.counts.pending && !compact" tone="amber">{{ item.callUp.counts.pending }} sin firmar</Badge>
              <Badge v-if="item.callUp.mine" :tone="item.callUp.mine.called ? callUpResponseTone[item.callUp.mine.response] : 'slate'">
                {{ item.callUp.mine.called ? `Vas · ${callUpResponseLabels[item.callUp.mine.response]}` : 'No vas' }}
              </Badge>
            </template>
          </span>
        </span>
      </RouterLink>

      <!-- Entrenamiento: lo abre el padre -->
      <button
        v-else
        type="button"
        class="flex w-full items-start gap-3 text-left transition"
        :class="[
          compact ? 'rounded-lg px-1 py-2 hover:bg-surface-2' : 'card border-l-4 border-l-accent-400 p-3 hover:border-brand-400/60 sm:p-3',
          item.done ? (compact ? 'opacity-60' : 'border-dashed border-l-slate-500 bg-surface-2/60 opacity-70') : '',
        ]"
        @click="emit('training', item.training!)"
      >
        <span class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full" :class="item.done ? 'bg-surface-2 text-slate-500' : 'bg-accent-400/15 text-accent-400'">
          <Icon :icon="item.done ? 'circle-check' : 'calendar-check'" class="h-3.5 w-3.5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate font-medium" :class="item.done ? 'text-slate-500' : 'text-slate-900'">Entrenamiento · {{ item.training!.title }}</span>
          <span class="block text-xs text-slate-500">
            {{ day(item.startsAt) }} · {{ formatTime(item.startsAt) }} · {{ formatDurationMinutes(item.training!.durationMinutes) }}
            <template v-if="item.training!.location && !compact"> · {{ item.training!.location }}</template>
          </span>
          <span v-if="!compact || item.done || item.training!.counts.willMiss || item.training!.mine?.status === 'WillMiss'" class="mt-1 flex flex-wrap gap-1 text-xs">
            <Badge v-if="item.done" tone="slate">Ya realizado</Badge>
            <Badge v-if="!compact" tone="slate">{{ item.training!.itemsCount }} ejercicios</Badge>
            <Badge v-if="item.done && item.training!.counts.attended" tone="green">{{ item.training!.counts.attended }} vinieron</Badge>
            <Badge v-else-if="!item.done && item.training!.counts.willMiss" tone="amber">{{ item.training!.counts.willMiss }} faltan</Badge>
            <Badge v-if="item.training!.mine?.status === 'WillMiss'" tone="amber">Has avisado</Badge>
          </span>
        </span>
      </button>
    </li>
  </ul>
</template>
