<script setup lang="ts">
import { computed, reactive, ref, shallowRef, useId, watch } from 'vue';
import { api } from '@/api';
import { ApiError, errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import ChoiceToggle from '@/components/ui/ChoiceToggle.vue';
import type { ChoiceOption } from '@/components/ui/choice';
import Modal from '@/components/ui/Modal.vue';
import SearchSelect, { type SelectOption } from '@/components/ui/SearchSelect.vue';
import type {
  BodySide,
  BodySiteDto,
  InjuryDto,
  InjuryGrade,
  InjuryMechanism,
  InjuryOccasionDto,
  InjuryOccasionKind,
  InjuryProposalDto,
  InjuryRequest,
  InjuryType,
  InjuryTypeDto,
} from '@/types/api';
import { formatDate, formatTime, toDateKey } from '@/utils/format';
import {
  describeLocation,
  gradeOptions,
  kindQuestions,
  mechanismOptions,
  offeredSites,
  sideMissing,
  sideOptions,
  sideQuestion,
  siteMissing,
  siteQuestion,
  siteSelectOptions,
  type Unknown,
} from '@/utils/injuryAnatomy';
import { occasionIcon, occasionPlace } from '@/utils/injuryOccasion';

export type InjuryFormMode = 'new' | 'edit' | 'relapse';

export interface InjuryFormPlayer {
  id: string;
  fullName: string;
  photoUrl?: string | null;
  /** No se le puede elegir: por qué (sale en la lista, sin poder elegirlo). */
  unavailable?: string | null;
}

/** Lo que viene ya rellenado al abrir: desde la crónica de un partido, desde un entrenamiento… */
export interface InjuryFormPreset {
  squadPlayerId?: string | null;
  type?: InjuryType | null;
  reason?: string;
  startedOn?: string;
  /** Dónde se lesionó; undefined deja el que tenga la lesión (al corregirla). */
  occasion?: InjuryOccasionDto | null;
  /** El sitio viene dado (el partido de la crónica, el entrenamiento desde el que se registra): aquí no se cambia. */
  lockOccasion?: boolean;
  lockPlayer?: boolean;
  /** La posible lesión de la crónica que queda registrada con esta. */
  proposal?: InjuryProposalDto | null;
  /** Dónde fue en el cuerpo; sin ellos, lo que sugiere la crónica (si es del mismo tipo). */
  site?: string | null;
  side?: BodySide | null;
}

// Lesión nueva, corrección o recaída, con dónde se lesionó: un partido del equipo o un entrenamiento de la plantilla (ya
// empezados) o en otro sitio. Así el partido la enseña como registrada y el entrenamiento, que se lesionó allí. Al elegir
// el sitio de una lesión nueva el parte se pone en su día; se puede mover después, pero nunca a antes.
const props = defineProps<{
  open: boolean;
  squadId: string;
  mode: InjuryFormMode;
  /** Al corregir, la lesión; en la recaída, la superada de la que viene. */
  target?: InjuryDto | null;
  /** A quién se puede elegir: los que siguen en la plantilla. */
  players: InjuryFormPlayer[];
  /** Los que ya tienen una lesión abierta: no pueden tener dos. */
  injuredPlayerIds?: string[];
  /** Día más temprano del parte: el alta de la lesión de la que es recaída. */
  startMin?: string;
  preset?: InjuryFormPreset | null;
}>();
const emit = defineEmits<{ close: []; saved: [list: InjuryDto[]] }>();

const formId = `injury-form-${useId()}`;
const busyTitle = 'Espera a que termine lo que se está guardando';
const today = toDateKey(new Date());
const addDays = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
};
const daysLabel = (n: number) => (n === 1 ? '1 día' : `${n} días`);
const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

type Where = InjuryOccasionKind | 'None';

const types = shallowRef<InjuryTypeDto[]>([]);
const typesLoaded = ref(false);
const sites = shallowRef<BodySiteDto[]>([]);
const sitesLoaded = ref(false);
const sitesError = ref<string | null>(null);
// null mientras se cargan.
const occasions = shallowRef<InjuryOccasionDto[] | null>(null);
const occasionsError = ref<string | null>(null);
const busy = ref(false);
const error = ref<string | null>(null);
const fieldErrors = ref<Record<string, string[]>>({});

const form = reactive<{
  squadPlayerId: string | null;
  type: InjuryType | null;
  reason: string;
  startedOn: string;
  expectedReturnOn: string;
  // Dónde fue en el cuerpo: el sitio que se manda (con sitio fijo y sin precisar, el fijo) y su lado.
  site: string | null;
  side: BodySide | null;
  grade: InjuryGrade | Unknown;
  mechanism: InjuryMechanism | Unknown;
}>({
  squadPlayerId: null,
  type: null,
  reason: '',
  startedOn: today,
  expectedReturnOn: '',
  site: null,
  side: null,
  grade: 'Unknown',
  mechanism: 'Unknown',
});
// El sitio con el que se abre (el de la lesión o el de la anterior en una recaída): sigue elegible aunque se haya retirado.
const initialSite = ref<string | null>(null);
const where = ref<Where>('None');
const occasionId = ref<string | null>(null);
// El sitio con el que se abre (el de la lesión o el que viene dado): sigue elegible aunque ya no salga en la lista (la
// lesión que viene de la temporada anterior).
const initialOccasion = shallowRef<InjuryOccasionDto | null>(null);

const proposal = computed(() => props.preset?.proposal ?? null);
const lockOccasion = computed(() => !!props.preset?.lockOccasion && !!initialOccasion.value);

watch(() => props.open, (open) => open && start(), { immediate: true });

function start() {
  const t = props.target ?? null;
  const p = props.preset ?? {};
  error.value = null;
  fieldErrors.value = {};
  const occasion = p.occasion !== undefined ? p.occasion : props.mode === 'edit' ? (t?.occasion ?? null) : null;
  initialOccasion.value = occasion;
  where.value = occasion?.kind ?? 'None';
  occasionId.value = occasion?.id ?? null;
  form.grade = 'Unknown';
  form.mechanism = 'Unknown';
  if (props.mode === 'edit' && t) {
    form.squadPlayerId = t.squadPlayerId;
    form.type = t.type;
    form.reason = t.reason ?? '';
    form.startedOn = t.startedOn;
    form.expectedReturnOn = t.expectedReturnOn ?? '';
    form.site = t.site ?? null;
    form.side = t.side ?? null;
    form.grade = t.grade ?? 'Unknown';
    form.mechanism = t.mechanism ?? 'Unknown';
  } else {
    form.squadPlayerId = props.mode === 'relapse' ? (t?.squadPlayerId ?? null) : (p.squadPlayerId ?? null);
    form.type = props.mode === 'relapse' ? (t?.type ?? null) : (p.type ?? null);
    form.reason = p.reason ?? '';
    const day = p.startedOn ?? occasion?.day ?? today;
    form.startedOn = day > today ? today : day;
    form.expectedReturnOn = '';
    // La recaída es la misma lesión que vuelve: en el mismo sitio y del mismo lado, si no se cambia.
    const suggested = proposal.value && proposal.value.suggestedType === form.type ? proposal.value : null;
    form.site = props.mode === 'relapse' ? (t?.site ?? null) : p.site !== undefined ? p.site : (suggested?.suggestedSite ?? null);
    form.side = props.mode === 'relapse' ? (t?.side ?? null) : p.side !== undefined ? p.side : (suggested?.suggestedSide ?? null);
    proposeReturn();
  }
  initialSite.value = props.mode === 'new' ? null : form.site;
  void loadLists();
}

async function loadLists() {
  occasions.value = null;
  occasionsError.value = null;
  sitesError.value = null;
  const [typeList, occasionList, siteList] = await Promise.allSettled([
    api.squads.injuryTypes(),
    api.squads.injuryOccasions(props.squadId),
    api.squads.bodySites(),
  ]);
  if (typeList.status === 'fulfilled') {
    types.value = typeList.value;
    typesLoaded.value = true;
    // Una lesión nueva no puede ser de un tipo retirado (la crónica puede proponer uno que ya no se ofrece).
    if (props.mode === 'new' && form.type && !typeList.value.some((t) => t.type === form.type && t.active)) form.type = null;
    if (props.mode !== 'edit' && !form.expectedReturnOn) proposeReturn();
  } else {
    error.value = errorMessage(typeList.reason);
  }
  if (siteList.status === 'fulfilled') {
    sites.value = siteList.value;
    sitesLoaded.value = true;
  } else {
    sitesError.value = errorMessage(siteList.reason);
  }
  fitLocation();
  if (occasionList.status === 'fulfilled') occasions.value = occasionList.value;
  else {
    occasions.value = [];
    occasionsError.value = errorMessage(occasionList.reason);
  }
}

const playerOptions = computed<SelectOption[]>(() => {
  const injured = new Set(props.injuredPlayerIds ?? []);
  return props.players.map((p) => {
    const why = p.unavailable || (injured.has(p.id) && props.target?.squadPlayerId !== p.id ? 'ya tiene una lesión abierta' : null);
    return { value: p.id, label: p.fullName, photo: p.photoUrl ?? null, disabled: !!why, hint: why || undefined };
  });
});
// Solo se ofrecen los tipos que el administrador no ha retirado; al corregir una lesión que tiene uno retirado (o al
// registrar su recaída), ese sigue disponible para ella.
const typeOptions = computed<SelectOption[]>(() => {
  const current = props.target;
  const options = types.value
    .filter((t) => t.active || t.type === current?.type)
    .map((t) => ({
      value: t.type,
      label: t.label,
      hint: !t.active ? 'ya no se ofrece para lesiones nuevas' : t.averageDays ? `≈ ${t.averageDays} días` : 'sin referencia',
    }));
  if (current && typesLoaded.value && !types.value.some((t) => t.type === current.type))
    options.push({ value: current.type, label: current.typeLabel, hint: 'ya no se ofrece para lesiones nuevas' });
  return options;
});
const averageDays = computed(() => types.value.find((t) => t.type === form.type)?.averageDays ?? (props.target?.type === form.type ? props.target?.averageDays : null) ?? null);

// Al elegir tipo o cambiar el día del parte se propone la vuelta con la duración media; el técnico puede corregirla.
function proposeReturn() {
  const days = averageDays.value;
  form.expectedReturnOn = days && form.startedOn ? addDays(form.startedOn, days) : '';
}

// --- Dónde fue en el cuerpo: lo que pregunta el tipo ---
const typeDef = computed(() => types.value.find((t) => t.type === form.type) ?? null);
const asksSite = computed(() => !!typeDef.value && (!!typeDef.value.baseSite || !!typeDef.value.siteKind));
const siteByCode = computed(() => new Map(sites.value.map((s) => [s.code, s])));
const baseSite = computed(() => (typeDef.value?.baseSite ? (siteByCode.value.get(typeDef.value.baseSite) ?? null) : null));
const offered = computed(() => (typeDef.value ? offeredSites(typeDef.value, sites.value, initialSite.value) : []));
// Con sitio fijo y sin precisar, el fijo.
const chosenSite = computed(() => (form.site ? (siteByCode.value.get(form.site) ?? null) : baseSite.value));
// El lado sale del sitio fijo si lo hay (la rodilla del ligamento cruzado) y, si no, del elegido.
const sideSite = computed(() => baseSite.value ?? chosenSite.value);
const asksSide = computed(() => asksSite.value && !!sideSite.value?.paired);
const siteOptions = computed(() => siteSelectOptions(offered.value, sites.value));
// Lo que precisa el sitio fijo, a la vista si son pocas; si el administrador puso muchas, en un desplegable.
const refineOptions = computed<ChoiceOption<string>[]>(() =>
  baseSite.value ? [{ value: baseSite.value.code, label: 'Sin precisar' }, ...offered.value.map((s) => ({ value: s.code, label: s.label }))] : [],
);
const refineQuestion = computed(() => {
  const kinds = new Set(offered.value.map((s) => s.kind));
  return kinds.size === 1 ? kindQuestions[[...kinds][0]] : '¿Se sabe más?';
});
const locationPreview = computed(() => (asksSite.value ? describeLocation(chosenSite.value, sideSite.value, asksSide.value ? form.side : null) : null));

// Al cambiar de tipo se conserva lo que siga valiendo (el músculo, de la contractura a la rotura fibrilar) y se quita lo
// que no; con sitio fijo, sin precisar.
function fitLocation() {
  const t = typeDef.value;
  if (!t || !sitesLoaded.value) return;
  if (!asksSite.value) {
    form.site = null;
    form.side = null;
    form.mechanism = 'Unknown';
  } else if (!form.site || (form.site !== t.baseSite && !offered.value.some((s) => s.code === form.site))) {
    form.site = t.baseSite ?? null;
  }
  if (!asksSide.value) form.side = null;
  if (!t.graded) form.grade = 'Unknown';
}

function chooseType(type: InjuryType | null) {
  form.type = type;
  proposeReturn();
  fitLocation();
}

function chooseSite(code: string | null) {
  form.site = code;
  if (!asksSide.value) form.side = null;
}

// --- Dónde se lesionó ---
const whereOptions: ChoiceOption<Where>[] = [
  { value: 'Match', label: 'En un partido', icon: 'futbol' },
  { value: 'Training', label: 'En un entrenamiento', icon: 'dumbbell' },
  { value: 'None', label: 'En otro sitio', icon: 'location-dot' },
];
// Lo que ya ha empezado y, en una recaída, lo que es después del alta de la anterior.
const kindOccasions = computed(() =>
  (occasions.value ?? []).filter((o) => o.kind === where.value && o.day <= today && (!props.startMin || o.day >= props.startMin)),
);
const occasionHint = (o: InjuryOccasionDto) => (o.kind === 'Training' && o.at ? `${formatDate(o.day)} · ${formatTime(o.at)}` : formatDate(o.day));
const occasionOptions = computed<SelectOption[]>(() => {
  const list = [...kindOccasions.value];
  const initial = initialOccasion.value;
  if (initial && initial.kind === where.value && !list.some((o) => o.id === initial.id)) list.unshift(initial);
  return list.map((o) => ({ value: o.id, label: o.label, hint: occasionHint(o) }));
});
const selectedOccasion = computed<InjuryOccasionDto | null>(() => {
  if (where.value === 'None' || !occasionId.value) return null;
  const initial = initialOccasion.value;
  return (occasions.value ?? []).find((o) => o.id === occasionId.value) ?? (initial?.id === occasionId.value ? initial : null);
});

function chooseWhere(next: Where) {
  where.value = next;
  occasionId.value = initialOccasion.value?.kind === next ? initialOccasion.value.id : null;
}

// En una lesión nueva o una recaída el parte se pone el día del partido o del entrenamiento; al corregir, la fecha se deja
// como está (si queda antes, se avisa).
function chooseOccasion(id: string | null) {
  occasionId.value = id;
  const o = selectedOccasion.value;
  if (!o || props.mode === 'edit') return;
  form.startedOn = o.day > today ? today : o.day;
  proposeReturn();
}

function useOccasionDay() {
  const o = selectedOccasion.value;
  if (!o) return;
  form.startedOn = o.day;
  proposeReturn();
}

const startedMin = computed(() => {
  const days = [props.startMin, selectedOccasion.value?.day].filter((d): d is string => !!d).sort();
  return days.length ? days[days.length - 1] : undefined;
});

const title = computed(() => (props.mode === 'edit' ? 'Corregir la lesión' : props.mode === 'relapse' ? `Recaída de ${props.target?.playerName ?? 'la lesión'}` : 'Nueva lesión'));
const formBlocked = computed(() => {
  if (busy.value) return busyTitle;
  if (props.mode === 'new' && !form.squadPlayerId) return 'Elige al jugador';
  if (!form.type) return 'Elige el tipo de lesión';
  if (asksSite.value) {
    if (!sitesLoaded.value) return sitesError.value ? 'No se ha podido cargar la lista de sitios del cuerpo' : 'Cargando los sitios del cuerpo…';
    if (!chosenSite.value) return siteMissing(typeDef.value?.siteKind ?? 'Zone');
    if (asksSide.value && !form.side) return sideMissing(sideSite.value as BodySiteDto);
  }
  if (where.value !== 'None' && !selectedOccasion.value) return where.value === 'Match' ? 'Elige el partido en que se lesionó' : 'Elige el entrenamiento en que se lesionó';
  if (!form.startedOn) return 'Pon la fecha del parte';
  if (form.startedOn > today) return 'La fecha del parte no puede ser posterior a hoy';
  if (props.startMin && form.startedOn < props.startMin) return 'La recaída no puede empezar antes del alta de la lesión anterior';
  const o = selectedOccasion.value;
  if (o && form.startedOn < o.day) return `La fecha del parte no puede ser anterior al día en que se lesionó (${formatDate(o.day)})`;
  if (form.expectedReturnOn && form.expectedReturnOn < form.startedOn) return 'La vuelta prevista no puede ser anterior al parte';
  return undefined;
});

const occasionFields = () => {
  const o = selectedOccasion.value;
  return { matchId: o?.kind === 'Match' ? o.id : null, trainingSessionId: o?.kind === 'Training' ? o.id : null };
};

// Lo que no pregunta el tipo no se manda.
const locationFields = () => ({
  site: asksSite.value ? (chosenSite.value?.code ?? null) : null,
  side: asksSide.value ? form.side : null,
  grade: typeDef.value?.graded && form.grade !== 'Unknown' ? form.grade : null,
  mechanism: asksSite.value && form.mechanism !== 'Unknown' ? form.mechanism : null,
});

const request = (): InjuryRequest => ({
  squadPlayerId: form.squadPlayerId,
  type: form.type as InjuryType,
  reason: form.reason.trim() || null,
  startedOn: form.startedOn,
  expectedReturnOn: form.expectedReturnOn || null,
  proposalId: props.mode === 'new' ? (proposal.value?.id ?? null) : null,
  ...occasionFields(),
  ...locationFields(),
});

async function save() {
  if (formBlocked.value) return;
  busy.value = true;
  error.value = null;
  fieldErrors.value = {};
  try {
    const t = props.target;
    let list: InjuryDto[];
    if (props.mode === 'edit' && t) list = await api.squads.updateInjury(props.squadId, t.id, request());
    else if (props.mode === 'relapse' && t)
      list = await api.squads.relapseInjury(props.squadId, t.id, {
        startedOn: form.startedOn,
        expectedReturnOn: form.expectedReturnOn || null,
        reason: form.reason.trim() || null,
        ...occasionFields(),
        ...locationFields(),
      });
    else list = await api.squads.recordInjury(props.squadId, request());
    emit('saved', list);
  } catch (e) {
    error.value = errorMessage(e);
    if (e instanceof ApiError) fieldErrors.value = e.fieldErrors;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal :open="open" :title="title" size="md" @close="emit('close')">
    <form :id="formId" class="space-y-4" @submit.prevent="save">
      <Alert v-if="error" kind="error">{{ error }}</Alert>
      <p v-if="proposal" class="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        <Icon icon="newspaper" class="mr-1 h-3 w-3" />
        <template v-if="mode === 'edit'">
          La crónica del J{{ proposal.matchday }} ({{ proposal.homeTeam }} – {{ proposal.awayTeam }}) cuenta que se lesionó. Al guardar, esta lesión queda como la de
          ese partido y la posible lesión, registrada.
        </template>
        <template v-else>
          Relleno con lo que cuenta la crónica del J{{ proposal.matchday }} ({{ proposal.homeTeam }} – {{ proposal.awayTeam }}). Revisa el tipo, dónde fue y la
          vuelta prevista antes de registrarla.
        </template>
      </p>
      <p v-if="mode === 'relapse' && target" class="text-sm text-slate-600">
        Ha vuelto a lesionarse de lo mismo después del alta del {{ formatDate(target.returnedOn ?? target.startedOn) }}. Se registra como lesión nueva, enlazada a la
        anterior, que conserva su alta y los {{ daysLabel(target.daysOut) }} que tardó en recuperarse.
      </p>
      <div v-if="mode !== 'relapse'">
        <label class="label" :for="`${formId}-player`">Jugador</label>
        <SearchSelect
          :id="`${formId}-player`"
          placeholder="Elige al jugador"
          :disabled="mode === 'edit' || !!preset?.lockPlayer"
          :model-value="form.squadPlayerId"
          :options="playerOptions"
          @update:model-value="form.squadPlayerId = ($event as string | null)"
        />
      </div>

      <!-- Dónde se lesionó: así se sabe cuándo fue -->
      <div>
        <p :id="`${formId}-where`" class="label">¿Dónde se lesionó?</p>
        <p v-if="lockOccasion && initialOccasion" class="flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-slate-700" :aria-labelledby="`${formId}-where`">
          <Icon :icon="occasionIcon(initialOccasion)" class="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span class="min-w-0 break-words">{{ capitalize(occasionPlace(initialOccasion)) }}</span>
        </p>
        <template v-else>
          <ChoiceToggle :model-value="where" :options="whereOptions" label="¿Dónde se lesionó?" @update:model-value="chooseWhere" />
          <div v-if="where !== 'None'" class="mt-2">
            <SearchSelect
              :id="`${formId}-occasion`"
              :aria-label="where === 'Match' ? 'Partido en que se lesionó' : 'Entrenamiento en que se lesionó'"
              :placeholder="occasions === null ? 'Cargando…' : where === 'Match' ? 'Elige el partido' : 'Elige el entrenamiento'"
              :disabled="occasions === null"
              :model-value="occasionId"
              :options="occasionOptions"
              @update:model-value="chooseOccasion($event as string | null)"
            />
            <p v-if="occasions !== null && occasionOptions.length === 0" class="mt-1 text-xs text-slate-500">
              {{ where === 'Match' ? 'Aún no se ha jugado ningún partido esta temporada' : 'Aún no ha empezado ningún entrenamiento de la plantilla' }}{{
                startMin ? ' después del alta de la lesión anterior' : '' }}.
            </p>
          </div>
          <p v-if="occasionsError" class="field-error">No se han podido cargar los partidos y entrenamientos: {{ occasionsError }}</p>
          <p class="mt-1 text-[11px] text-slate-500">
            Así queda cuándo fue: el partido la enseña como registrada y el entrenamiento, que se lesionó allí. «En otro sitio» si fue fuera del equipo o no se sabe.
          </p>
        </template>
      </div>

      <div>
        <label class="label" :for="`${formId}-type`">Tipo de lesión</label>
        <SearchSelect
          :id="`${formId}-type`"
          :placeholder="typesLoaded ? 'Elige el tipo' : 'Cargando…'"
          :disabled="mode === 'relapse'"
          :model-value="form.type"
          :options="typeOptions"
          @update:model-value="chooseType($event as InjuryType | null)"
        />
        <p v-if="averageDays" class="mt-1 text-xs text-slate-500">Duración media orientativa: {{ averageDays }} días. La vuelta prevista se propone con ella; cámbiala si el médico dice otra cosa.</p>
      </div>

      <!-- Dónde fue en el cuerpo: lo que pregunta el tipo (el músculo, el hueso, qué rodilla…) -->
      <template v-if="asksSite">
        <p v-if="!sitesLoaded" class="text-xs" :class="sitesError ? 'field-error' : 'text-slate-500'">
          {{ sitesError ? `No se ha podido cargar la lista de sitios del cuerpo: ${sitesError}` : 'Cargando los sitios del cuerpo…' }}
        </p>
        <template v-else>
          <div v-if="!baseSite && typeDef?.siteKind">
            <label class="label" :for="`${formId}-site`">{{ siteQuestion(typeDef.siteKind) }}</label>
            <SearchSelect
              :id="`${formId}-site`"
              placeholder="Elige de la lista"
              searchable
              :model-value="form.site"
              :options="siteOptions"
              @update:model-value="chooseSite($event as string | null)"
            />
            <p v-if="typeDef.siteKind === 'Muscle'" class="mt-1 text-[11px] text-slate-500">
              Si no se sabe el músculo exacto, elige su grupo (isquiotibiales, cuádriceps, gemelos y sóleo…).
            </p>
          </div>
          <div v-if="asksSide && sideSite">
            <p class="label">{{ sideQuestion(sideSite) }}</p>
            <ChoiceToggle :model-value="form.side" :options="sideOptions(sideSite)" :label="sideQuestion(sideSite)" @update:model-value="form.side = $event" />
          </div>
          <div v-if="baseSite && offered.length">
            <p class="label">{{ refineQuestion }} <span class="font-normal text-slate-400">(si se sabe)</span></p>
            <ChoiceToggle
              v-if="refineOptions.length <= 6"
              :model-value="form.site ?? baseSite.code"
              :options="refineOptions"
              :label="refineQuestion"
              @update:model-value="chooseSite($event)"
            />
            <SearchSelect
              v-else
              :aria-label="refineQuestion"
              searchable
              :model-value="form.site ?? baseSite.code"
              :options="refineOptions.map((o) => ({ value: o.value, label: o.label }))"
              @update:model-value="chooseSite($event as string | null)"
            />
          </div>
          <p v-if="locationPreview" class="text-xs text-slate-600"><Icon icon="location-dot" class="mr-1 h-3 w-3 text-slate-400" />Quedará como: <strong class="font-semibold">{{ locationPreview }}</strong></p>
        </template>
      </template>
      <div v-if="typeDef?.graded">
        <p class="label">Grado <span class="font-normal text-slate-400">(si se sabe)</span></p>
        <ChoiceToggle :model-value="form.grade" :options="gradeOptions" label="Grado de la lesión" @update:model-value="form.grade = $event" />
      </div>
      <div v-if="asksSite">
        <p class="label">¿Cómo se produjo? <span class="font-normal text-slate-400">(si se sabe)</span></p>
        <ChoiceToggle :model-value="form.mechanism" :options="mechanismOptions" label="Cómo se produjo la lesión" @update:model-value="form.mechanism = $event" />
      </div>

      <div>
        <label class="label" :for="`${formId}-reason`">Motivo o detalle <span class="font-normal text-slate-400">(opcional)</span></label>
        <input :id="`${formId}-reason`" v-model="form.reason" type="text" maxlength="300" class="input" placeholder="Lo que dijo el médico, cómo fue la jugada…" />
        <p v-if="fieldErrors.reason" class="field-error">{{ fieldErrors.reason[0] }}</p>
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label class="label" :for="`${formId}-start`">Fecha del parte</label>
          <input :id="`${formId}-start`" v-model="form.startedOn" type="date" required class="input" :min="startedMin" :max="today" @change="proposeReturn()" />
          <p class="mt-1 text-[11px] text-slate-500">Desde ese día cuentan los días de baja.</p>
          <button
            v-if="selectedOccasion && form.startedOn !== selectedOccasion.day && selectedOccasion.day <= today"
            type="button"
            class="mt-1 text-left text-[11px] font-medium text-brand-600 underline underline-offset-2 hover:text-brand-700"
            @click="useOccasionDay"
          >
            Poner el día {{ selectedOccasion.kind === 'Match' ? 'del partido' : 'del entrenamiento' }} ({{ formatDate(selectedOccasion.day) }})
          </button>
        </div>
        <div>
          <label class="label" :for="`${formId}-return`">Vuelta prevista <span class="font-normal text-slate-400">(opcional)</span></label>
          <input :id="`${formId}-return`" v-model="form.expectedReturnOn" type="date" class="input" :min="form.startedOn" />
          <p v-if="fieldErrors.expectedReturnOn" class="field-error">{{ fieldErrors.expectedReturnOn[0] }}</p>
        </div>
      </div>
    </form>
    <template #footer>
      <div class="flex flex-wrap items-center justify-end gap-2">
        <p v-if="formBlocked && formBlocked !== busyTitle" class="mr-auto text-xs text-slate-500" role="status">{{ formBlocked }}</p>
        <button type="button" class="btn-ghost" @click="emit('close')">Cancelar</button>
        <button type="submit" :form="formId" class="btn-primary" v-busy="busy" :disabled="!!formBlocked" :title="formBlocked">
          {{ mode === 'edit' ? 'Guardar' : mode === 'relapse' ? 'Registrar la recaída' : 'Registrar lesión' }}
        </button>
      </div>
    </template>
  </Modal>
</template>
