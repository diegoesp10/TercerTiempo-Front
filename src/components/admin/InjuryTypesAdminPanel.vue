<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import Modal from '@/components/ui/Modal.vue';
import SortHeader from '@/components/ui/SortHeader.vue';
import { confirmDialog } from '@/composables/useConfirm';
import { useSort } from '@/composables/useSort';
import type { AdminInjuryTypeDto, SaveInjuryTypeRequest } from '@/types/api';

/**
 * Catálogo de tipos de lesión: lo que elige el cuerpo técnico al registrar una lesión y la duración media con la que se
 * propone la vuelta. Un tipo que ya tiene lesiones no se borra (la base de datos tampoco lo deja): se retira, deja de
 * ofrecerse y las lesiones que lo tienen lo conservan.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const types = ref<AdminInjuryTypeDto[]>([]);
const loaded = ref(false);
const error = ref<string | null>(null);
const notice = ref<string | null>(null);
const busy = ref(false);
const editing = ref<AdminInjuryTypeDto | null>(null);
const formOpen = ref(false);
const form = reactive<{ label: string; averageDays: number | null; sortOrder: number; active: boolean }>({ label: '', averageDays: null, sortOrder: 50, active: true });

type SortKey = 'order' | 'label' | 'days' | 'injuries' | 'state';
const { sorted, sortBy, state } = useSort<AdminInjuryTypeDto, SortKey>(
  types,
  {
    order: (t) => t.sortOrder,
    label: (t) => t.label,
    days: (t) => t.averageDays ?? -1,
    injuries: (t) => t.injuries,
    state: (t) => (t.active ? 0 : 1),
  },
  'order',
  { desc: false, ascendingFirst: ['order', 'label', 'state'] },
);

const offered = computed(() => types.value.filter((t) => t.active).length);

async function guard<T>(action: () => Promise<T>): Promise<T | undefined> {
  busy.value = true;
  try {
    error.value = null;
    return await action();
  } catch (e) {
    if ((e as { status?: number }).status === 401) emit('unauthorized');
    else error.value = errorMessage(e);
    return undefined;
  } finally {
    busy.value = false;
  }
}

async function load() {
  const result = await guard(() => adminApi.injuryTypes(props.token));
  if (result) types.value = result;
  loaded.value = true;
}

function openForm(type: AdminInjuryTypeDto | null) {
  editing.value = type;
  const next = Math.max(0, ...types.value.map((t) => t.sortOrder)) + 1;
  Object.assign(form, type
    ? { label: type.label, averageDays: type.averageDays, sortOrder: type.sortOrder, active: type.active }
    : { label: '', averageDays: null, sortOrder: Math.min(next, 1000), active: true });
  formOpen.value = true;
}

function body(source: { label: string; averageDays: number | null; sortOrder: number; active: boolean }): SaveInjuryTypeRequest {
  // Un campo numérico vacío llega como '' (o null): sin duración media.
  const days = source.averageDays === null || (source.averageDays as unknown) === '' ? null : Number(source.averageDays);
  return { label: source.label.trim(), averageDays: days, sortOrder: Number(source.sortOrder) || 0, active: source.active };
}

async function save() {
  const request = body(form);
  const result = await guard(() => (editing.value
    ? adminApi.updateInjuryType(props.token, editing.value.code, request)
    : adminApi.createInjuryType(props.token, request)));
  if (result) {
    types.value = result;
    formOpen.value = false;
    notice.value = editing.value ? `«${request.label}» guardado.` : `«${request.label}» añadido al catálogo.`;
  }
}

async function toggle(type: AdminInjuryTypeDto) {
  if (type.active && !(await confirmDialog({
    title: `Retirar «${type.label}»`,
    message: type.injuries > 0
      ? `Deja de ofrecerse al registrar lesiones. Las ${type.injuries} lesiones que ya lo tienen lo conservan.`
      : 'Deja de ofrecerse al registrar lesiones. Puedes volver a ofrecerlo cuando quieras.',
    confirmLabel: 'Retirar',
  }))) return;
  const result = await guard(() => adminApi.updateInjuryType(props.token, type.code, body({ ...type, active: !type.active })));
  if (result) {
    types.value = result;
    notice.value = type.active ? `«${type.label}» retirado.` : `«${type.label}» se vuelve a ofrecer.`;
  }
}

async function remove(type: AdminInjuryTypeDto) {
  if (!(await confirmDialog({
    title: `Borrar «${type.label}»`,
    message: 'Sale del catálogo para siempre. Ninguna lesión lo tiene, así que no se pierde nada.',
    confirmLabel: 'Borrar',
    danger: true,
  }))) return;
  const result = await guard(() => adminApi.deleteInjuryType(props.token, type.code));
  if (result) {
    types.value = result;
    notice.value = `«${type.label}» borrado.`;
  }
}

const deleteBlocked = (type: AdminInjuryTypeDto) =>
  type.injuries > 0 ? `No se puede borrar: lo ${type.injuries === 1 ? 'tiene 1 lesión' : `tienen ${type.injuries} lesiones`}. Retíralo para que no se use más.` : undefined;

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
            Lo que elige el cuerpo técnico al registrar una lesión. La duración media propone la vuelta prevista (se puede cambiar en cada lesión).
            Un tipo que ya tienen lesiones no se borra: se retira, deja de ofrecerse y esas lesiones lo conservan. Cambiar el nombre lo cambia también en las lesiones guardadas.
          </p>
        </div>
        <button type="button" class="btn-primary" :disabled="busy" @click="openForm(null)"><Icon icon="plus" class="h-3.5 w-3.5" /> Añadir</button>
      </div>

      <p v-if="loaded && types.length > 0" class="mb-2 text-xs text-slate-500">{{ offered }} de {{ types.length }} se ofrecen al registrar lesiones.</p>
      <p v-if="loaded && types.length === 0 && !error" class="text-sm text-slate-500">Todavía no hay ningún tipo: añade el primero.</p>

      <div v-if="types.length > 0" class="overflow-x-auto rounded-lg border border-slate-200">
        <table class="min-w-full text-sm">
          <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortHeader class="px-3 py-2 text-right" label="Orden" v-bind="state('order')" @sort="sortBy('order')" />
              <SortHeader class="px-3 py-2 text-left" label="Nombre" v-bind="state('label')" @sort="sortBy('label')" />
              <SortHeader class="px-3 py-2 text-right" label="Duración media" v-bind="state('days')" @sort="sortBy('days')" />
              <SortHeader class="px-3 py-2 text-right" label="Lesiones" v-bind="state('injuries')" @sort="sortBy('injuries')" />
              <SortHeader class="px-3 py-2 text-left" label="Estado" v-bind="state('state')" @sort="sortBy('state')" />
              <th class="px-3 py-2"><span class="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100">
            <tr v-for="type in sorted" :key="type.code" :class="type.active ? '' : 'bg-slate-50/60'">
              <td class="px-3 py-2 text-right tabular-nums text-slate-500">{{ type.sortOrder }}</td>
              <td class="px-3 py-2 font-medium" :class="type.active ? 'text-slate-900' : 'text-slate-500'">{{ type.label }}</td>
              <td class="px-3 py-2 text-right tabular-nums text-slate-600">{{ type.averageDays === null ? '—' : `${type.averageDays} días` }}</td>
              <td class="px-3 py-2 text-right tabular-nums text-slate-600">{{ type.injuries }}</td>
              <td class="px-3 py-2">
                <Badge :tone="type.active ? 'green' : 'slate'">{{ type.active ? 'Se ofrece' : 'Retirado' }}</Badge>
              </td>
              <td class="px-3 py-2 text-right whitespace-nowrap">
                <button type="button" class="btn-ghost text-xs" :disabled="busy" @click="openForm(type)">Editar</button>
                <button type="button" class="btn-ghost text-xs" :disabled="busy" @click="toggle(type)">{{ type.active ? 'Retirar' : 'Volver a ofrecer' }}</button>
                <span class="inline-block" :title="deleteBlocked(type)">
                  <button type="button" class="btn-ghost text-xs text-red-600" :disabled="busy || type.injuries > 0" :aria-describedby="type.injuries > 0 ? `blocked-${type.code}` : undefined" @click="remove(type)">Borrar</button>
                  <span v-if="type.injuries > 0" :id="`blocked-${type.code}`" class="sr-only">{{ deleteBlocked(type) }}</span>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="types.some((t) => t.injuries > 0)" class="mt-2 text-xs text-slate-500">«Borrar» solo se activa en los tipos que no tiene ninguna lesión; los demás se retiran.</p>
    </div>

    <Modal :open="formOpen" :title="editing ? `Editar «${editing.label}»` : 'Añadir un tipo de lesión'" size="md" @close="formOpen = false">
      <form class="space-y-3" @submit.prevent="save">
        <label class="block">
          <span class="label">Nombre</span>
          <input v-model="form.label" type="text" maxlength="60" required class="input" placeholder="Ej.: Rotura de menisco" />
        </label>
        <div class="grid grid-cols-2 gap-3">
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
        <label class="flex items-start gap-2 text-sm text-slate-700">
          <input v-model="form.active" type="checkbox" class="mt-0.5" />
          <span>Se ofrece al registrar lesiones<span class="block text-xs text-slate-500">Si lo quitas queda retirado: las lesiones que ya lo tienen lo conservan.</span></span>
        </label>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-ghost" @click="formOpen = false">Cancelar</button>
          <button type="submit" class="btn-primary" :disabled="busy || !form.label.trim()" :title="form.label.trim() ? undefined : 'Escribe el nombre del tipo'">Guardar</button>
        </div>
      </form>
    </Modal>
  </section>
</template>
