<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import PlayerName from '@/components/players/PlayerName.vue';
import TeamName from '@/components/teams/TeamName.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';
import { useAlertsStore } from '@/stores/alerts';
import type { CallUpRequest, CallUpResponse, MatchCallUpDto } from '@/types/api';
import { opponentOf } from '@/utils/crests';
import { callUpResponseLabels, callUpResponseTone, formatKickoff, positionLabels, toDateKey } from '@/utils/format';

/**
 * La convocatoria de un partido: el cuerpo técnico elige quién va, pone la cita y la publica (se avisa a toda la
 * plantilla, al que va y al que no); cada jugador la firma desde aquí o desde «Mis convocatorias». No hay «no puedo»
 * para los partidos: lo que cambie se habla con el cuerpo técnico, que es quien emite la convocatoria.
 */
const props = defineProps<{ matchId: string }>();

const { squadId, detail } = useSquad();
const alerts = useAlertsStore();

const { data, loading, error, run } = useAsync(() => api.trainings.callUp(squadId.value, props.matchId));
watch(() => props.matchId, () => void run());

const teamId = computed(() => detail.value?.summary.teamId ?? '');
const players = computed(() => detail.value?.players ?? []);
const photos = computed<Record<string, string | null>>(() => Object.fromEntries(players.value.map((p) => [p.id, p.photoUrl])));
const positions = computed<Record<string, string>>(() => Object.fromEntries(players.value.map((p) => [p.id, p.position ? positionLabels[p.position] : ''])));

// Borrador local de lo que el cuerpo técnico está preparando.
const called = ref(new Set<string>());
const meet = ref({ date: '', time: '', place: '', notes: '' });
const busy = ref<'draft' | 'publish' | 'respond' | null>(null);
const actionError = ref<string | null>(null);

function take(dto: MatchCallUpDto) {
  called.value = new Set(dto.entries.filter((e) => e.called).map((e) => e.squadPlayerId));
  const at = dto.meetAt ? new Date(dto.meetAt) : null;
  meet.value = {
    date: at ? toDateKey(at) : '',
    time: at ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '',
    place: dto.meetPlace ?? '',
    notes: dto.notes ?? '',
  };
}
watch(data, (dto) => { if (dto) take(dto); }, { immediate: true });

const canEdit = computed(() => (data.value?.canEdit ?? false) && !(data.value?.closed ?? false));
const dirty = computed(() => {
  if (!data.value) return false;
  const saved = new Set(data.value.entries.filter((e) => e.called).map((e) => e.squadPlayerId));
  if (saved.size !== called.value.size || [...called.value].some((id) => !saved.has(id))) return true;
  const at = data.value.meetAt ? new Date(data.value.meetAt) : null;
  const savedMeet = { date: at ? toDateKey(at) : '', time: at ? `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}` : '', place: data.value.meetPlace ?? '', notes: data.value.notes ?? '' };
  return JSON.stringify(savedMeet) !== JSON.stringify(meet.value);
});

const sorted = computed(() => [...(data.value?.entries ?? [])].sort((a, b) => (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) || a.playerName.localeCompare(b.playerName)));

function toggle(id: string) {
  const next = new Set(called.value);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  called.value = next;
}

function selectAll(on: boolean) {
  called.value = on ? new Set(sorted.value.map((e) => e.squadPlayerId)) : new Set();
}

async function save(publish: boolean) {
  if (!data.value) return;
  if (publish && !data.value.id) {
    const ok = await confirmDialog({ title: 'Publicar la convocatoria', message: `Se avisa a toda la plantilla: ${called.value.size} convocados y el resto como no convocados. Después podrás cambiarla y solo se avisará a quien le cambie.`, confirmLabel: 'Publicar y avisar' });
    if (!ok) return;
  }
  busy.value = publish ? 'publish' : 'draft';
  actionError.value = null;
  try {
    const body: CallUpRequest = {
      calledSquadPlayerIds: [...called.value],
      meetAt: meet.value.date ? new Date(`${meet.value.date}T${meet.value.time || '00:00'}`).toISOString() : null,
      meetPlace: meet.value.place.trim() || null,
      notes: meet.value.notes.trim() || null,
      publish,
    };
    data.value = await api.trainings.saveCallUp(squadId.value, props.matchId, body);
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
        <RouterLink :to="{ name: 'squad-trainings', params: { squadId } }" class="text-xs font-medium text-accent-400 hover:underline"><Icon icon="chevron-left" class="mr-1 inline h-3 w-3" />Entrenamientos y convocatorias</RouterLink>
        <h2 class="mt-1 flex flex-wrap items-center gap-2 text-xl font-semibold text-slate-900">
          Convocatoria · J{{ data.match.matchday }}
          <TeamName prefix="vs" :name="opponentOf(data.match, teamId).name" :crest-url="opponentOf(data.match, teamId).crestUrl" :short-name="opponentOf(data.match, teamId).shortName" :team-id="opponentOf(data.match, teamId).id" size="sm" />
        </h2>
        <p class="text-sm text-slate-500">{{ formatKickoff(data.match.kickoffAt) }}<template v-if="data.match.venue"> · {{ data.match.venue }}</template></p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Badge v-if="data.closed" tone="slate">Partido empezado</Badge>
        <Badge v-else-if="data.status === 'Published'" tone="green">Publicada</Badge>
        <Badge v-else-if="data.id" tone="amber">Borrador</Badge>
        <Badge v-else tone="slate">Sin preparar</Badge>
        <RouterLink :to="{ name: 'sheet', params: { squadId, matchId }, query: { tab: 'previa' } }" class="btn-secondary px-3 py-1.5 text-xs"><Icon icon="chart-line" class="mr-1.5 h-3 w-3" />Previa del partido</RouterLink>
      </div>
    </div>

    <Alert v-if="actionError" kind="error" class="mb-4">{{ actionError }}</Alert>

    <!-- La línea del jugador que mira -->
    <section v-if="data.mine" class="card mb-6" :class="data.mine.called ? 'border-brand-500/50' : ''">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-lg font-semibold text-slate-900">{{ data.mine.called ? 'Vas convocado' : 'No vas convocado' }}</p>
          <p class="text-sm text-slate-600">
            <template v-if="data.mine.called && data.meetAt">Cita: {{ formatKickoff(data.meetAt) }}<template v-if="data.meetPlace"> en {{ data.meetPlace }}</template>.</template>
            <template v-else-if="data.mine.called">El cuerpo técnico no ha puesto hora de cita.</template>
            <template v-else>Esta vez el cuerpo técnico no cuenta contigo para el partido.</template>
          </p>
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

    <div class="grid gap-6 lg:grid-cols-[1fr_18rem]">
      <!-- Jugadores -->
      <section>
        <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 class="text-sm font-semibold uppercase tracking-wide text-slate-500">Plantilla <span class="font-normal normal-case text-slate-400">· {{ called.size }} convocados</span></h3>
          <div v-if="canEdit" class="flex gap-1 text-xs">
            <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="selectAll(true)">Todos</button>
            <button type="button" class="btn-ghost px-2 py-1 text-xs" @click="selectAll(false)">Ninguno</button>
          </div>
        </div>
        <p v-if="!data.id && !canEdit" class="text-sm text-slate-500">El cuerpo técnico todavía no ha publicado la convocatoria de este partido.</p>
        <ul v-else class="divide-y divide-line rounded-lg border border-line">
          <li v-for="e in sorted" :key="e.squadPlayerId" class="flex flex-wrap items-center gap-2 px-3 py-2 text-sm" :class="called.has(e.squadPlayerId) ? 'bg-brand-500/5' : ''">
            <label v-if="canEdit" class="flex shrink-0 cursor-pointer items-center">
              <input type="checkbox" class="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-400" :checked="called.has(e.squadPlayerId)" :aria-label="`Convocar a ${e.playerName}`" @change="toggle(e.squadPlayerId)" />
            </label>
            <Icon v-else-if="e.called" icon="check" class="h-4 w-4 shrink-0 text-brand-500" aria-label="Convocado" />
            <span v-else class="w-4 shrink-0"></span>
            <span class="w-7 shrink-0 text-center text-xs tabular-nums text-slate-400">{{ e.shirtNumber ?? '' }}</span>
            <PlayerName :name="e.playerName" :photo-url="photos[e.squadPlayerId] ?? null" class="min-w-0 flex-1 basis-40" />
            <span class="hidden text-xs text-slate-500 sm:inline">{{ positions[e.squadPlayerId] }}</span>
            <template v-if="data.status === 'Published'">
              <Badge v-if="e.called" :tone="callUpResponseTone[e.response]">{{ callUpResponseLabels[e.response] }}</Badge>
              <Badge v-else-if="e.response === 'Acknowledged'" tone="slate">Enterado</Badge>
              <Badge v-else-if="e.linked" tone="slate">No va</Badge>
            </template>
            <span v-if="!e.linked" class="text-xs text-slate-400" title="Sin cuenta en la app: no recibe el aviso">sin cuenta</span>
          </li>
        </ul>
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
            <input id="cu-place" v-model="meet.place" type="text" maxlength="150" class="input" placeholder="Puerta del campo, autobús…" />
            <label class="label mt-2" for="cu-notes">Notas</label>
            <textarea id="cu-notes" v-model="meet.notes" rows="3" maxlength="1000" class="input" placeholder="Equipación, comida, qué llevar…"></textarea>
          </template>
          <template v-else>
            <p v-if="data.meetAt" class="text-sm text-slate-700">{{ formatKickoff(data.meetAt) }}<template v-if="data.meetPlace"> · {{ data.meetPlace }}</template></p>
            <p v-else class="text-sm text-slate-500">Sin hora de cita.</p>
            <p v-if="data.notes" class="mt-1 whitespace-pre-line text-sm text-slate-700">{{ data.notes }}</p>
          </template>
        </section>

        <section v-if="data.status === 'Published'" class="card text-sm">
          <h3 class="mb-2 font-semibold text-slate-900">Firmas</h3>
          <ul class="space-y-1">
            <li class="flex justify-between"><span class="text-slate-600">Convocados que han firmado</span><strong class="tabular-nums text-emerald-600">{{ data.counts.confirmed }}</strong></li>
            <li class="flex justify-between"><span class="text-slate-600">Sin firmar</span><strong class="tabular-nums text-amber-600">{{ data.counts.pending }}</strong></li>
            <li class="flex justify-between"><span class="text-slate-600">No convocados enterados</span><strong class="tabular-nums text-slate-700">{{ data.counts.acknowledged }}</strong></li>
          </ul>
          <p v-if="data.publishedAt" class="mt-2 text-xs text-slate-500">Publicada el {{ formatKickoff(data.publishedAt) }}.</p>
        </section>

        <div v-if="canEdit" class="flex flex-col gap-2">
          <button v-if="data.status !== 'Published'" type="button" class="btn-secondary" v-busy="busy === 'draft'" :disabled="busy !== null || !dirty" @click="save(false)">Guardar borrador</button>
          <button type="button" class="btn-primary" v-busy="busy === 'publish'" :disabled="busy !== null || called.size === 0 || (data.status === 'Published' && !dirty)" @click="save(true)">
            <Icon icon="bell" class="mr-1.5 h-3.5 w-3.5" />{{ data.status === 'Published' ? 'Guardar y avisar a quien cambie' : 'Publicar y avisar a la plantilla' }}
          </button>
          <p class="text-xs text-slate-500">
            <template v-if="data.status === 'Published'">Al guardar, solo reciben aviso los jugadores que entran o salen de la convocatoria; su firma anterior se borra.</template>
            <template v-else>El borrador solo lo ve el cuerpo técnico. Al publicar, cada jugador con cuenta recibe el aviso de si va o no y la firma desde la app.</template>
          </p>
        </div>
      </aside>
    </div>
  </template>
</template>
