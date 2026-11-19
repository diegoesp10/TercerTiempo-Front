<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import PlayerName from '@/components/players/PlayerName.vue';
import TeamName from '@/components/teams/TeamName.vue';
import CallUpReviewModal, { type ReviewGroup, type ReviewPlayer } from '@/components/trainings/CallUpReviewModal.vue';
import GroundCard from '@/components/trainings/GroundCard.vue';
import GroundPicker from '@/components/trainings/GroundPicker.vue';
import InjuryNote from '@/components/trainings/InjuryNote.vue';
import SuspensionNote from '@/components/trainings/SuspensionNote.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import GroupByPositionToggle from '@/components/ui/GroupByPositionToggle.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAsync } from '@/composables/useAsync';
import { useGroupByPosition } from '@/composables/usePositionGrouping';
import { useSquad } from '@/composables/useSquad';
import { markCallUpsSeen } from '@/composables/useCallUpSeen';
import { useAlertsStore } from '@/stores/alerts';
import type { CallUpEntryDto, CallUpRequest, CallUpResponse, GroundDto, MatchCallUpDto, Position, SquadGroundsDto } from '@/types/api';
import { opponentOf } from '@/utils/crests';
import { callUpResponseLabels, callUpResponseTone, formatKickoff, positionLabels, positionShortLabels, toDateKey } from '@/utils/format';

/**
 * La convocatoria de un partido: el cuerpo técnico elige quién va (por posición, viendo cuántos lleva de cada una), pone
 * la cita (día, hora y un campo de la liga con su mapa, o un sitio alternativo escrito a mano), la repasa y la envía (se
 * avisa a toda la plantilla, al que va y al que no); cada jugador la firma desde aquí o desde «Mis convocatorias». Como
 * en un chat, el cuerpo técnico ve un check cuando le ha llegado y el doble check verde cuando el jugador la ha abierto;
 * la firma va aparte. No hay «no puedo» para los partidos: lo que cambie se habla con el cuerpo técnico.
 */
const props = defineProps<{ matchId: string }>();

const { squadId, detail } = useSquad();
const alerts = useAlertsStore();

const { data, loading, error, run } = useAsync(() => api.trainings.callUp(squadId.value, props.matchId));
watch(() => props.matchId, () => void run());

const teamId = computed(() => detail.value?.summary.teamId ?? '');
const players = computed(() => detail.value?.players ?? []);
const photos = computed<Record<string, string | null>>(() => Object.fromEntries(players.value.map((p) => [p.id, p.photoUrl])));
const positionOf = computed<Record<string, Position | null>>(() => Object.fromEntries(players.value.map((p) => [p.id, p.position])));

const canEdit = computed(() => (data.value?.canEdit ?? false) && !(data.value?.closed ?? false));

// Los campos de la liga, para la cita (solo hacen falta a quien la prepara).
const grounds = ref<SquadGroundsDto | null>(null);
watch(
  canEdit,
  async (can) => {
    if (!can || grounds.value) return;
    try {
      grounds.value = await api.trainings.grounds(squadId.value);
    } catch {
      grounds.value = { homeGroundId: null, grounds: [] };
    }
  },
  { immediate: true },
);
const groundList = computed<GroundDto[]>(() => {
  const list = grounds.value?.grounds ?? [];
  const extra = [data.value?.meetGround, data.value?.matchGround].filter((g): g is GroundDto => !!g && !list.some((x) => x.id === g.id));
  return [...list, ...extra];
});

// Borrador local de lo que el cuerpo técnico está preparando.
const called = ref(new Set<string>());
const meet = ref({ date: '', time: '', groundId: null as string | null, place: '', notes: '' });
const busy = ref<'draft' | 'publish' | 'respond' | 'resend' | null>(null);
const actionError = ref<string | null>(null);
const reviewOpen = ref(false);

const timeOf = (at: Date) => `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`;
function savedMeet(dto: MatchCallUpDto) {
  const at = dto.meetAt ? new Date(dto.meetAt) : null;
  return { date: at ? toDateKey(at) : '', time: at ? timeOf(at) : '', groundId: dto.meetGround?.id ?? null, place: dto.meetPlace ?? '', notes: dto.notes ?? '' };
}

// No puede ir quien está lesionado el día del partido o sancionado para este partido.
const blocked = (e: CallUpEntryDto) => e.injured || e.suspended;
const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);
function blockedTitle(e: CallUpEntryDto) {
  if (e.suspended) return `Sancionado para este partido${e.suspension ? ` (${lowerFirst(e.suspension.reason)})` : ''}: no puede ir convocado`;
  if (e.injured) return 'Lesionado el día del partido: no puede ir convocado';
  return undefined;
}

function take(dto: MatchCallUpDto) {
  // Quien no puede ir (lesionado o sancionado): si estaba en lo enviado, el borrador ya lo quita.
  called.value = new Set(dto.entries.filter((e) => e.called && !(dto.canEdit && blocked(e))).map((e) => e.squadPlayerId));
  meet.value = savedMeet(dto);
  // Una convocatoria nueva propone el campo del partido.
  if (!dto.id && dto.canEdit && dto.matchGround) meet.value.groundId = dto.matchGround.id;
}
watch(data, (dto) => {
  if (!dto) return;
  take(dto);
  // Quien la abre es el jugador: doble check para el cuerpo técnico.
  if (dto.id && dto.status === 'Published' && dto.mine) markCallUpsSeen([{ callUpId: dto.id, closed: dto.closed, mine: dto.mine }]);
}, { immediate: true });

const savedCalled = computed(() => new Set((data.value?.entries ?? []).filter((e) => e.called).map((e) => e.squadPlayerId)));
const meetChanged = computed(() => {
  if (!data.value) return false;
  const saved = savedMeet(data.value);
  const now = meet.value;
  return saved.date !== now.date || saved.time !== now.time || saved.groundId !== now.groundId || (!now.groundId && saved.place !== now.place.trim());
});
const dirty = computed(() => {
  if (!data.value) return false;
  const saved = savedCalled.value;
  if (saved.size !== called.value.size || [...called.value].some((id) => !saved.has(id))) return true;
  return meetChanged.value || (data.value.notes ?? '') !== meet.value.notes.trim();
});

const sorted = computed(() => [...(data.value?.entries ?? [])].sort((a, b) => a.playerName.localeCompare(b.playerName, 'es')));

// Por posición, como en la plantilla: cuántos van de cada una.
const groupByPosition = useGroupByPosition('call-up', true);
const positionOrder: (Position | null)[] = ['Goalkeeper', 'Defender', 'Midfielder', 'Forward', null];
const byPosition = computed(() =>
  positionOrder
    .map((p) => {
      const entries = sorted.value.filter((e) => (positionOf.value[e.squadPlayerId] ?? null) === p);
      return {
        key: p ?? 'none',
        label: p ? `${positionLabels[p]}s` : 'Sin posición',
        short: p ? positionShortLabels[p] : 'S/P',
        entries,
        called: entries.filter((e) => called.value.has(e.squadPlayerId)).length,
      };
    })
    .filter((g) => g.entries.length > 0),
);
const groups = computed(() =>
  groupByPosition.value ? byPosition.value : [{ key: 'all', label: '', short: '', entries: sorted.value, called: called.value.size }],
);

const blockedIds = computed(() => new Set((data.value?.entries ?? []).filter(blocked).map((e) => e.squadPlayerId)));
// Convocados en lo enviado que no pueden ir: los lesionados el día del partido y los sancionados.
const calledInjured = computed(() => (data.value?.entries ?? []).filter((e) => e.called && e.injured && !e.suspended));
const calledSuspended = computed(() => (data.value?.entries ?? []).filter((e) => e.called && e.suspended));
const suspendedCount = computed(() => (data.value?.entries ?? []).filter((e) => e.suspended).length);

function toggle(id: string) {
  if (blockedIds.value.has(id)) return;
  const next = new Set(called.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  called.value = next;
}

function selectAll(on: boolean) {
  called.value = on ? new Set(sorted.value.filter((e) => !blocked(e)).map((e) => e.squadPlayerId)) : new Set();
}

function selectGroup(entries: CallUpEntryDto[]) {
  const available = entries.filter((e) => !blocked(e));
  const on = available.some((e) => !called.value.has(e.squadPlayerId));
  const next = new Set(called.value);
  for (const e of available) {
    if (on) next.add(e.squadPlayerId);
    else next.delete(e.squadPlayerId);
  }
  called.value = next;
}

// Lo que enseña el repaso antes de enviar.
const reviewPlayer = (e: CallUpEntryDto): ReviewPlayer => ({
  id: e.squadPlayerId,
  name: e.playerName,
  shirtNumber: e.shirtNumber,
  photoUrl: photos.value[e.squadPlayerId] ?? null,
  linked: e.linked,
  injured: e.injured,
  suspended: e.suspended,
});
const reviewGroups = computed<ReviewGroup[]>(() =>
  byPosition.value.map((g) => ({ key: g.key, label: g.label, short: g.short, total: g.entries.length, players: g.entries.filter((e) => called.value.has(e.squadPlayerId)).map(reviewPlayer) })),
);
const reviewNotCalled = computed(() => sorted.value.filter((e) => !called.value.has(e.squadPlayerId)).map(reviewPlayer));
const reviewChanges = computed(() => {
  if (data.value?.status !== 'Published') return null;
  return {
    entering: [...called.value].filter((id) => !savedCalled.value.has(id)),
    leaving: [...savedCalled.value].filter((id) => !called.value.has(id)),
    meetChanged: meetChanged.value,
  };
});
const meetAtIso = computed(() => (meet.value.date ? new Date(`${meet.value.date}T${meet.value.time || '00:00'}`).toISOString() : null));
const chosenGround = computed(() => groundList.value.find((g) => g.id === meet.value.groundId) ?? null);
const writtenPlace = computed(() => (meet.value.groundId ? null : meet.value.place.trim() || null));

async function save(publish: boolean) {
  if (!data.value) return;
  busy.value = publish ? 'publish' : 'draft';
  actionError.value = null;
  try {
    const body: CallUpRequest = {
      calledSquadPlayerIds: [...called.value],
      meetAt: meetAtIso.value,
      meetGroundId: meet.value.groundId,
      meetPlace: writtenPlace.value,
      notes: meet.value.notes.trim() || null,
      publish,
    };
    data.value = await api.trainings.saveCallUp(squadId.value, props.matchId, body);
    reviewOpen.value = false;
  } catch (e) {
    actionError.value = errorMessage(e);
    reviewOpen.value = false;
  } finally {
    busy.value = null;
  }
}

// Enviada (un check) y vista (doble check verde), como en un chat. La firma va aparte.
type Delivery = 'seen' | 'sent' | 'none';
function delivery(e: CallUpEntryDto): Delivery {
  if (e.seenAt) return 'seen';
  if (e.sentAt) return 'sent';
  return 'none';
}
function deliveryTitle(e: CallUpEntryDto) {
  if (e.seenAt) return `Vista el ${formatKickoff(e.seenAt)}`;
  if (e.sentAt) return `Enviada el ${formatKickoff(e.sentAt)}; todavía no la ha abierto`;
  return e.linked ? 'Pendiente de enviar' : 'Sin cuenta en la app: no le llega';
}
const unseen = computed(() => (data.value?.entries ?? []).filter((e) => e.linked && e.sentAt && !e.seenAt).length);

async function resend() {
  if (!data.value) return;
  const ok = await confirmDialog({ title: 'Reenviar la convocatoria', message: `Le vuelve a llegar el aviso a ${unseen.value === 1 ? 'el jugador que todavía no la ha abierto' : `los ${unseen.value} jugadores que todavía no la han abierto`}.`, confirmLabel: 'Reenviar' });
  if (!ok) return;
  busy.value = 'resend';
  actionError.value = null;
  try {
    data.value = await api.trainings.resendCallUp(squadId.value, props.matchId);
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}

async function respond(response: CallUpResponse) {
  if (!data.value?.id) return;
  busy.value = 'respond';
  actionError.value = null;
  try {
    await api.trainings.respondCallUp(data.value.id, response);
    await run();
    void alerts.load();
  } catch (e) {
    actionError.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <Spinner v-if="loading && !data" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <RouterLink :to="{ name: 'squad-trainings', params: { squadId } }" class="text-xs font-medium text-accent-400 hover:underline"><Icon icon="chevron-left" class="mr-1 inline h-3 w-3" />Agenda</RouterLink>
        <h2 class="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-900">
          Convocatoria · J{{ data.match.matchday }}
          <TeamName prefix="vs" :name="opponentOf(data.match, teamId).name" :crest-url="opponentOf(data.match, teamId).crestUrl" :short-name="opponentOf(data.match, teamId).shortName" :team-id="opponentOf(data.match, teamId).id" size="sm" />
        </h2>
        <p class="text-sm text-slate-500">
          {{ formatKickoff(data.match.kickoffAt) }}
          <template v-if="data.matchGround"> · <a :href="data.matchGround.mapsUrl" target="_blank" rel="noopener noreferrer" class="hover:text-accent-400 hover:underline"><Icon icon="location-dot" class="mr-0.5 h-3 w-3" />{{ data.matchGround.name }}</a></template>
          <template v-else-if="data.match.venue"> · {{ data.match.venue }}</template>
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Badge v-if="data.closed" tone="slate">Partido empezado</Badge>
        <Badge v-else-if="data.status === 'Published'" tone="green">Enviada</Badge>
        <Badge v-else-if="data.id" tone="amber">Borrador</Badge>
        <Badge v-else tone="slate">Sin preparar</Badge>
        <RouterLink :to="{ name: 'sheet', params: { squadId, matchId }, query: { tab: 'previa' } }" class="btn-secondary px-3 py-1.5 text-xs"><Icon icon="chart-line" class="mr-1.5 h-3 w-3" />Previa del partido</RouterLink>
      </div>
    </div>

    <Alert v-if="actionError" kind="error" class="mb-4">{{ actionError }}</Alert>

    <!-- La línea del jugador que mira -->
    <section v-if="data.mine" class="card mb-6" :class="data.mine.called ? 'border-brand-500/50' : ''">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="min-w-0">
          <p class="text-lg font-semibold text-slate-900">{{ data.mine.called ? 'Vas convocado' : 'No vas convocado' }}</p>
          <p class="text-sm text-slate-600">
            <template v-if="data.mine.called && data.meetAt">Cita: {{ formatKickoff(data.meetAt) }}.</template>
            <template v-else-if="data.mine.called">El cuerpo técnico no ha puesto hora de cita.</template>
            <template v-else-if="data.mine.suspended">Estás sancionado para este partido: no puedes ir convocado.</template>
            <template v-else-if="data.mine.injured">Estás lesionado el día del partido: no puedes ir convocado.</template>
            <template v-else>Esta vez el cuerpo técnico no cuenta contigo para el partido.</template>
          </p>
          <SuspensionNote v-if="data.mine.suspended" :suspension="data.mine.suspension" class="mt-1" />
          <InjuryNote v-if="data.mine.injured" :injury="data.mine.injury" class="mt-1" />
          <p v-if="!data.closed && !data.mine.suspended && data.mine.cycleYellows === 4" class="mt-1 text-xs text-amber-700">
            <Badge tone="amber" class="mr-1">Apercibido</Badge>Llevas 4 amarillas: con una más te pierdes el siguiente partido de liga.
          </p>
          <GroundCard v-if="data.mine.called && (data.meetGround || data.meetPlace)" :ground="data.meetGround" :place="data.meetPlace" class="mt-2" />
          <p v-if="data.notes" class="mt-1 whitespace-pre-line text-sm text-slate-700">{{ data.notes }}</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <Badge :tone="data.mine.called ? callUpResponseTone[data.mine.response] : data.mine.response === 'Acknowledged' ? 'slate' : 'amber'">
            {{ data.mine.called ? callUpResponseLabels[data.mine.response] : data.mine.response === 'Acknowledged' ? 'Enterado' : 'Sin firmar' }}
          </Badge>
          <template v-if="!data.closed">
            <button v-if="data.mine.called && data.mine.response !== 'Confirmed'" type="button" class="btn-primary px-3 py-1.5 text-xs" v-busy="busy === 'respond'" :disabled="busy !== null" @click="respond('Confirmed')"><Icon icon="check" class="mr-1.5 h-3 w-3" />Firmar la convocatoria</button>
            <button v-else-if="!data.mine.called && data.mine.response !== 'Acknowledged'" type="button" class="btn-secondary px-3 py-1.5 text-xs" v-busy="busy === 'respond'" :disabled="busy !== null" @click="respond('Acknowledged')">Enterado</button>
          </template>
        </div>
      </div>
      <p v-if="data.mine.called && !data.closed" class="mt-2 text-xs text-slate-500">Si no vas a poder ir, díselo a tu cuerpo técnico: la convocatoria la cambian ellos.</p>
    </section>

    <div class="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <!-- Jugadores -->
      <section class="min-w-0">
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Plantilla <span class="font-normal normal-case text-slate-400">· {{ called.size }} convocados</span></h3>
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <GroupByPositionToggle v-model="groupByPosition" />
            <template v-if="canEdit">
              <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="selectAll(true)">Todos</button>
              <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="selectAll(false)">Ninguno</button>
            </template>
          </div>
        </div>

        <Alert v-if="canEdit && calledSuspended.length" kind="warning" class="mb-3">
          {{ calledSuspended.map((e) => e.playerName).join(', ') }} {{ calledSuspended.length === 1 ? 'está sancionado' : 'están sancionados' }} para este partido y no
          {{ calledSuspended.length === 1 ? 'puede' : 'pueden' }} ir: ya {{ calledSuspended.length === 1 ? 'lo hemos quitado' : 'los hemos quitado' }} de la lista. Guarda o reenvía la convocatoria para que quede así.
        </Alert>
        <Alert v-if="canEdit && calledInjured.length" kind="warning" class="mb-3">
          {{ calledInjured.map((e) => e.playerName).join(', ') }} {{ calledInjured.length === 1 ? 'está lesionado' : 'están lesionados' }} el día del partido y no
          {{ calledInjured.length === 1 ? 'puede' : 'pueden' }} ir: ya {{ calledInjured.length === 1 ? 'lo hemos quitado' : 'los hemos quitado' }} de la lista. Guarda o reenvía la convocatoria para que quede así.
        </Alert>

        <!-- Contador por posición -->
        <div v-if="data.id || canEdit" class="mb-3 flex flex-wrap gap-2" aria-label="Convocados por posición">
          <span
            v-for="g in byPosition"
            :key="g.key"
            class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition"
            :class="g.called ? 'border-brand-500/40 bg-brand-500/10 text-slate-800' : 'border-line text-slate-500'"
            :title="`${g.called} de ${g.entries.length} ${g.label.toLowerCase()} convocados`"
          >
            <strong class="font-display">{{ g.short }}</strong>
            <span class="tabular-nums"><span :class="g.called ? 'font-semibold text-brand-500' : ''">{{ g.called }}</span><span class="text-slate-400">/{{ g.entries.length }}</span></span>
          </span>
        </div>

        <p v-if="!data.id && !canEdit" class="text-sm text-slate-500">El cuerpo técnico todavía no ha enviado la convocatoria de este partido.</p>
        <div v-else class="overflow-hidden rounded-lg border border-line">
          <div v-for="g in groups" :key="g.key">
            <div v-if="g.label" class="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
              <span class="font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{{ g.label }} · <span :class="g.called ? 'text-brand-500' : ''">{{ g.called }}</span>/{{ g.entries.length }}</span>
              <button v-if="canEdit" type="button" class="text-[11px] font-medium text-accent-400 hover:underline" @click="selectGroup(g.entries)">
                {{ g.entries.some((e) => !called.has(e.squadPlayerId)) ? 'Todos' : 'Ninguno' }}
              </button>
            </div>
            <ul class="divide-y divide-line border-b border-line last:border-b-0">
              <li v-for="e in g.entries" :key="e.squadPlayerId" class="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" :class="called.has(e.squadPlayerId) ? 'bg-brand-500/5' : ''">
                <label v-if="canEdit" class="flex shrink-0 cursor-pointer items-center">
                  <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-40" :checked="called.has(e.squadPlayerId)" :disabled="blocked(e)" :aria-label="`Convocar a ${e.playerName}`" :title="blockedTitle(e)" @change="toggle(e.squadPlayerId)" />
                </label>
                <Icon v-else-if="e.called" icon="check" class="h-4 w-4 shrink-0 text-brand-500" aria-label="Convocado" />
                <span v-else class="w-4 shrink-0"></span>
                <PlayerName :name="e.playerName" :photo-url="photos[e.squadPlayerId] ?? null" class="min-w-0 flex-1 basis-40" :class="blocked(e) ? 'opacity-60' : ''" />
                <SuspensionNote v-if="e.suspended" :suspension="e.suspension" class="basis-full pl-6 sm:basis-auto sm:pl-0" />
                <InjuryNote v-if="e.injured" :injury="e.injury" class="basis-full pl-6 sm:basis-auto sm:pl-0" />
                <Badge v-if="!data.closed && !e.suspended && e.cycleYellows === 4" tone="amber" title="Lleva 4 amarillas: con una más se pierde el siguiente partido de liga">Apercibido</Badge>
                <span v-if="!groupByPosition" class="hidden text-xs text-slate-500 sm:inline">{{ positionOf[e.squadPlayerId] ? positionLabels[positionOf[e.squadPlayerId]!] : '' }}</span>
                <template v-if="data.status === 'Published'">
                  <Badge v-if="e.called" :tone="callUpResponseTone[e.response]">{{ callUpResponseLabels[e.response] }}</Badge>
                  <Badge v-else-if="e.response === 'Acknowledged'" tone="slate">Enterado</Badge>
                  <Badge v-else-if="e.linked" tone="slate">No va</Badge>
                  <span v-if="data.canEdit && e.linked" class="inline-flex w-14 shrink-0 items-center justify-end gap-1 text-xs" :title="deliveryTitle(e)">
                    <template v-if="delivery(e) === 'seen'"><Icon icon="check-double" class="h-3.5 w-3.5 text-emerald-500" aria-label="Vista" /><span class="text-emerald-500">Vista</span></template>
                    <template v-else-if="delivery(e) === 'sent'"><Icon icon="check" class="h-3.5 w-3.5 text-slate-400" aria-label="Enviada" /><span class="text-slate-400">Enviada</span></template>
                  </span>
                </template>
                <span v-if="!e.linked" class="text-xs text-slate-400" title="Sin cuenta en la app: no le llega el aviso">sin cuenta</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Cita y acciones -->
      <aside class="space-y-4">
        <section class="card">
          <h3 class="mb-2 font-semibold text-slate-900">Cita</h3>
          <template v-if="canEdit">
            <div class="grid grid-cols-[1fr_5.5rem] gap-2">
              <div>
                <label class="label" for="cu-date">Día</label>
                <input id="cu-date" v-model="meet.date" type="date" class="input" />
              </div>
              <div>
                <label class="label" for="cu-time">Hora</label>
                <input id="cu-time" v-model="meet.time" type="time" class="input px-2" />
              </div>
            </div>
            <label class="label mt-2" for="cu-place">Lugar</label>
            <Spinner v-if="!grounds" class="py-2" />
            <GroundPicker
              v-else
              v-model:ground-id="meet.groundId"
              v-model:place="meet.place"
              :grounds="groundList"
              :home-ground-id="grounds.homeGroundId"
              :match-ground-id="data.matchGround?.id ?? null"
            />
            <label class="label mt-2" for="cu-notes">Notas</label>
            <textarea id="cu-notes" v-model="meet.notes" rows="3" maxlength="1000" class="input" placeholder="Equipación, comida, qué llevar…"></textarea>
          </template>
          <template v-else>
            <p v-if="data.meetAt" class="text-sm text-slate-700">{{ formatKickoff(data.meetAt) }}</p>
            <p v-else class="text-sm text-slate-500">Sin hora de cita.</p>
            <GroundCard v-if="data.meetGround || data.meetPlace" :ground="data.meetGround" :place="data.meetPlace" class="mt-2" />
            <p v-if="data.notes" class="mt-2 whitespace-pre-line text-sm text-slate-700">{{ data.notes }}</p>
          </template>
        </section>

        <section class="card text-sm" aria-labelledby="cu-rules">
          <h3 id="cu-rules" class="mb-1.5 flex items-center gap-2 font-semibold text-slate-900"><Icon icon="circle-info" class="h-3.5 w-3.5 text-accent-400" />Sanciones de liga</h3>
          <p class="text-slate-600">
            La 5.ª amarilla (y la 10.ª, la 15.ª…) y cada expulsión dejan al jugador sin el siguiente partido de liga: no se le puede convocar ni ponerle en el acta.
          </p>
          <p class="mt-1.5 text-xs text-slate-500">
            Salen de las tarjetas de las actas: la oficial de la federación cuando está cerrada y, mientras tanto, la interna. Una roja directa puede costar más partidos si lo decide el comité de competición; aquí cuenta el mínimo.
          </p>
          <p v-if="suspendedCount" class="mt-1.5 text-xs font-medium text-red-700">{{ suspendedCount === 1 ? '1 jugador sancionado' : `${suspendedCount} jugadores sancionados` }} para este partido.</p>
        </section>

        <section v-if="data.status === 'Published' && data.canEdit" class="card text-sm">
          <h3 class="mb-2 font-semibold text-slate-900">Entrega</h3>
          <ul class="space-y-1">
            <li class="flex justify-between"><span class="text-slate-600"><Icon icon="check" class="mr-1.5 h-3 w-3 text-slate-400" />Enviada</span><strong class="tabular-nums text-slate-700">{{ data.counts.sent }}</strong></li>
            <li class="flex justify-between"><span class="text-slate-600"><Icon icon="check-double" class="mr-1.5 h-3 w-3 text-emerald-500" />Vista</span><strong class="tabular-nums text-emerald-600">{{ data.counts.seen }}</strong></li>
          </ul>
          <button v-if="canEdit && unseen > 0" type="button" class="btn-secondary mt-3 w-full px-3 py-1.5 text-xs" v-busy="busy === 'resend'" :disabled="busy !== null" @click="resend"><Icon icon="paper-plane" class="mr-1.5 h-3 w-3" />Reenviar a quien no la ha visto ({{ unseen }})</button>
          <p class="mt-2 text-xs text-slate-500">Un check: le ha llegado el aviso. Doble check verde: la ha abierto. La firma va aparte.</p>
        </section>

        <section v-if="data.status === 'Published'" class="card text-sm">
          <h3 class="mb-2 font-semibold text-slate-900">Firmas</h3>
          <ul class="space-y-1">
            <li class="flex justify-between"><span class="text-slate-600">Convocados que han firmado</span><strong class="tabular-nums text-emerald-600">{{ data.counts.confirmed }}</strong></li>
            <li class="flex justify-between"><span class="text-slate-600">Sin firmar</span><strong class="tabular-nums text-amber-600">{{ data.counts.pending }}</strong></li>
            <li class="flex justify-between"><span class="text-slate-600">No convocados enterados</span><strong class="tabular-nums text-slate-700">{{ data.counts.acknowledged }}</strong></li>
          </ul>
          <p v-if="data.publishedAt" class="mt-2 text-xs text-slate-500">Enviada el {{ formatKickoff(data.publishedAt) }}.</p>
        </section>

        <div v-if="canEdit" class="flex flex-col gap-2">
          <button v-if="data.status !== 'Published'" type="button" class="btn-secondary" v-busy="busy === 'draft'" :disabled="busy !== null || !dirty" @click="save(false)">Guardar borrador</button>
          <button type="button" class="btn-primary" :disabled="busy !== null || called.size === 0 || (data.status === 'Published' && !dirty)" @click="reviewOpen = true">
            <Icon icon="paper-plane" class="mr-1.5 h-3.5 w-3.5" />{{ data.status === 'Published' ? 'Repasar y avisar a quien cambie' : 'Repasar y enviar' }}
          </button>
          <p class="text-xs text-slate-500">
            <template v-if="data.status === 'Published'">Antes de guardar verás quién entra y quién sale: solo reciben aviso ellos (y todos los convocados si cambia la cita); a quien entra o sale se le borra la firma anterior.</template>
            <template v-else>El borrador solo lo ve el cuerpo técnico. Antes de enviarla la repasas; al enviarla, a cada jugador con cuenta le llega el aviso de si va o no y verás quién la ha abierto (doble check verde) y quién la ha firmado.</template>
          </p>
        </div>
      </aside>
    </div>

    <CallUpReviewModal
      :open="reviewOpen"
      :busy="busy === 'publish'"
      :update="data.status === 'Published'"
      :match="data.match"
      :team-id="teamId"
      :meet-at="meetAtIso"
      :ground="chosenGround"
      :place="writtenPlace"
      :notes="meet.notes.trim() || null"
      :groups="reviewGroups"
      :not-called="reviewNotCalled"
      :changes="reviewChanges"
      @close="reviewOpen = false"
      @confirm="save(true)"
    />
  </template>
</template>
