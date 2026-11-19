<script setup lang="ts">
import { computed } from 'vue';
import TeamName from '@/components/teams/TeamName.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import GroundCard from '@/components/trainings/GroundCard.vue';
import Alert from '@/components/ui/Alert.vue';
import Modal from '@/components/ui/Modal.vue';
import type { GroundDto, MatchDto } from '@/types/api';
import { opponentOf } from '@/utils/crests';
import { formatKickoff } from '@/utils/format';

export interface ReviewPlayer {
  id: string;
  name: string;
  shirtNumber: number | null;
  photoUrl: string | null;
  linked: boolean;
  /** Lesionado el día del partido: no puede ir. */
  injured?: boolean;
  /** Sancionado para este partido: no puede ir. */
  suspended?: boolean;
}

export interface ReviewGroup {
  key: string;
  label: string;
  short: string;
  players: ReviewPlayer[];
  /** Cuántos hay de esa posición en la plantilla. */
  total: number;
}

/**
 * Repaso de la convocatoria antes de enviarla: el partido, la cita (día, hora, campo con su mapa y notas), los
 * convocados por posición con cuántos van de cada una, quién se queda fuera y a quién no le llega por no tener cuenta.
 * Si ya estaba enviada, además, quién entra y quién sale (los únicos a los que se avisa, salvo que cambie la cita).
 */
const props = defineProps<{
  open: boolean;
  busy: boolean;
  /** Ya estaba enviada: se guardan cambios. */
  update: boolean;
  match: MatchDto;
  teamId: string;
  meetAt: string | null;
  ground: GroundDto | null;
  place: string | null;
  notes: string | null;
  groups: ReviewGroup[];
  notCalled: ReviewPlayer[];
  changes: { entering: string[]; leaving: string[]; meetChanged: boolean } | null;
}>();
const emit = defineEmits<{ close: []; confirm: [] }>();

const opponent = computed(() => opponentOf(props.match, props.teamId));
const calledCount = computed(() => props.groups.reduce((n, g) => n + g.players.length, 0));
const withoutAccount = computed(() => props.groups.flatMap((g) => g.players).filter((p) => !p.linked));
const meetBeforeKickoff = computed(() => {
  if (!props.meetAt) return null;
  const minutes = Math.round((new Date(props.match.kickoffAt).getTime() - new Date(props.meetAt).getTime()) / 60000);
  if (minutes <= 0) return null;
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h${minutes % 60 ? ` ${minutes % 60} min` : ''} antes del partido` : `${minutes} min antes del partido`;
});
const nobodyToWarn = computed(() => props.update && props.changes && !props.changes.meetChanged && !props.changes.entering.length && !props.changes.leaving.length);
</script>

<template>
  <Modal :open="open" :title="update ? 'Repasa los cambios' : 'Repasa la convocatoria'" size="lg" @close="emit('close')">
    <div class="space-y-5">
      <!-- Partido -->
      <section class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3">
        <div class="min-w-0">
          <p class="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Jornada {{ match.matchday }}</p>
          <TeamName prefix="vs" :name="opponent.name" :crest-url="opponent.crestUrl" :short-name="opponent.shortName" :team-id="opponent.id" size="sm" />
        </div>
        <p class="text-sm text-slate-600"><Icon icon="calendar-check" class="mr-1.5 h-3 w-3" />{{ formatKickoff(match.kickoffAt) }}</p>
      </section>

      <!-- Cita -->
      <section class="grid gap-4 sm:grid-cols-2">
        <div>
          <h3 class="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Cita</h3>
          <p v-if="meetAt" class="font-medium text-slate-900">{{ formatKickoff(meetAt) }}</p>
          <p v-else class="text-sm text-amber-600">Sin hora de cita</p>
          <p v-if="meetBeforeKickoff" class="text-xs text-slate-500">{{ meetBeforeKickoff }}</p>
        </div>
        <div>
          <h3 class="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Lugar</h3>
          <GroundCard v-if="ground || place" :ground="ground" :place="place" compact />
          <p v-else class="text-sm text-amber-600">Sin lugar</p>
        </div>
        <div v-if="notes" class="sm:col-span-2">
          <h3 class="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Notas</h3>
          <p class="whitespace-pre-line text-sm text-slate-700">{{ notes }}</p>
        </div>
      </section>

      <!-- Contador por posición -->
      <section>
        <h3 class="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{{ calledCount }} convocados</h3>
        <div class="flex flex-wrap gap-2">
          <span
            v-for="g in groups"
            :key="g.key"
            class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs"
            :class="g.players.length ? 'border-brand-500/40 bg-brand-500/10 text-slate-800' : 'border-amber-500/40 bg-amber-500/10 text-amber-700'"
            :title="`${g.players.length} de ${g.total} ${g.label.toLowerCase()} de la plantilla`"
          >
            <strong class="font-display">{{ g.short }}</strong>
            <span class="tabular-nums">{{ g.players.length }}<span class="text-slate-400">/{{ g.total }}</span></span>
          </span>
        </div>
      </section>

      <!-- Convocados por posición -->
      <section class="space-y-3">
        <div v-for="g in groups.filter((x) => x.players.length)" :key="g.key">
          <p class="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{{ g.label }} · {{ g.players.length }}</p>
          <ul class="grid gap-2 sm:grid-cols-2">
            <li v-for="p in g.players" :key="p.id" class="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-sm">
              <PlayerAvatar :src="p.photoUrl" :name="p.name" size="sm" />
              <span class="min-w-0 flex-1 truncate text-slate-900">{{ p.name }}</span>
              <span v-if="changes?.entering.includes(p.id)" class="text-[10px] font-semibold uppercase text-emerald-500">Entra</span>
              <span v-if="!p.linked" class="text-[10px] text-slate-400" title="Sin cuenta en la app: no le llega el aviso">sin cuenta</span>
            </li>
          </ul>
        </div>
      </section>

      <section v-if="notCalled.length">
        <p class="mb-1.5 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">No convocados · {{ notCalled.length }}</p>
        <p class="text-sm text-slate-600">
          <template v-for="(p, i) in notCalled" :key="p.id">
            <span :class="changes?.leaving.includes(p.id) ? 'font-medium text-red-500' : ''">{{ p.name }}<template v-if="changes?.leaving.includes(p.id)"> (sale)</template><template v-if="p.suspended"> (sancionado)</template><template v-else-if="p.injured"> (lesionado)</template></span><template v-if="i < notCalled.length - 1">, </template>
          </template>
        </p>
      </section>

      <Alert v-if="withoutAccount.length" kind="warning">
        {{ withoutAccount.length === 1 ? `${withoutAccount[0].name} no tiene cuenta en la app` : `${withoutAccount.length} convocados no tienen cuenta en la app` }}: no les llega el aviso, díselo por otro lado.
      </Alert>

      <p class="text-sm text-slate-600">
        <template v-if="!update">Al enviarla, a cada jugador con cuenta le llega el aviso de si va o no. Después podrás cambiarla y solo se avisará a quien le cambie.</template>
        <template v-else-if="nobodyToWarn">No entra ni sale nadie y la cita es la misma: se guarda sin avisar a nadie.</template>
        <template v-else-if="changes?.meetChanged">La cita cambia: se vuelve a avisar a todos los convocados (su firma se mantiene). <template v-if="changes.entering.length || changes.leaving.length">A quien entra o sale se le borra la firma anterior.</template></template>
        <template v-else>Solo se avisa a los que entran o salen; su firma anterior se borra.</template>
      </p>
    </div>

    <template #footer>
      <div class="flex flex-wrap justify-end gap-2">
        <button type="button" class="btn-secondary" :disabled="busy" @click="emit('close')">Seguir editando</button>
        <button type="button" class="btn-primary" v-busy="busy" :disabled="busy" @click="emit('confirm')">
          <Icon icon="paper-plane" class="mr-1.5 h-3.5 w-3.5" />{{ update ? 'Guardar y avisar' : 'Enviar convocatoria' }}
        </button>
      </div>
    </template>
  </Modal>
</template>
