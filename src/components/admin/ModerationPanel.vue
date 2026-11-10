<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import { adminApi } from '@/api/admin';
import { errorMessage } from '@/api/http';
import Alert from '@/components/ui/Alert.vue';
import Badge from '@/components/ui/Badge.vue';
import { confirmDialog } from '@/composables/useConfirm';
import type { CommentCheckDto, CommentFilter, ForbiddenWordKind, ForbiddenWordsDto, RefereeCommentAdminDto, RefereeCommentsDto } from '@/types/api';
import { formatDate, formatKickoff, officialRoleLabels, raterLabel } from '@/utils/format';

/**
 * Moderación de los comentarios de las notas a los árbitros. Los que llevan palabras de la tabla PalabrasProhibidas no se
 * pueden guardar; aun así, el administrador puede retirar cualquier comentario fuera de lugar (la nota sigue publicada) y
 * mantener la lista de palabras y expresiones prohibidas.
 */
const props = defineProps<{ token: string }>();
const emit = defineEmits<{ unauthorized: [] }>();

const error = ref<string | null>(null);
const notice = ref<string | null>(null);

async function guard<T>(action: () => Promise<T>): Promise<T | undefined> {
  try {
    error.value = null;
    return await action();
  } catch (e) {
    if ((e as { status?: number }).status === 401) emit('unauthorized');
    else error.value = errorMessage(e);
    return undefined;
  }
}

// --- Comentarios ---
const filters: { value: CommentFilter; label: string }[] = [
  { value: 'All', label: 'Todos' },
  { value: 'Flagged', label: 'Con palabras prohibidas' },
  { value: 'Hidden', label: 'Retirados' },
  { value: 'Visible', label: 'Publicados' },
];
const filter = ref<CommentFilter>('All');
const search = ref('');
const comments = shallowRef<RefereeCommentsDto | null>(null);
const loadingComments = ref(false);
const toggling = ref<string | null>(null);

async function loadComments() {
  loadingComments.value = true;
  const result = await guard(() => adminApi.refereeComments(props.token, filter.value, search.value.trim()));
  if (result) comments.value = result;
  loadingComments.value = false;
}
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(filter, loadComments);
watch(search, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(loadComments, 300);
});

async function toggle(comment: RefereeCommentAdminDto) {
  const hide = !comment.hidden;
  const ok = await confirmDialog(hide
    ? {
      title: 'Retirar el comentario',
      message: `El comentario de ${comment.teamName} a ${comment.refereeName} dejará de publicarse y saldrá como retirado por la administración. La nota (${comment.score}) se mantiene.`,
      confirmLabel: 'Retirar comentario',
      danger: true,
    }
    : {
      title: 'Volver a publicar el comentario',
      message: `El comentario de ${comment.teamName} a ${comment.refereeName} volverá a verse en público.`,
      confirmLabel: 'Volver a publicarlo',
    });
  if (!ok) return;
  toggling.value = comment.ratingId;
  const updated = await guard(() => adminApi.setCommentHidden(props.token, comment.ratingId, hide));
  toggling.value = null;
  if (!updated || !comments.value) return;
  notice.value = hide ? 'Comentario retirado: la nota sigue publicada.' : 'Comentario publicado de nuevo.';
  await loadComments();
}

// --- Palabras prohibidas ---
const kindLabels: Record<ForbiddenWordKind, string> = { Profanity: 'Palabrotas', Insult: 'Insultos', Slur: 'Vejaciones', Threat: 'Amenazas' };
const kinds = Object.keys(kindLabels) as ForbiddenWordKind[];
const words = shallowRef<ForbiddenWordsDto | null>(null);
const wordSearch = ref('');
const kindFilter = ref<ForbiddenWordKind | null>(null);
const newTerm = ref('');
const newKind = ref<ForbiddenWordKind>('Insult');
const savingWord = ref(false);

const normalize = (text: string) => text.normalize('NFD').replace(/[̀-̂̄-ͯ]/g, '').toLowerCase();
const shownWords = computed(() => {
  const needle = normalize(wordSearch.value.trim());
  return (words.value?.words ?? []).filter((w) => (!kindFilter.value || w.kind === kindFilter.value) && (!needle || normalize(w.term).includes(needle)));
});
const countByKind = computed(() => Object.fromEntries(kinds.map((k) => [k, (words.value?.words ?? []).filter((w) => w.kind === k).length])) as Record<ForbiddenWordKind, number>);

async function loadWords() {
  const result = await guard(() => adminApi.forbiddenWords(props.token));
  if (result) words.value = result;
}

async function addWord() {
  const term = newTerm.value.trim();
  if (!term) return;
  savingWord.value = true;
  const result = await guard(() => adminApi.addForbiddenWord(props.token, term, newKind.value));
  savingWord.value = false;
  if (!result) return;
  words.value = result;
  notice.value = `«${term}» añadida: desde ya no se puede publicar en un comentario.`;
  newTerm.value = '';
  await loadComments();
}

async function removeWord(term: string) {
  if (!(await confirmDialog({ title: `Quitar «${term}»`, message: 'Dejará de bloquearse en los comentarios desde ya.', confirmLabel: 'Quitar', danger: true }))) return;
  const result = await guard(() => adminApi.removeForbiddenWord(props.token, term));
  if (!result) return;
  words.value = result;
  notice.value = `«${term}» quitada de la lista.`;
  await loadComments();
}

// --- Probar un texto ---
const sample = ref('');
const sampleResult = shallowRef<CommentCheckDto | null>(null);
async function check() {
  if (!sample.value.trim()) return;
  const result = await guard(() => adminApi.checkText(props.token, sample.value));
  if (result) sampleResult.value = result;
}
watch(sample, () => { sampleResult.value = null; });

onMounted(() => {
  void loadComments();
  void loadWords();
});
</script>

<template>
  <div class="space-y-6">
    <Alert v-if="error" kind="error">{{ error }}</Alert>
    <Alert v-if="notice" kind="success">{{ notice }}</Alert>

    <section class="card">
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="font-semibold text-slate-900">Comentarios de las notas a los árbitros</h2>
          <p class="max-w-3xl text-xs text-slate-500">
            Los comentarios con palabras de la lista no se pueden guardar. Si aun así alguno está fuera de lugar (o es anterior a una palabra
            añadida después), retíralo: la nota sigue publicada y en público sale «comentario retirado por la administración».
          </p>
        </div>
        <div v-if="comments" class="flex flex-wrap gap-2 text-xs">
          <Badge tone="slate">{{ comments.total }} comentarios</Badge>
          <Badge :tone="comments.flagged ? 'red' : 'green'">{{ comments.flagged }} con palabras prohibidas</Badge>
          <Badge tone="amber">{{ comments.hidden }} retirados</Badge>
        </div>
      </div>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="relative w-full sm:w-64">
          <span class="sr-only">Buscar comentario</span>
          <Icon icon="magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input v-model="search" type="search" class="input w-full py-1.5 pl-9 text-sm" placeholder="Texto, árbitro, equipo o quién lo puso" />
        </label>
        <button
          v-for="option in filters"
          :key="option.value"
          type="button"
          class="rounded-full border px-3 py-1 text-xs"
          :class="filter === option.value ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600'"
          @click="filter = option.value"
        >{{ option.label }}</button>
        <button type="button" class="btn-ghost text-xs" v-busy="loadingComments" :disabled="loadingComments" title="Actualizar" @click="loadComments">
          <Icon icon="rotate-right" class="h-3 w-3" />
        </button>
      </div>

      <p v-if="comments && comments.comments.length === 0" class="text-sm text-slate-500">
        {{ comments.total === 0 ? 'Todavía no hay comentarios en las notas a los árbitros.' : 'Ningún comentario en este filtro.' }}
      </p>
      <ul v-else-if="comments" class="max-h-[48rem] space-y-2 overflow-y-auto pr-1">
        <li
          v-for="comment in comments.comments"
          :key="comment.ratingId"
          class="rounded-xl border p-3"
          :class="comment.flaggedTerms.length ? 'border-red-400/60 bg-red-500/5' : 'border-line bg-surface-2'"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div class="min-w-0 text-xs text-slate-500">
              <p>
                <strong class="text-slate-800">{{ comment.teamName }}</strong> puntuó con un <strong class="text-slate-800">{{ comment.score }}</strong>
                a {{ comment.refereeName }} ({{ officialRoleLabels[comment.role].toLowerCase() }})
              </p>
              <p>{{ comment.homeTeamName }} – {{ comment.awayTeamName }} · {{ formatDate(comment.kickoffAt) }} · por {{ raterLabel(comment.ratedBy) }}</p>
            </div>
            <div class="flex items-center gap-2">
              <Badge v-if="comment.hidden" tone="amber">Retirado{{ comment.hiddenAt ? ` el ${formatKickoff(comment.hiddenAt)}` : '' }}</Badge>
              <button
                type="button"
                class="text-xs"
                :class="comment.hidden ? 'btn-ghost' : 'btn-ghost border-red-400/60 text-red-500 hover:bg-red-500/10'"
                v-busy="toggling === comment.ratingId"
                :disabled="toggling !== null"
                @click="toggle(comment)"
              >
                <Icon :icon="comment.hidden ? 'eye' : 'eye-slash'" class="h-3 w-3" />{{ comment.hidden ? 'Volver a publicar' : 'Retirar comentario' }}
              </button>
            </div>
          </div>
          <p class="mt-2 text-sm leading-relaxed" :class="comment.hidden ? 'text-slate-500 line-through' : 'text-slate-700'">“{{ comment.comment }}”</p>
          <p v-if="comment.flaggedTerms.length" class="mt-1 flex flex-wrap items-center gap-1 text-xs text-red-500">
            Contiene:
            <span v-for="term in comment.flaggedTerms" :key="term" class="rounded bg-red-500/10 px-1.5 py-0.5 font-semibold">{{ term }}</span>
          </p>
        </li>
      </ul>
    </section>

    <section class="card">
      <div class="mb-3">
        <h2 class="font-semibold text-slate-900">Palabras prohibidas <span class="text-xs font-normal text-slate-500">(tabla PalabrasProhibidas)</span></h2>
        <p class="max-w-3xl text-xs text-slate-500">
          Ningún comentario que las contenga se puede guardar. Se comparan palabras enteras, sin mayúsculas ni tildes (la ñ cuenta) y deshaciendo
          disfraces como «p0ll4», «putaaa», «p*ta» o «p u t a»; una palabra suelta vale también en plural y una expresión, con sus palabras seguidas.
        </p>
      </div>

      <form class="mb-4 flex flex-wrap items-end gap-2" @submit.prevent="addWord">
        <div class="min-w-0 flex-1 sm:max-w-xs">
          <label class="label" for="forbidden-term">Palabra o expresión</label>
          <input id="forbidden-term" v-model="newTerm" class="input w-full" maxlength="160" placeholder="p. ej. tuercebotas" />
        </div>
        <div>
          <label class="label" for="forbidden-kind">Tipo</label>
          <select id="forbidden-kind" v-model="newKind" class="input">
            <option v-for="kind in kinds" :key="kind" :value="kind">{{ kindLabels[kind] }}</option>
          </select>
        </div>
        <button type="submit" class="btn-primary" v-busy="savingWord" :disabled="savingWord || !newTerm.trim()"><Icon icon="plus" class="h-3.5 w-3.5" />Añadir</button>
      </form>

      <div class="mb-3 flex flex-wrap items-center gap-2">
        <label class="relative w-full sm:w-56">
          <span class="sr-only">Buscar en la lista</span>
          <Icon icon="magnifying-glass" class="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input v-model="wordSearch" type="search" class="input w-full py-1.5 pl-9 text-sm" placeholder="Buscar en la lista" />
        </label>
        <button
          type="button"
          class="rounded-full border px-3 py-1 text-xs"
          :class="kindFilter === null ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600'"
          @click="kindFilter = null"
        >Todas ({{ words?.total ?? 0 }})</button>
        <button
          v-for="kind in kinds"
          :key="kind"
          type="button"
          class="rounded-full border px-3 py-1 text-xs"
          :class="kindFilter === kind ? 'border-brand-400 bg-brand-500 text-white' : 'border-line text-slate-600'"
          @click="kindFilter = kind"
        >{{ kindLabels[kind] }} ({{ countByKind[kind] }})</button>
      </div>

      <p v-if="words && shownWords.length === 0" class="text-sm text-slate-500">Nada en la lista con ese filtro.</p>
      <ul v-else class="flex max-h-96 flex-wrap gap-1.5 overflow-y-auto pr-1">
        <li v-for="word in shownWords" :key="word.term" class="flex items-center gap-1 rounded-full border border-line bg-surface-2 py-0.5 pl-2.5 pr-1 text-xs">
          <span class="h-1.5 w-1.5 rounded-full" :class="{ 'bg-amber-400': word.kind === 'Profanity', 'bg-red-500': word.kind === 'Insult', 'bg-blue-400': word.kind === 'Slur', 'bg-slate-400': word.kind === 'Threat' }" :title="kindLabels[word.kind]" />
          <span class="text-slate-700">{{ word.term }}</span>
          <button type="button" class="rounded-full p-1 text-slate-400 hover:bg-red-500/10 hover:text-red-500" :aria-label="`Quitar ${word.term}`" @click="removeWord(word.term)">
            <Icon icon="xmark" class="h-2.5 w-2.5" />
          </button>
        </li>
      </ul>
    </section>

    <section class="card">
      <h2 class="font-semibold text-slate-900">Probar un texto</h2>
      <p class="text-xs text-slate-500">Lo mismo que se comprueba al guardar un comentario.</p>
      <form class="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start" @submit.prevent="check">
        <textarea v-model="sample" rows="2" class="input min-w-0 flex-1 text-sm" placeholder="Escribe un comentario de prueba" />
        <button type="submit" class="btn-ghost shrink-0" :disabled="!sample.trim()">Probar</button>
      </form>
      <Alert v-if="sampleResult" :kind="sampleResult.allowed ? 'success' : 'error'" class="mt-3">
        {{ sampleResult.allowed ? 'Se puede publicar.' : sampleResult.message }}
      </Alert>
    </section>
  </div>
</template>
