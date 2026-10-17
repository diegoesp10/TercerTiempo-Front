<script setup lang="ts">
import { computed } from 'vue';
import { api } from '@/api';
import MatchRow from '@/components/matches/MatchRow.vue';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Spinner from '@/components/ui/Spinner.vue';
import { useAsync } from '@/composables/useAsync';
import { useSquad } from '@/composables/useSquad';

const { squadId, detail } = useSquad();

const { data, loading, error } = useAsync(() => api.squads.matches(squadId.value));

const teamId = computed(() => detail.value?.summary.teamId ?? '');
const canManage = computed(() => detail.value?.canManage ?? false);

const played = computed(() => (data.value ?? []).filter((m) => m.match.status === 'Played').reverse());
const upcoming = computed(() => (data.value ?? []).filter((m) => m.match.status !== 'Played'));
const pending = computed(() => played.value.filter((m) => m.entriesRecorded === 0).length);
</script>

<template>
  <Spinner v-if="loading" />
  <Alert v-else-if="error" kind="error">{{ error }}</Alert>

  <template v-else-if="data">
    <Alert v-if="canManage && pending > 0" kind="warning" class="mb-4">
      <strong>{{ pending }}</strong> {{ pending === 1 ? 'partido disputado sin acta' : 'partidos disputados sin acta' }}. Entra en cada uno para registrarla.
    </Alert>

    <section class="mb-8">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Disputados</h2>
      <p v-if="played.length === 0" class="text-sm text-slate-500">Aún no se ha disputado ningún partido.</p>
      <div v-else class="space-y-2">
        <MatchRow
          v-for="item in played"
          :key="item.match.id"
          :match="item.match"
          :team-id="teamId"
          :to="{ name: 'sheet', params: { squadId, matchId: item.match.id } }"
        >
          <template #badge>
            <Badge v-if="item.entriesRecorded > 0" tone="blue">{{ item.entriesRecorded }} en el acta</Badge>
            <Badge v-else-if="canManage" tone="amber">Sin acta</Badge>
          </template>
        </MatchRow>
      </div>
    </section>

    <section>
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Próximos</h2>
      <p v-if="upcoming.length === 0" class="text-sm text-slate-500">No quedan partidos programados.</p>
      <div v-else class="space-y-2">
        <MatchRow v-for="item in upcoming" :key="item.match.id" :match="item.match" :team-id="teamId" />
      </div>
    </section>
  </template>
</template>
