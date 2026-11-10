<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';

/**
 * Elegir una nota de 0 a 10: tocando una de las diez estrellas (cada una es un punto) o escribiéndola en la casilla, que
 * también sube y baja con las flechas. El 0 no tiene estrella: se escribe.
 */
const props = defineProps<{ disabled?: boolean; label?: string }>();
const model = defineModel<number | null>({ required: true });

const id = useId();
const hover = ref<number | null>(null);
const shown = computed(() => hover.value ?? model.value ?? 0);

const typed = ref(model.value === null ? '' : String(model.value));
const invalid = ref(false);
watch(model, (value) => {
  if (value !== null) {
    typed.value = String(value);
    invalid.value = false;
  } else if (!invalid.value) {
    typed.value = '';
  }
});

function onType(event: Event) {
  const text = (event.target as HTMLInputElement).value.trim();
  typed.value = text;
  if (text === '') {
    invalid.value = false;
    model.value = null;
    return;
  }
  const value = Number(text.replace(',', '.'));
  invalid.value = !Number.isInteger(value) || value < 0 || value > 10;
  model.value = invalid.value ? null : value;
}

function step(by: number) {
  model.value = Math.max(0, Math.min(10, (model.value ?? (by > 0 ? -1 : 11)) + by));
}

function pick(star: number) {
  model.value = star;
  hover.value = null;
}

// Solo con ratón: en pantallas táctiles el «hover» se quedaría pegado tras tocar.
function preview(event: PointerEvent, star: number) {
  if (event.pointerType === 'mouse') hover.value = star;
}

const grade = computed(() => {
  const value = hover.value ?? model.value;
  if (value === null) return null;
  if (value < 5) return { label: 'Suspenso', tone: 'text-red-500' };
  if (value < 6) return { label: 'Aprobado', tone: 'text-amber-500' };
  if (value < 7) return { label: 'Bien', tone: 'text-amber-500' };
  if (value < 9) return { label: 'Notable', tone: 'text-emerald-600' };
  return { label: 'Sobresaliente', tone: 'text-emerald-600' };
});
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div class="flex gap-0.5 sm:gap-1" @pointerleave="hover = null">
        <button
          v-for="star in 10"
          :key="star"
          type="button"
          tabindex="-1"
          class="rounded-sm transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:hover:scale-100"
          :class="star <= shown ? 'text-amber-400' : 'text-slate-400/30'"
          :disabled="props.disabled"
          :title="`Un ${star}`"
          :aria-label="`Nota ${star}`"
          @pointerenter="preview($event, star)"
          @click="pick(star)"
        >
          <Icon icon="star" class="h-6 w-6 sm:h-7 sm:w-7" />
        </button>
      </div>

      <div class="flex items-center gap-2">
        <label :for="id" class="sr-only">{{ props.label ?? 'Nota de 0 a 10' }}</label>
        <input
          :id="id"
          :value="typed"
          type="text"
          inputmode="numeric"
          maxlength="2"
          autocomplete="off"
          placeholder="–"
          class="input w-14 px-2 py-1 text-center font-figures text-lg font-extrabold"
          :class="invalid ? 'border-red-400 focus:border-red-400' : ''"
          :disabled="props.disabled"
          :aria-invalid="invalid"
          :aria-describedby="`${id}-hint`"
          @input="onType"
          @focus="($event.target as HTMLInputElement).select()"
          @keydown.up.prevent="step(1)"
          @keydown.down.prevent="step(-1)"
        />
        <span class="text-sm font-medium text-slate-500">/10</span>
        <span v-if="grade" class="text-xs font-semibold" :class="grade.tone">{{ grade.label }}</span>
      </div>
    </div>
    <p :id="`${id}-hint`" class="mt-1 text-xs" :class="invalid ? 'text-red-500' : 'text-slate-500'">
      {{ invalid ? 'Escribe un número entero del 0 al 10.' : 'Toca una estrella o escribe la nota; el 0, escribiéndolo.' }}
    </p>
  </div>
</template>
