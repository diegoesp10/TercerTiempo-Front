<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';
import type { ChoiceOption } from '@/components/ui/choice';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect from '@/components/ui/SearchSelect.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useSort } from '@/composables/useSort';
import type { AdminBodySiteDto, AdminInjuryTypeDto, BodySiteKind, SaveInjuryTypeRequest } from '@/types/api';
import { fitsKind, kindLabels, kindOrder, kindQuestions, regionLabels, regionOrder, siteSelectOptions } from '@/utils/injuryAnatomy';

/**
 * Catálogo de tipos de lesión: lo que elige el cuerpo técnico al registrar una lesión, la duración media con la que se
 * propone la vuelta y lo que se pregunta de ella: un sitio fijo (el tobillo del esguince de tobillo) con lo que lo precisa,
 * o una clase de sitio (qué músculo, qué hueso...), y si lleva grado. Un tipo que ya tiene lesiones no se borra (la base
 * de datos tampoco lo deja): se retira, deja de ofrecerse y las lesiones que lo tienen lo conservan.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const MAX_SITES = 60;

type Asks = 'none' | 'kind' | 'base';

const types = ref<AdminInjuryTypeDto[]>([]);
const sites = ref<AdminBodySiteDto[]>([]);
const loaded = ref(false);
const error = ref<string | null>(null);
const formError = ref<string | null>(null);
const notice = ref<string | null>(null);
const busy = ref(false);
const editing = ref<AdminInjuryTypeDto | null>(null);
const formOpen = ref(false);
const siteFilter = ref('');
const form = reactive<{
  label: string;
  averageDays: number | null;
  sortOrder: number;
  active: boolean;
  asks: Asks;
  siteKind: BodySiteKind;
  baseSite: string | null;
  sites: string[];
  graded: boolean;
}>({ label: '', averageDays: null, sortOrder: 50, active: true, asks: 'none', siteKind: 'Muscle', baseSite: null, sites: [], graded: false });

type SortKey = 'order' | 'label' | 'days' | 'asks' | 'injuries' | 'state';
const { sorted, sortBy, state } = useSort<AdminInjuryTypeDto, SortKey>(
  types,
  {
    order: (t) => t.sortOrder,
    label: (t) => t.label,
    days: (t) => t.averageDays ?? -1,
    asks: (t) => question(t),
    injuries: (t) => t.injuries,
    state: (t) => (t.active ? 0 : 1),
  },
  'order',
  { desc: false, ascendingFirst: ['order', 'label', 'asks', 'state'] },
);

const offered = computed(() => types.value.filter((t) => t.active).length);
const siteByCode = computed(() => new Map(sites.value.map((s) => [s.code, s])));
const siteLabel = (code: string) => siteByCode.value.get(code)?.label ?? code;

// Lo que pregunta, en la tabla: «¿Qué músculo?», «Tobillo · 4 para precisar»...
function question(t: AdminInjuryTypeDto) {
  if (t.baseSite) return t.sites.length ? `${siteLabel(t.baseSite)} · ${t.sites.length} para precisar` : siteLabel(t.baseSite);
  if (t.siteKind) return t.sites.length ? `${kindQuestions[t.siteKind]} · solo ${t.sites.length}` : kindQuestions[t.siteKind];
  return 'No pregunta dónde fue';
}

const asksOptions: ChoiceOption<Asks>[] = [
  { value: 'kind', label: 'Una clase de sitio' },
  { value: 'base', label: 'Un sitio fijo' },
  { value: 'none', label: 'Nada' },
];
const kindOptions: ChoiceOption<BodySiteKind>[] = kindOrder.map((k) => ({ value: k, label: kindLabels[k] }));
const baseOptions = computed(() => siteSelectOptions(sites.value.filter((s) => s.active || s.code === form.baseSite), sites.value));

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Los que se pueden poner en la lista: con clase, los de la clase; con sitio fijo, cualquiera menos él. Los retirados solo
// si ya estaban.
const candidates = computed(() =>
  sites.value.filter((s) => {
    if (!s.active && !form.sites.includes(s.code)) return false;
    if (form.asks === 'kind') return fitsKind(form.siteKind, s.kind);
    if (form.asks === 'base') return s.code !== form.baseSite;
    return false;
  }),
);
const candidateGroups = computed(() => {
  const needle = normalize(siteFilter.value.trim());
  const list = needle
    ? candidates.value.filter((s) => normalize(`${s.label} ${kindLabels[s.kind]} ${regionLabels[s.region]}`).includes(needle))
    : candidates.value;
  return regionOrder
    .map((region) => ({ region, label: regionLabels[region], sites: list.filter((s) => s.region === region) }))
    .filter((g) => g.sites.length > 0);
});

function toggleSite(code: string, on: boolean) {
  form.sites = on ? [...form.sites, code] : form.sites.filter((c) => c !== code);
}

// Al cambiar lo que pregunta se quita de la lista lo que ya no encaja (el servidor no lo aceptaría).
function chooseAsks(asks: Asks) {
  form.asks = asks;
  fitSites();
}
function chooseKind(kind: BodySiteKind) {
  form.siteKind = kind;
  fitSites();
}
function chooseBase(code: string | null) {
  form.baseSite = code;
  fitSites();
}
function fitSites() {
  const allowed = new Set(candidates.value.map((s) => s.code));
  form.sites = form.asks === 'none' ? [] : form.sites.filter((c) => allowed.has(c));
}

const listHelp = computed(() =>
  form.asks === 'base'
    ? 'Lo que lo precisa, si el médico lo sabe (los ligamentos del tobillo, los meniscos...). Vacía: solo el sitio fijo.'
    : `Solo estos se ofrecen. Vacía: todos los de la clase (${kindLabels[form.siteKind].toLowerCase()}${form.siteKind === 'Zone' ? ', con las articulaciones' : ''}).`,
);

const formBlocked = computed(() => {
  if (busy.value) return 'Espera a que termine lo que se está guardando';
  if (!form.label.trim()) return 'Escribe el nombre del tipo';
  if (form.asks === 'base' && !form.baseSite) return 'Elige el sitio fijo';
  if (form.sites.length > MAX_SITES) return `Como mucho ${MAX_SITES} sitios en la lista`;
  return undefined;
});

async function guard<T>(action: () => Promise<T>, inForm = false): Promise<T | undefined> {
  busy.value = true;
  try {
    error.value = null;
    formError.value = null;
    return await action();
  } catch (e) {
    if ((e as { status?: number }).status === 401) emit('unauthorized');
    else if (inForm) formError.value = errorMessage(e);
    else error.value = errorMessage(e);
    return undefined;
  } finally {
    busy.value = false;
  }
}

async function load() {
  const result = await guard(() => Promise.all([adminApi.injuryTypes(props.token), adminApi.bodySites(props.token)]));
  if (result) [types.value, sites.value] = result;
  loaded.value = true;
}

function openForm(type: AdminInjuryTypeDto | null) {
  editing.value = type;
  formError.value = null;
  siteFilter.value = '';
  const next = Math.max(0, ...types.value.map((t) => t.sortOrder)) + 1;
  Object.assign(
    form,
    type
      ? {
          label: type.label,
          averageDays: type.averageDays,
          sortOrder: type.sortOrder,
          active: type.active,
          asks: type.baseSite ? 'base' : type.siteKind ? 'kind' : 'none',
          siteKind: type.siteKind ?? 'Muscle',
          baseSite: type.baseSite,
          sites: [...type.sites],
          graded: type.graded,
        }
      : { label: '', averageDays: null, sortOrder: Math.min(next, 1000), active: true, asks: 'kind', siteKind: 'Zone', baseSite: null, sites: [], graded: false },
  );
  formOpen.value = true;
}

// Un campo numérico vacío llega como '' (o null): sin duración media.
const days = (value: number | null) => (value === null || (value as unknown) === '' ? null : Number(value));

function body(): SaveInjuryTypeRequest {
  return {
    label: form.label.trim(),
    averageDays: days(form.averageDays),
    sortOrder: Number(form.sortOrder) || 0,
    active: form.active,
    siteKind: form.asks === 'kind' ? form.siteKind : null,
    baseSite: form.asks === 'base' ? form.baseSite : null,
    sites: form.asks === 'none' ? [] : form.sites,
    graded: form.graded,
  };
}

// Retirar o volver a ofrecer sin tocar lo demás.
const bodyOf = (type: AdminInjuryTypeDto, active: boolean): SaveInjuryTypeRequest => ({
  label: type.label,
  averageDays: type.averageDays,
  sortOrder: type.sortOrder,
  active,
  siteKind: type.siteKind,
  baseSite: type.baseSite,
  sites: type.sites,
  graded: type.graded,
});

async function save() {
  if (formBlocked.value) return;
  const request = body();
  const result = await guard(
    () => (editing.value ? adminApi.updateInjuryType(props.token, editing.value.code, request) : adminApi.createInjuryType(props.token, request)),
    true,
  );
  if (result) {
    types.value = result;
    formOpen.value = false;
    notice.value = editing.value ? `«${request.label}» guardado.` : `«${request.label}» añadido al catálogo.`;
  }
}

async function toggle(type: AdminInjuryTypeDto) {
  if (
    type.active &&
    !(await confirmDialog({
      title: `Retirar «${type.label}»`,
      message:
        type.injuries > 0
          ? `Deja de ofrecerse al registrar lesiones. Las ${type.injuries} lesiones que ya lo tienen lo conservan.`
          : 'Deja de ofrecerse al registrar lesiones. Puedes volver a ofrecerlo cuando quieras.',
      confirmLabel: 'Retirar',
    }))
  )
    return;
  const result = await guard(() => adminApi.updateInjuryType(props.token, type.code, bodyOf(type, !type.active)));
  if (result) {
    types.value = result;
    notice.value = type.active ? `«${type.label}» retirado.` : `«${type.label}» se vuelve a ofrecer.`;
  }
}

async function remove(type: AdminInjuryTypeDto) {
  if (
    !(await confirmDialog({
      title: `Borrar «${type.label}»`,
      message: 'Sale del catálogo para siempre. Ninguna lesión lo tiene, así que no se pierde nada.',
      confirmLabel: 'Borrar',
      danger: true,
    }))
  )
    return;
  const result = await guard(() => adminApi.deleteInjuryType(props.token, type.code));
  if (result) {
    types.value = result;
    notice.value = `«${type.label}» borrado.`;
  }
}

const deleteBlocked = (type: AdminInjuryTypeDto) =>
  type.injuries > 0
    ? `No se puede borrar: lo ${type.injuries === 1 ? 'tiene 1 lesión' : `tienen ${type.injuries} lesiones`}. Retíralo para que no se use más.`
    : undefined;

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <Alert v-if="notice" kind="success">{{ notice }}</Alert>

    <div class="card">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div class="max-w-2xl">
          <h2 class="font-semibold text-slate-900">Tipos de lesión</h2>
          <p class="text-xs text-slate-500">
            Lo que elige el cuerpo técnico al registrar una lesión y lo que se le pregunta de ella: un sitio fijo (el tobillo del esguince de tobillo) con lo que lo
            precisa, o una clase de sitio (qué músculo, qué hueso...), el lado cuando lo hay y, si lleva grado, el grado. La duración media propone la vuelta prevista
            (se puede cambiar en cada lesión). Un tipo que ya tienen lesiones no se borra: se retira, deja de ofrecerse y esas lesiones lo conservan.
          </p>
        </div>
        <button type="button" class="btn-primary" :disabled="busy" @click="openForm(null)"><Icon icon="plus" class="h-3.5 w-3.5" /> Añadir</button>
      </div>

      <p v-if="loaded && types.length > 0" class="mb-2 text-xs text-slate-500">{{ offered }} de {{ types.length }} se ofrecen al registrar lesiones.</p>
      <p v-if="loaded && types.length === 0 && !error" class="text-sm text-slate-500">Todavía no hay ningún tipo: añade el primero.</p>

      <div v-if="types.length > 0" class="overflow-x-auto rounded-lg border border-slate-200">
        <table class="table-sticky min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortHeader class="px-3 py-2 text-left" label="Nombre" v-bind="state('label')" @sort="sortBy('label')" />
              <SortHeader class="col-md px-3 py-2 text-right" label="Orden" v-bind="state('order')" @sort="sortBy('order')" />
              <SortHeader class="col-sm px-3 py-2 text-left" label="Pregunta" title="Lo que se pregunta de dónde fue" v-bind="state('asks')" @sort="sortBy('asks')" />
              <SortHeader class="col-md px-3 py-2 text-right" label="Duración media" v-bind="state('days')" @sort="sortBy('days')" />
              <SortHeader class="col-sm px-3 py-2 text-right" label="Lesiones" v-bind="state('injuries')" @sort="sortBy('injuries')" />
              <SortHeader class="px-3 py-2 text-left" label="Estado" v-bind="state('state')" @sort="sortBy('state')" />
              <th class="px-3 py-2"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="type in sorted" :key="type.code" :class="type.active ? '' : 'bg-slate-50/60'">
              <td class="px-3 py-2 font-medium" :class="type.active ? 'text-slate-900' : 'text-slate-500'">
                {{ type.label }}
                <span class="block text-xs font-normal text-slate-500 sm:hidden">{{ question(type) }}</span>
              </td>
              <td class="col-md px-3 py-2 text-right tabular-nums text-slate-500">{{ type.sortOrder }}</td>
              <td class="col-sm px-3 py-2 text-slate-600">
                {{ question(type) }}
                <Badge v-if="type.graded" tone="slate" class="ml-1" title="Se pregunta el grado: I distensión, II rotura parcial, III rotura completa">Grado</Badge>
              </td>
              <td class="col-md px-3 py-2 text-right tabular-nums text-slate-600">{{ type.averageDays === null ? '—' : `${type.averageDays} días` }}</td>
              <td class="col-sm px-3 py-2 text-right tabular-nums text-slate-600">{{ type.injuries }}</td>
              <td class="px-3 py-2">
                <Badge :tone="type.active ? 'green' : 'slate'">{{ type.active ? 'Se ofrece' : 'Retirado' }}</Badge>
              </td>
              <td class="px-3 py-2 text-right">
                <div class="flex flex-wrap justify-end gap-1">
                  <button type="button" class="btn-ghost text-xs" :disabled="busy" @click="openForm(type)">Editar</button>
                  <button type="button" class="btn-ghost text-xs" :disabled="busy" @click="toggle(type)">{{ type.active ? 'Retirar' : 'Volver a ofrecer' }}</button>
                  <span class="inline-block" :title="deleteBlocked(type)">
                    <button
                      type="button"
                      class="btn-ghost text-xs text-red-600"
                      :disabled="busy || type.injuries > 0"
                      :aria-describedby="type.injuries > 0 ? `blocked-${type.code}` : undefined"
                      @click="remove(type)"
                    >
                      Borrar
                    </button>
                    <span v-if="type.injuries > 0" :id="`blocked-${type.code}`" class="sr-only">{{ deleteBlocked(type) }}</span>
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="types.some((t) => t.injuries > 0)" class="mt-2 text-xs text-slate-500">«Borrar» solo se activa en los tipos que no tiene ninguna lesión; los demás se retiran.</p>
    </div>

    <Modal :open="formOpen" :title="editing ? `Editar «${editing.label}»` : 'Añadir un tipo de lesión'" size="lg" @close="formOpen = false">
      <form id="injury-type-form" class="space-y-4" @submit.prevent="save">
        <Alert v-if="formError" kind="error">{{ formError }}</Alert>
        <label class="block">
          <span class="label">Nombre</span>
          <input v-model="form.label" type="text" maxlength="60" required class="input" placeholder="Ej.: Rotura de menisco" />
        </label>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label>
            <span class="label">Duración media (días)</span>
            <input v-model.number="form.averageDays" type="number" min="1" max="730" class="input" placeholder="Sin referencia" />
            <span class="mt-1 block text-[11px] text-slate-500">Vacía si no hay una referencia (como «Otra»).</span>
          </label>
          <label>
            <span class="label">Orden en la lista</span>
            <input v-model.number="form.sortOrder" type="number" min="0" max="1000" required class="input" />
          </label>
        </div>

        <div>
          <p class="label">¿Qué se pregunta de dónde fue?</p>
          <ChoiceToggle :model-value="form.asks" :options="asksOptions" label="Qué se pregunta de dónde fue" @update:model-value="chooseAsks" />
          <p class="mt-1 text-[11px] text-slate-500">
            <template v-if="form.asks === 'kind'">Cualquier sitio de una clase: «¿Qué músculo?» en la contractura, «¿Qué hueso?» en la fractura.</template>
            <template v-else-if="form.asks === 'base'">Siempre el mismo sitio, del que sale el lado: la rodilla en el ligamento cruzado («¿Qué rodilla?»).</template>
            <template v-else>Nada del cuerpo: una enfermedad.</template>
          </p>
        </div>
        <div v-if="form.asks === 'kind'">
          <p class="label">Clase de sitio</p>
          <ChoiceToggle :model-value="form.siteKind" :options="kindOptions" label="Clase de sitio" size="xs" @update:model-value="chooseKind" />
        </div>
        <div v-if="form.asks === 'base'">
          <label class="label" for="injury-type-base">Sitio fijo</label>
          <SearchSelect id="injury-type-base" placeholder="Elige el sitio" searchable :model-value="form.baseSite" :options="baseOptions" @update:model-value="chooseBase($event as string | null)" />
        </div>
        <div v-if="form.asks !== 'none' && (form.asks === 'kind' || form.baseSite)">
          <p class="label">
            {{ form.asks === 'base' ? 'Lo que lo precisa' : 'Solo estos sitios' }}
            <span class="font-normal text-slate-400">({{ form.sites.length ? `${form.sites.length} elegidos` : form.asks === 'base' ? 'ninguno' : 'todos' }})</span>
          </p>
          <p class="mb-1.5 text-[11px] text-slate-500">{{ listHelp }} Como mucho {{ MAX_SITES }}.</p>
          <input v-model="siteFilter" type="search" class="input mb-2" placeholder="Buscar un sitio" aria-label="Buscar un sitio en la lista" />
          <div class="max-h-64 overflow-y-auto rounded-lg border border-line p-2">
            <p v-if="candidateGroups.length === 0" class="px-1 py-2 text-xs text-slate-500">Ningún sitio encaja.</p>
            <fieldset v-for="group in candidateGroups" :key="group.region" class="mb-2 last:mb-0">
              <legend class="px-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{{ group.label }}</legend>
              <label v-for="site in group.sites" :key="site.code" class="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-surface-2">
                <input
                  type="checkbox"
                  class="mt-0.5"
                  :checked="form.sites.includes(site.code)"
                  :disabled="!form.sites.includes(site.code) && form.sites.length >= MAX_SITES"
                  @change="toggleSite(site.code, ($event.target as HTMLInputElement).checked)"
                />
                <span class="min-w-0 break-words">
                  {{ site.label }}
                  <span class="text-xs text-slate-500">· {{ kindLabels[site.kind].toLowerCase() }}<template v-if="!site.active"> · retirado</template></span>
                </span>
              </label>
            </fieldset>
          </div>
          <button v-if="form.sites.length" type="button" class="mt-1 text-[11px] font-medium text-brand-600 underline underline-offset-2" @click="form.sites = []">Vaciar la lista</button>
        </div>

        <label v-if="form.asks !== 'none'" class="flex items-start gap-2 text-sm text-slate-700">
          <input v-model="form.graded" type="checkbox" class="mt-0.5" />
          <span>Se pregunta el grado<span class="block text-xs text-slate-500">I distensión, II rotura parcial, III rotura completa (roturas fibrilares, esguinces, ligamentos).</span></span>
        </label>
        <label class="flex items-start gap-2 text-sm text-slate-700">
          <input v-model="form.active" type="checkbox" class="mt-0.5" />
          <span>Se ofrece al registrar lesiones<span class="block text-xs text-slate-500">Si lo quitas queda retirado: las lesiones que ya lo tienen lo conservan.</span></span>
        </label>
        <p class="text-[11px] text-slate-500">Cambiar lo que pregunta no toca las lesiones ya guardadas: conservan su sitio y su lado.</p>
      </form>
      <template #footer>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <p v-if="formBlocked && !busy" class="mr-auto text-xs text-slate-500" role="status">{{ formBlocked }}</p>
          <button type="button" class="btn-ghost" @click="formOpen = false">Cancelar</button>
          <button type="submit" form="injury-type-form" class="btn-primary" v-busy="busy" :disabled="!!formBlocked" :title="formBlocked">Guardar</button>
        </div>
      </template>
    </Modal>
  </section>
</template>
