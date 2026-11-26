<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';
import type { ChoiceOption } from '@/components/ui/choice';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useSort } from '@/composables/useSort';
import type { AdminBodySiteDto, BodyRegion, BodySiteAgreement, BodySiteKind, SaveBodySiteRequest } from '@/types/api';
import { kindLabels, kindOrder, regionLabels, regionOrder, sideWord } from '@/utils/injuryAnatomy';

/**
 * Catálogo de sitios del cuerpo para las lesiones: músculos (con su grupo: el bíceps femoral en los isquiotibiales),
 * huesos, tendones, ligamentos, articulaciones, cartílagos y zonas. Los tipos de lesión preguntan por ellos. Un sitio que ya
 * usa alguna lesión, algún tipo o algún sitio de su grupo no se borra: se retira, deja de ofrecerse y lo guardado lo conserva.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const sites = ref<AdminBodySiteDto[]>([]);
const loaded = ref(false);
const error = ref<string | null>(null);
const formError = ref<string | null>(null);
const notice = ref<string | null>(null);
const busy = ref(false);
const editing = ref<AdminBodySiteDto | null>(null);
const formOpen = ref(false);
const search = ref('');
const kindFilter = ref<BodySiteKind | 'All'>('All');
const form = reactive<{
  label: string;
  kind: BodySiteKind;
  region: BodyRegion;
  parent: string | null;
  paired: boolean;
  agreement: BodySiteAgreement;
  sortOrder: number;
  active: boolean;
}>({ label: '', kind: 'Muscle', region: 'Thigh', parent: null, paired: true, agreement: 'Masculine', sortOrder: 10, active: true });

const byCode = computed(() => new Map(sites.value.map((s) => [s.code, s])));
const parentLabel = (site: AdminBodySiteDto) => (site.parent ? (byCode.value.get(site.parent)?.label ?? site.parent) : null);
const regionRank = (region: BodyRegion) => regionOrder.indexOf(region);

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const filtered = computed(() => {
  const needle = normalize(search.value.trim());
  return sites.value.filter(
    (s) =>
      (kindFilter.value === 'All' || s.kind === kindFilter.value) &&
      (!needle || normalize(`${s.label} ${parentLabel(s) ?? ''} ${regionLabels[s.region]}`).includes(needle)),
  );
});

type SortKey = 'region' | 'label' | 'kind' | 'injuries' | 'types' | 'state';
const { sorted, sortBy, state } = useSort<AdminBodySiteDto, SortKey>(
  filtered,
  {
    region: (s) => regionRank(s.region) * 100000 + s.sortOrder,
    label: (s) => s.label,
    kind: (s) => kindOrder.indexOf(s.kind),
    injuries: (s) => s.injuries,
    types: (s) => s.types,
    state: (s) => (s.active ? 0 : 1),
  },
  'region',
  { desc: false, ascendingFirst: ['region', 'label', 'kind', 'state'] },
);

const kindFilterOptions: SelectOption[] = [{ value: 'All', label: 'Todas las clases' }, ...kindOrder.map((k) => ({ value: k, label: kindLabels[k] }))];
const kindOptions: ChoiceOption<BodySiteKind>[] = kindOrder.map((k) => ({ value: k, label: kindLabels[k] }));
const regionOptions: SelectOption[] = regionOrder.map((r) => ({ value: r, label: regionLabels[r] }));
const offered = computed(() => sites.value.filter((s) => s.active).length);

// Un grupo es otro sitio de la misma clase que no está a su vez en uno; un sitio que ya es grupo de otros no entra en uno.
const hasChildren = computed(() => !!editing.value && editing.value.children > 0);
const parentOptions = computed<SelectOption[]>(() =>
  sites.value
    .filter((s) => s.kind === form.kind && !s.parent && s.code !== editing.value?.code)
    .map((s) => ({ value: s.code, label: s.label, group: regionLabels[s.region], hint: s.active ? undefined : 'retirado' })),
);

// Cómo se lee el lado con este nombre: el administrador elige el que suena bien.
const agreementOptions = computed<ChoiceOption<BodySiteAgreement>[]>(() => {
  const name = form.label.trim() || 'Rodilla';
  return (['Masculine', 'Feminine', 'MasculinePlural', 'FemininePlural'] as const).map((agreement) => ({
    value: agreement,
    label: `${name} ${sideWord({ agreement }, 'Left')}`,
  }));
});

function chooseKind(kind: BodySiteKind) {
  form.kind = kind;
  if (form.parent && byCode.value.get(form.parent)?.kind !== kind) form.parent = null;
}

const formBlocked = computed(() => {
  if (busy.value) return 'Espera a que termine lo que se está guardando';
  if (!form.label.trim()) return 'Escribe el nombre del sitio';
  if (hasChildren.value && editing.value && form.kind !== editing.value.kind) return 'Es el grupo de otros sitios: para cambiarle la clase, sácalos antes del grupo';
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
  const result = await guard(() => adminApi.bodySites(props.token));
  if (result) sites.value = result;
  loaded.value = true;
}

function openForm(site: AdminBodySiteDto | null) {
  editing.value = site;
  formError.value = null;
  Object.assign(
    form,
    site
      ? {
          label: site.label,
          kind: site.kind,
          region: site.region,
          parent: site.parent,
          paired: site.paired,
          agreement: site.agreement,
          sortOrder: site.sortOrder,
          active: site.active,
        }
      : { label: '', kind: kindFilter.value === 'All' ? 'Muscle' : kindFilter.value, region: 'Thigh', parent: null, paired: true, agreement: 'Masculine', sortOrder: 10, active: true },
  );
  formOpen.value = true;
}

const bodyOf = (source: typeof form | AdminBodySiteDto, active = source.active): SaveBodySiteRequest => ({
  label: source.label.trim(),
  kind: source.kind,
  region: source.region,
  parent: source.parent || null,
  paired: source.paired,
  agreement: source.agreement,
  sortOrder: Number(source.sortOrder) || 0,
  active,
});

async function save() {
  if (formBlocked.value) return;
  const request = bodyOf(form);
  const result = await guard(
    () => (editing.value ? adminApi.updateBodySite(props.token, editing.value.code, request) : adminApi.createBodySite(props.token, request)),
    true,
  );
  if (result) {
    sites.value = result;
    formOpen.value = false;
    notice.value = editing.value ? `«${request.label}» guardado.` : `«${request.label}» añadido al catálogo.`;
  }
}

async function toggle(site: AdminBodySiteDto) {
  if (
    site.active &&
    !(await confirmDialog({
      title: `Retirar «${site.label}»`,
      message: 'Deja de ofrecerse al registrar lesiones. Las lesiones que ya lo tienen lo conservan, y los tipos que lo tienen como sitio fijo siguen sirviendo.',
      confirmLabel: 'Retirar',
    }))
  )
    return;
  const result = await guard(() => adminApi.updateBodySite(props.token, site.code, bodyOf(site, !site.active)));
  if (result) {
    sites.value = result;
    notice.value = site.active ? `«${site.label}» retirado.` : `«${site.label}» se vuelve a ofrecer.`;
  }
}

async function remove(site: AdminBodySiteDto) {
  if (
    !(await confirmDialog({
      title: `Borrar «${site.label}»`,
      message: 'Sale del catálogo para siempre. Nada lo usa, así que no se pierde nada.',
      confirmLabel: 'Borrar',
      danger: true,
    }))
  )
    return;
  const result = await guard(() => adminApi.deleteBodySite(props.token, site.code));
  if (result) {
    sites.value = result;
    notice.value = `«${site.label}» borrado.`;
  }
}

const uses = (site: AdminBodySiteDto) =>
  [
    site.injuries ? (site.injuries === 1 ? '1 lesión' : `${site.injuries} lesiones`) : null,
    site.types ? (site.types === 1 ? '1 tipo de lesión' : `${site.types} tipos de lesión`) : null,
    site.children ? (site.children === 1 ? '1 sitio de su grupo' : `${site.children} sitios de su grupo`) : null,
  ].filter(Boolean);
const deleteBlocked = (site: AdminBodySiteDto) =>
  uses(site).length ? `No se puede borrar: lo usan ${uses(site).join(', ')}. Retíralo para que no se ofrezca más.` : undefined;

onMounted(load);
</script>

<template>
  <section class="space-y-6">
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <Alert v-if="notice" kind="success">{{ notice }}</Alert>

    <div class="card">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div class="max-w-2xl">
          <h2 class="font-semibold text-slate-900">Sitios del cuerpo</h2>
          <p class="text-xs text-slate-500">
            Por lo que preguntan los tipos de lesión: músculos (con su grupo, que se elige si no se sabe el músculo exacto), huesos, tendones, ligamentos,
            articulaciones, cartílagos y zonas. «Tiene lado» hace que se pregunte izquierdo o derecho. Un sitio que ya se usa no se borra: se retira y lo guardado lo
            conserva.
          </p>
        </div>
        <button type="button" class="btn-primary" :disabled="busy" @click="openForm(null)"><Icon icon="plus" class="h-3.5 w-3.5" /> Añadir</button>
      </div>

      <div class="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <input v-model="search" type="search" class="input" placeholder="Buscar por nombre, grupo o zona" aria-label="Buscar un sitio del cuerpo" />
        <SearchSelect :model-value="kindFilter" :options="kindFilterOptions" aria-label="Filtrar por clase" @update:model-value="kindFilter = ($event as BodySiteKind | 'All')" />
      </div>
      <p v-if="loaded && sites.length > 0" class="mb-2 text-xs text-slate-500">
        {{ offered }} de {{ sites.length }} se ofrecen<template v-if="filtered.length !== sites.length"> · {{ filtered.length }} con este filtro</template>.
      </p>
      <p v-if="loaded && sites.length === 0 && !error" class="text-sm text-slate-500">Todavía no hay ningún sitio: añade el primero.</p>

      <div v-if="filtered.length > 0" class="overflow-x-auto rounded-lg border border-slate-200">
        <table class="table-sticky min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortHeader class="px-3 py-2 text-left" label="Nombre" v-bind="state('label')" @sort="sortBy('label')" />
              <SortHeader class="col-sm px-3 py-2 text-left" label="Clase" v-bind="state('kind')" @sort="sortBy('kind')" />
              <SortHeader class="col-md px-3 py-2 text-left" label="Zona" title="De la cabeza a los pies" v-bind="state('region')" @sort="sortBy('region')" />
              <SortHeader class="col-md px-3 py-2 text-right" label="Lesiones" v-bind="state('injuries')" @sort="sortBy('injuries')" />
              <SortHeader class="col-lg px-3 py-2 text-right" label="Tipos" title="Tipos de lesión que lo tienen como sitio fijo o en su lista" v-bind="state('types')" @sort="sortBy('types')" />
              <SortHeader class="px-3 py-2 text-left" label="Estado" v-bind="state('state')" @sort="sortBy('state')" />
              <th class="px-3 py-2"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="site in sorted" :key="site.code" :class="site.active ? '' : 'bg-slate-50/60'">
              <td class="px-3 py-2" :class="site.active ? 'text-slate-900' : 'text-slate-500'">
                <span class="font-medium" :class="site.parent ? 'pl-3' : ''">{{ site.label }}</span>
                <span class="block text-xs text-slate-500" :class="site.parent ? 'pl-3' : ''">
                  <template v-if="site.parent">en {{ parentLabel(site) }}</template>
                  <template v-else-if="site.children">grupo de {{ site.children }}</template>
                  <template v-if="site.paired">{{ site.parent || site.children ? ' · ' : '' }}con lado</template>
                  <span class="sm:hidden"> · {{ kindLabels[site.kind].toLowerCase() }}</span>
                </span>
              </td>
              <td class="col-sm px-3 py-2 text-slate-600">{{ kindLabels[site.kind] }}</td>
              <td class="col-md px-3 py-2 text-slate-600">{{ regionLabels[site.region] }}</td>
              <td class="col-md px-3 py-2 text-right tabular-nums text-slate-600">{{ site.injuries }}</td>
              <td class="col-lg px-3 py-2 text-right tabular-nums text-slate-600">{{ site.types }}</td>
              <td class="px-3 py-2">
                <Badge :tone="site.active ? 'green' : 'slate'">{{ site.active ? 'Se ofrece' : 'Retirado' }}</Badge>
              </td>
              <td class="px-3 py-2 text-right">
                <div class="flex flex-wrap justify-end gap-1">
                  <button type="button" class="btn-ghost text-xs" :disabled="busy" @click="openForm(site)">Editar</button>
                  <button type="button" class="btn-ghost text-xs" :disabled="busy" @click="toggle(site)">{{ site.active ? 'Retirar' : 'Volver a ofrecer' }}</button>
                  <span class="inline-block" :title="deleteBlocked(site)">
                    <button
                      type="button"
                      class="btn-ghost-danger text-xs"
                      :disabled="busy || !!deleteBlocked(site)"
                      :aria-describedby="deleteBlocked(site) ? `site-blocked-${site.code}` : undefined"
                      @click="remove(site)"
                    >
                      Borrar
                    </button>
                    <span v-if="deleteBlocked(site)" :id="`site-blocked-${site.code}`" class="sr-only">{{ deleteBlocked(site) }}</span>
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else-if="loaded && sites.length > 0" class="text-sm text-slate-500">Ningún sitio con este filtro.</p>
    </div>

    <Modal :open="formOpen" :title="editing ? `Editar «${editing.label}»` : 'Añadir un sitio del cuerpo'" size="lg" @close="formOpen = false">
      <form id="body-site-form" class="space-y-4" @submit.prevent="save">
        <Alert v-if="formError" kind="error">{{ formError }}</Alert>
        <label class="block">
          <span class="label">Nombre</span>
          <input v-model="form.label" type="text" maxlength="80" required class="input" placeholder="Ej.: Bíceps femoral" />
          <span class="mt-1 block text-2xs text-slate-500">Lo que aclara va entre paréntesis al final: «Escápula (omóplato)».</span>
        </label>
        <div>
          <p class="label">Clase</p>
          <ChoiceToggle :model-value="form.kind" :options="kindOptions" label="Clase de sitio" size="xs" :disabled="hasChildren" @update:model-value="chooseKind" />
          <p v-if="hasChildren" class="mt-1 text-2xs text-slate-500">Es el grupo de {{ editing?.children }} sitios: la clase no cambia mientras los tenga.</p>
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label class="label" for="body-site-region">Zona del cuerpo</label>
            <SearchSelect id="body-site-region" :model-value="form.region" :options="regionOptions" @update:model-value="form.region = $event as BodyRegion" />
          </div>
          <label>
            <span class="label">Orden en su zona</span>
            <input v-model.number="form.sortOrder" type="number" min="0" max="10000" required class="input" />
          </label>
        </div>
        <div>
          <label class="label" for="body-site-parent">Grupo <span class="font-normal text-slate-400">(opcional)</span></label>
          <SearchSelect
            id="body-site-parent"
            placeholder="Sin grupo"
            clearable
            :disabled="hasChildren"
            :model-value="form.parent"
            :options="parentOptions"
            @update:model-value="form.parent = ($event as string | null)"
          />
          <p class="mt-1 text-2xs text-slate-500">
            {{ hasChildren ? 'Ya es grupo de otros: no puede estar en otro.' : 'Un sitio de la misma clase que lo contiene (el bíceps femoral, en los isquiotibiales): si no se sabe cuál, se elige el grupo.' }}
          </p>
        </div>
        <label class="flex items-start gap-2 text-sm text-slate-700">
          <input v-model="form.paired" type="checkbox" class="mt-0.5" />
          <span>Tiene lado<span class="block text-xs text-slate-500">Hay izquierdo y derecho: se pregunta cuál.</span></span>
        </label>
        <div v-if="form.paired">
          <p class="label">Cómo se lee con el lado</p>
          <ChoiceToggle :model-value="form.agreement" :options="agreementOptions" label="Cómo se lee con el lado" size="xs" @update:model-value="form.agreement = $event" />
        </div>
        <label class="flex items-start gap-2 text-sm text-slate-700">
          <input v-model="form.active" type="checkbox" class="mt-0.5" />
          <span>Se ofrece al registrar lesiones<span class="block text-xs text-slate-500">Si lo quitas queda retirado: lo que ya lo tiene lo conserva.</span></span>
        </label>
      </form>
      <template #footer>
        <div class="flex flex-wrap items-center justify-end gap-2">
          <p v-if="formBlocked && !busy" class="mr-auto text-xs text-slate-500" role="status">{{ formBlocked }}</p>
          <button type="button" class="btn-ghost" @click="formOpen = false">Cancelar</button>
          <button type="submit" form="body-site-form" class="btn-primary" v-busy="busy" :disabled="!!formBlocked" :title="formBlocked">Guardar</button>
        </div>
      </template>
    </Modal>
  </section>
</template>
