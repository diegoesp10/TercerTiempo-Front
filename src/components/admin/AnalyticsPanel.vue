<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import Spinner from '@/components/ui/Spinner.vue';
import TeamName from '@/components/teams/TeamName.vue';
import type { AnalyticsCountDto, AnalyticsEntity, AnalyticsReportDto, ClubScope } from '@/types/api';

/**
 * Uso de la web, de la analítica propia (solo visitantes que la aceptaron): visitas, páginas, búsquedas y clics, lo
 * más visto, quién usa la web y, por club, lo que hacen sus usuarios o las visitas a sus páginas.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const iso = (d: Date) => d.toISOString().slice(0, 10);
const to = ref(iso(new Date()));
const from = ref(iso(new Date(Date.now() - 29 * 86_400_000)));
const clubId = ref<string | null>(null);
const scope = ref<ClubScope>('Subject');

const data = ref<AnalyticsReportDto | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);

async function load() {
  loading.value = true;
  try {
    data.value = await adminApi.analytics(props.token, from.value, to.value, clubId.value, scope.value);
    error.value = null;
  } catch (e) {
    if ((e as { status?: number }).status === 401) emit('unauthorized');
    else error.value = errorMessage(e);
  } finally {
    loading.value = false;
  }
}

watch([from, to, clubId, scope], () => void load());
onMounted(load);

const pageLabels: Record<string, string> = {
  home: 'Portada', teams: 'Equipos', team: 'Ficha de equipo', league: 'Liga y clasificación', match: 'Partido',
  squad: 'Plantilla', 'squad-matches': 'Partidos de la plantilla', 'squad-stats': 'Estadísticas', 'squad-compare': 'Comparador',
  'squad-player': 'Ficha de jugador', sheet: 'Acta del partido', login: 'Entrar', register: 'Alta', join: 'Unirse a una plantilla',
  redeem: 'Canjear código', licenses: 'Licencias', 'license-checkout': 'Pago de licencia', settings: 'Ajustes',
  'shared-video': 'Vídeo compartido', privacy: 'Privacidad', terms: 'Condiciones', cookies: 'Cookies', jobs: 'Administración',
};
const actorLabels: Record<string, string> = { Anonymous: 'Sin cuenta', Player: 'Jugadores', Coach: 'Cuerpos técnicos', Club: 'Clubes' };
const entityLabels: Record<AnalyticsEntity, string> = { Team: 'Equipo', Club: 'Club', Competition: 'Liga', Match: 'Partido', Squad: 'Plantilla' };

const pageName = (row: AnalyticsCountDto) => pageLabels[row.key] ?? row.label;
// Todos los días del periodo, también los que no tuvieron visitas, para que la gráfica se lea de un vistazo.
const allDays = computed(() => {
  if (!data.value) return [];
  const byDay = new Map(data.value.days.map((d) => [d.day, d]));
  const result: { day: string; pageViews: number; visitors: number }[] = [];
  for (let d = new Date(`${data.value.from}T00:00:00Z`); iso(d) <= data.value.to; d = new Date(d.getTime() + 86_400_000)) {
    result.push(byDay.get(iso(d)) ?? { day: iso(d), pageViews: 0, visitors: 0 });
  }
  return result;
});
const maxDay = computed(() => Math.max(1, ...allDays.value.map((d) => d.pageViews)));
const consentRate = computed(() => {
  const c = data.value?.consents;
  return c && c.total ? Math.round((c.withAnalytics / c.total) * 100) : null;
});
const clubOptions = computed(() => (data.value?.clubs ?? []).map((c) => ({ value: c.clubId, label: c.name })));
const shortDay = (day: string) => new Date(`${day}T00:00:00`).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
</script>

<template>
  <section class="space-y-6">
    <div class="card flex flex-wrap items-end gap-3">
      <label class="w-40">
        <span class="label">Desde</span>
        <input v-model="from" type="date" class="input" :max="to" />
      </label>
      <label class="w-40">
        <span class="label">Hasta</span>
        <input v-model="to" type="date" class="input" :min="from" />
      </label>
      <div class="min-w-64 flex-1">
        <span class="label">Club</span>
        <SearchSelect id="analytics-club" placeholder="Toda la web" :model-value="clubId" :options="clubOptions" clearable @update:model-value="clubId = ($event as string | null)" />
      </div>
      <div v-if="clubId" class="flex gap-1 rounded-lg border border-line p-1 text-sm" role="radiogroup">
        <button type="button" class="rounded-md px-3 py-1" :class="scope === 'Subject' ? 'bg-brand-500 text-white' : 'text-slate-600'" @click="scope = 'Subject'">Visitas a sus páginas</button>
        <button type="button" class="rounded-md px-3 py-1" :class="scope === 'Actor' ? 'bg-brand-500 text-white' : 'text-slate-600'" @click="scope = 'Actor'">Lo que hacen sus usuarios</button>
      </div>
    </div>

    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <Spinner v-if="loading && !data" />

    <template v-if="data">
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div v-for="kpi in [
          { label: 'Páginas vistas', value: data.totals.pageViews },
          { label: 'Visitantes', value: data.totals.visitors },
          { label: 'Visitas', value: data.totals.sessions },
          { label: 'Búsquedas', value: data.totals.searches },
          { label: 'Clics', value: data.totals.clicks },
        ]" :key="kpi.label" class="card">
          <p class="text-xs uppercase tracking-wide text-slate-500">{{ kpi.label }}</p>
          <p class="mt-1 font-display text-3xl font-bold tabular-nums text-slate-900">{{ kpi.value.toLocaleString('es-ES') }}</p>
        </div>
      </div>

      <section class="card">
        <h3 class="mb-3 font-semibold text-slate-900">Páginas vistas por día</h3>
        <p v-if="data.days.length === 0" class="text-sm text-slate-500">Sin visitas medidas en estas fechas (solo cuentan quienes aceptan la analítica).</p>
        <div v-else class="flex h-40 items-end gap-1 overflow-x-auto">
          <div v-for="(day, i) in allDays" :key="day.day" class="flex min-w-3 flex-1 flex-col items-center justify-end gap-1" :title="`${shortDay(day.day)}: ${day.pageViews} páginas, ${day.visitors} visitantes`">
            <div class="w-full max-w-8 rounded-t bg-brand-500" :style="{ height: `${Math.max(day.pageViews ? 3 : 1, (day.pageViews / maxDay) * 120)}px`, opacity: day.pageViews ? 1 : 0.25 }" />
            <span class="h-3 text-[10px] text-slate-500">{{ i % Math.ceil(allDays.length / 10) === 0 ? shortDay(day.day) : '' }}</span>
          </div>
        </div>
      </section>

      <div class="grid gap-6 lg:grid-cols-3">
        <section class="card">
          <h3 class="mb-2 font-semibold text-slate-900">Páginas más vistas</h3>
          <ol class="space-y-1 text-sm">
            <li v-for="row in data.pages" :key="row.key" class="flex justify-between gap-2"><span class="truncate">{{ pageName(row) }}</span><span class="tabular-nums text-slate-500">{{ row.count }}</span></li>
            <li v-if="data.pages.length === 0" class="text-slate-400">—</li>
          </ol>
        </section>
        <section class="card">
          <h3 class="mb-2 font-semibold text-slate-900">Lo más buscado</h3>
          <ol class="space-y-1 text-sm">
            <li v-for="row in data.searches" :key="row.key" class="flex justify-between gap-2"><span class="truncate">«{{ row.label }}»</span><span class="tabular-nums text-slate-500">{{ row.count }}</span></li>
            <li v-if="data.searches.length === 0" class="text-slate-400">—</li>
          </ol>
        </section>
        <section class="card">
          <h3 class="mb-2 font-semibold text-slate-900">Lo más pulsado</h3>
          <ol class="space-y-1 text-sm">
            <li v-for="row in data.clicks" :key="row.key" class="flex justify-between gap-2"><span class="truncate">{{ row.label }}</span><span class="tabular-nums text-slate-500">{{ row.count }}</span></li>
            <li v-if="data.clicks.length === 0" class="text-slate-400">—</li>
          </ol>
        </section>
      </div>

      <div class="grid gap-6 lg:grid-cols-2">
        <section class="card">
          <h3 class="mb-2 font-semibold text-slate-900">Equipos, ligas y partidos más vistos</h3>
          <ol class="space-y-1.5 text-sm">
            <li v-for="row in data.entities" :key="`${row.type}-${row.id}`" class="flex items-center justify-between gap-2">
              <span class="min-w-0">
                <TeamName v-if="row.crestUrl || row.type === 'Team'" :name="row.name" :crest-url="row.crestUrl" :team-id="row.type === 'Team' ? row.id : null" />
                <span v-else class="truncate">{{ row.name }}</span>
                <span class="ml-1 text-xs text-slate-400">{{ entityLabels[row.type] }}</span>
              </span>
              <span class="shrink-0 tabular-nums text-slate-500">{{ row.count }} · {{ row.visitors }} pers.</span>
            </li>
            <li v-if="data.entities.length === 0" class="text-slate-400">—</li>
          </ol>
        </section>
        <section class="card space-y-4">
          <div>
            <h3 class="mb-2 font-semibold text-slate-900">Quién usa la web</h3>
            <ol class="space-y-1 text-sm">
              <li v-for="row in data.actors" :key="row.key" class="flex justify-between gap-2"><span>{{ actorLabels[row.key] ?? row.key }}</span><span class="tabular-nums text-slate-500">{{ row.count }} · {{ row.visitors }} pers.</span></li>
              <li v-if="data.actors.length === 0" class="text-slate-400">—</li>
            </ol>
          </div>
          <div>
            <h3 class="mb-2 font-semibold text-slate-900">Cookies elegidas en estas fechas</h3>
            <p class="text-sm text-slate-600">
              {{ data.consents.total }} elecciones: {{ data.consents.acceptAll }} aceptan todo, {{ data.consents.rejectAll }} rechazan,
              {{ data.consents.custom }} configuran<template v-if="consentRate !== null"> · un {{ consentRate }} % permite la analítica</template>.
            </p>
          </div>
        </section>
      </div>

      <div v-if="!clubId" class="grid gap-6 lg:grid-cols-2">
        <section class="card">
          <h3 class="mb-2 font-semibold text-slate-900">Clubes más activos <span class="text-xs font-normal text-slate-500">(sus usuarios)</span></h3>
          <ol class="space-y-1.5 text-sm">
            <li v-for="row in data.activeClubs" :key="row.clubId" class="flex items-center justify-between gap-2">
              <TeamName :name="row.name" :crest-url="row.crestUrl" />
              <span class="shrink-0 tabular-nums text-slate-500">{{ row.count }} · {{ row.visitors }} pers.</span>
            </li>
            <li v-if="data.activeClubs.length === 0" class="text-slate-400">—</li>
          </ol>
        </section>
        <section class="card">
          <h3 class="mb-2 font-semibold text-slate-900">Clubes más visitados <span class="text-xs font-normal text-slate-500">(sus páginas)</span></h3>
          <ol class="space-y-1.5 text-sm">
            <li v-for="row in data.viewedClubs" :key="row.clubId" class="flex items-center justify-between gap-2">
              <TeamName :name="row.name" :crest-url="row.crestUrl" />
              <span class="shrink-0 tabular-nums text-slate-500">{{ row.count }} · {{ row.visitors }} pers.</span>
            </li>
            <li v-if="data.viewedClubs.length === 0" class="text-slate-400">—</li>
          </ol>
        </section>
      </div>

      <p class="text-xs text-slate-500">
        Solo se mide a quien acepta la analítica en el aviso de cookies; sin IP y con un identificador aleatorio. Los datos se borran a los 13 meses.
      </p>
    </template>
  </section>
</template>
