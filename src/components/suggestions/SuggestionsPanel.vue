<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { api } from '@/api';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { SuggestionDto } from '@/types/api';
import { formatKickoff, suggestionStatusLabels, suggestionStatusTone } from '@/utils/format';
import TeamName from '@/components/teams/TeamName.vue';
import PlayerName from '@/components/players/PlayerName.vue';
import { opponentOf } from '@/utils/crests';

/**
 * Sugerencias de los jugadores sobre sus líneas del acta, para el club y el cuerpo técnico: cada una muestra lo que
 * hay en el acta frente a lo que propone el jugador y su mensaje; se aprueban (se escriben en el acta) o se rechazan.
 */
const props = defineProps<{ squadId: string; teamId: string }>();
const emit = defineEmits<{ changed: [] }>();

const suggestions = shallowRef<SuggestionDto[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const busy = ref<string | null>(null);
const notes = ref<Record<string, string>>({});
const showResolved = ref(false);

async function load() {
  loading.value = true;
  error.value = null;
  try {
    suggestions.value = await api.squads.suggestions(props.squadId);
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}
onMounted(load);
watch(() => props.squadId, load);

const pending = computed(() => suggestions.value.filter((s) => s.status === 'Pending'));
const resolved = computed(() => suggestions.value.filter((s) => s.status !== 'Pending'));

const columns: { key: 'minutesPlayed' | 'goals' | 'assists' | 'shots' | 'shotsOnTarget' | 'keyPasses' | 'tackles' | 'interceptions' | 'saves' | 'yellowCards'; label: string }[] = [
  { key: 'minutesPlayed', label: 'Min' },
  { key: 'goals', label: 'G' },
  { key: 'assists', label: 'A' },
  { key: 'shots', label: 'T' },
  { key: 'shotsOnTarget', label: 'TP' },
  { key: 'keyPasses', label: 'PC' },
  { key: 'tackles', label: 'Ent' },
  { key: 'interceptions', label: 'Int' },
  { key: 'saves', label: 'Par' },
  { key: 'yellowCards', label: 'TA' },
];

const differs = (s: SuggestionDto, key: (typeof columns)[number]['key']) => !s.current || s.current[key] !== s.proposed[key];

async function resolve(s: SuggestionDto, approve: boolean) {
  const ok = await confirmDialog({
    title: approve ? 'Aprobar la sugerencia' : 'Rechazar la sugerencia',
    message: approve
      ? `La línea de ${s.player.fullName} en este partido se escribirá en el acta tal y como la propone.`
      : `${s.player.fullName} verá que su sugerencia se ha rechazado, con tu nota si la escribes.`,
    confirmLabel: approve ? 'Aprobar' : 'Rechazar',
    danger: !approve,
  });
  if (!ok) return;
  busy.value = s.id;
  error.value = null;
  try {
    suggestions.value = await api.squads.resolveSuggestion(props.squadId, s.id, { approve, note: notes.value[s.id]?.trim() || null });
    delete notes.value[s.id];
    emit('changed');
  } catch (e) {
    error.value = errorMessage(e);
  } finally {
    busy.value = null;
  }
}
</script>

<template>
  <section class="card">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 class="font-semibold text-slate-900">
          Sugerencias de los jugadores
          <Badge v-if="pending.length" tone="amber" class="ml-2">{{ pending.length }} pendiente{{ pending.length === 1 ? '' : 's' }}</Badge>
        </h2>
        <p class="text-xs text-slate-500">Lo que cada jugador propone corregir o añadir en su línea del acta. Al aprobar, se escribe en el acta.</p>
      </div>
      <button v-if="resolved.length" type="button" class="btn-ghost px-3 py-1 text-xs" @click="showResolved = !showResolved">
        {{ showResolved ? 'Ocultar resueltas' : `Ver resueltas (${resolved.length})` }}
      </button>
    </div>

    <Alert v-if="error" kind="error" class="mt-3">{{ error }}</Alert>
    <Spinner v-if="loading" class="my-6" />
    <p v-else-if="suggestions.length === 0" class="mt-3 text-sm text-slate-500">Ningún jugador ha enviado sugerencias todavía.</p>

    <ul v-else class="mt-4 space-y-4">
      <li v-for="s in showResolved ? suggestions : pending" :key="s.id" class="rounded-xl border border-line bg-surface-2 p-4">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="font-semibold text-slate-900">
              <PlayerName :name="s.player.fullName" :photo-url="s.player.photoUrl" size="sm" />
              <span class="font-normal text-slate-500">ha sugerido {{ s.current ? 'una corrección' : 'una entrada nueva' }}</span>
            </p>
            <p class="text-xs text-slate-500">
              <RouterLink :to="{ name: 'sheet', params: { squadId, matchId: s.match.id }, query: { tab: 'interna' } }" class="hover:underline">J{{ s.match.matchday }} · <TeamName prefix="vs" :name="opponentOf(s.match, teamId).name" :crest-url="opponentOf(s.match, teamId).crestUrl" /></RouterLink>
              · {{ formatKickoff(s.match.kickoffAt) }} · enviada el {{ formatKickoff(s.createdAt) }}
            </p>
          </div>
          <Badge :tone="suggestionStatusTone[s.status]">{{ suggestionStatusLabels[s.status] }}</Badge>
        </div>

        <blockquote v-if="s.message" class="mt-3 border-l-2 border-brand-500 pl-3 text-sm text-slate-700">“{{ s.message }}”</blockquote>

        <div class="mt-3 overflow-x-auto">
          <table class="min-w-full text-xs">
            <thead class="text-slate-500">
              <tr>
                <th class="py-1 pr-3 text-left"></th>
                <th class="px-2 py-1 text-center">Tit</th>
                <th v-for="c in columns" :key="c.key" class="px-2 py-1 text-center">{{ c.label }}</th>
                <th class="px-2 py-1 text-center">TR</th>
              </tr>
            </thead>
            <tbody class="tabular-nums">
              <tr class="text-slate-500">
                <td class="py-1 pr-3 font-medium">En el acta</td>
                <template v-if="s.current">
                  <td class="px-2 py-1 text-center">{{ s.current.started ? '●' : '—' }}</td>
                  <td v-for="c in columns" :key="c.key" class="px-2 py-1 text-center">{{ s.current[c.key] }}</td>
                  <td class="px-2 py-1 text-center">{{ s.current.redCard ? 'Sí' : '—' }}</td>
                </template>
                <td v-else :colspan="columns.length + 2" class="px-2 py-1 text-center italic">sin línea</td>
              </tr>
              <tr class="font-semibold text-slate-900">
                <td class="py-1 pr-3">Propone</td>
                <td class="px-2 py-1 text-center" :class="{ 'text-brand-500': !s.current || s.current.started !== s.proposed.started }">{{ s.proposed.started ? '●' : '—' }}</td>
                <td v-for="c in columns" :key="c.key" class="px-2 py-1 text-center" :class="{ 'text-brand-500': differs(s, c.key) }">{{ s.proposed[c.key] }}</td>
                <td class="px-2 py-1 text-center" :class="{ 'text-brand-500': !s.current || s.current.redCard !== s.proposed.redCard }">{{ s.proposed.redCard ? 'Sí' : '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="s.status === 'Pending'" class="mt-3 flex flex-wrap items-end gap-2">
          <div class="min-w-56 flex-1">
            <label class="label" :for="`note-${s.id}`">Nota para el jugador <span class="font-normal text-slate-400">(opcional)</span></label>
            <input :id="`note-${s.id}`" v-model="notes[s.id]" type="text" maxlength="500" class="input" placeholder="Por ejemplo: «Revisado con el vídeo, tienes razón»." />
          </div>
          <button type="button" class="btn-primary" v-busy="busy === s.id" :disabled="busy !== null" @click="resolve(s, true)"><Icon icon="check" class="mr-1.5 h-3.5 w-3.5" />Aprobar</button>
          <button type="button" class="btn-secondary text-red-600" v-busy="busy === s.id" :disabled="busy !== null" @click="resolve(s, false)"><Icon icon="xmark" class="mr-1.5 h-3.5 w-3.5" />Rechazar</button>
        </div>
        <p v-else class="mt-3 text-xs text-slate-500">
          {{ s.status === 'Approved' ? 'Aprobada' : 'Rechazada' }} por {{ s.resolvedBy ?? 'el cuerpo técnico' }} el {{ s.resolvedAt ? formatKickoff(s.resolvedAt) : '' }}<template v-if="s.resolutionNote">: “{{ s.resolutionNote }}”</template>.
        </p>
      </li>
    </ul>
  </section>
</template>
