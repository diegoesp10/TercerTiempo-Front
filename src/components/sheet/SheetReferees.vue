<script setup lang="ts">
import { computed } from 'vue';
import type { SheetRefereesDto } from '@/types/api';
import { officialRoleLabels } from '@/utils/format';

/**
 * El equipo arbitral dentro del acta pública, como los jugadores: el que pitó el partido o, si está por jugar, el que ha
 * designado la federación (vacío: aún sin designar).
 */
const props = defineProps<{ referees: SheetRefereesDto }>();

// De la jornada solo se sabe el árbitro principal: los asistentes llegan con el acta.
const onlyMain = computed(() => props.referees.officials.every((o) => o.role === 'Referee'));
</script>

<template>
  <div class="rounded-xl border border-slate-200 p-4">
    <p class="flex items-center gap-1.5 pb-1 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
      <Icon icon="flag" class="h-3 w-3" />{{ referees.designated ? 'Equipo arbitral designado' : 'Equipo arbitral' }}
    </p>
    <p v-if="referees.officials.length === 0" class="text-sm text-slate-500">
      Aún sin designar: la federación publica el árbitro de cada partido unos días antes.
    </p>
    <ul v-else class="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
      <li v-for="official in referees.officials" :key="official.role" class="flex flex-wrap items-baseline gap-x-2">
        <span class="w-28 shrink-0 text-xs text-slate-500">{{ officialRoleLabels[official.role] }}</span>
        <RouterLink
          v-if="official.refereeId"
          :to="{ name: 'referee', params: { refereeId: official.refereeId } }"
          class="min-w-0 break-words font-medium text-slate-800 hover:text-accent-400"
          title="Ver su ficha de árbitro"
        >{{ official.name }}</RouterLink>
        <span v-else class="min-w-0 break-words font-medium text-slate-800">{{ official.name }}</span>
      </li>
    </ul>
    <p v-if="referees.designated && referees.officials.length > 0" class="mt-2 text-[11px] text-slate-500">
      Lo designa la federación y puede cambiar hasta el día del partido.<template v-if="onlyMain"> Los asistentes llegan con el acta.</template>
    </p>
  </div>
</template>
