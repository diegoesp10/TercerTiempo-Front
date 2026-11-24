<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue';
import { onClickOutside } from '@vueuse/core';
import { RouterLink, useRoute } from 'vue-router';
import { useFit } from '@/composables/useFit';
import type { TabItem } from '@/components/ui/tabs';

// Pestañas que nunca se desbordan ni se cortan: si no caben enteras (ni con su etiqueta corta, si la tienen), se pliegan
// en un menú de hamburguesa con la pestaña activa a la vista. Sirven para navegar (con `to`) o para cambiar de vista
// (v-model con la clave de la pestaña).
const props = withDefaults(
  defineProps<{
    items: readonly TabItem[];
    modelValue?: string | null;
    label: string;
    variant?: 'underline' | 'pills' | 'segmented' | 'toggle';
    tone?: 'brand' | 'accent';
    // Se apoyan en la línea inferior de su contenedor (la cabecera de una tarjeta) en lugar de llevar la suya.
    inset?: boolean;
  }>(),
  { modelValue: null, variant: 'underline', tone: 'brand', inset: false },
);
const emit = defineEmits<{ 'update:modelValue': [key: string] }>();

const route = useRoute();
const root = ref<HTMLElement | null>(null);
const row = ref<HTMLElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);
const open = ref(false);
const alignRight = ref(false);
const panelId = useId();

const { step } = useFit(row, [[], ['short'], ['collapsed']]);
const collapsed = computed(() => step.value === 2);
const navigates = computed(() => props.items.length > 0 && props.items.every((item) => !!item.to));
const active = computed(() => props.items.find((item) => item.key === props.modelValue) ?? null);
const hasCount = (item: TabItem) => item.count !== null && item.count !== undefined && item.count !== '';
const tint = (item: TabItem) => (item.color && item.key === props.modelValue && props.variant !== 'underline' ? { background: item.color } : undefined);

watch(collapsed, (value) => {
  if (!value) open.value = false;
});
watch(() => route.fullPath, () => {
  open.value = false;
});
onClickOutside(root, () => {
  open.value = false;
});

function toggle() {
  if (open.value) {
    open.value = false;
    return;
  }
  // El menú se abre hacia el lado en que cabe (16 rem de ancho como mucho).
  const box = root.value?.getBoundingClientRect();
  alignRight.value = !!box && box.left + 256 > window.innerWidth - 16 && box.right >= 256;
  open.value = true;
}

function choose(item: TabItem) {
  open.value = false;
  if (!item.to && item.key !== props.modelValue) emit('update:modelValue', item.key);
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !open.value) return;
  open.value = false;
  trigger.value?.focus();
}

function attrs(item: TabItem, inMenu = false) {
  const current = item.key === props.modelValue;
  if (item.to) return { to: item.to, 'aria-current': current ? 'page' : undefined };
  return inMenu ? { type: 'button', 'aria-current': current ? 'true' : undefined } : { type: 'button', role: 'tab', 'aria-selected': current };
}

const accentTone = computed(() => props.tone === 'accent');
const look = computed(() => {
  if (props.variant === 'pills') {
    return {
      row: '',
      items: 'gap-2',
      item: 'gap-2 rounded-full px-4 py-1.5 text-sm font-medium',
      on: 'bg-action text-white shadow-glow',
      off: 'bg-surface text-slate-600 ring-1 ring-line hover:bg-surface-2 hover:text-slate-900',
      count: 'bg-white/20 text-white',
      trigger: 'gap-2 rounded-full bg-action px-4 py-1.5 text-sm font-medium text-white shadow-glow',
    };
  }
  if (props.variant === 'toggle') {
    return {
      row: '',
      items: 'gap-0.5 rounded-full border border-line bg-surface-2 p-1',
      item: 'gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
      on: 'bg-action text-white',
      off: 'text-slate-600 hover:text-slate-900',
      count: 'bg-white/20 text-white',
      trigger: 'gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900',
    };
  }
  if (props.variant === 'segmented') {
    return {
      row: '',
      items: 'rounded-lg border border-line text-xs',
      item: 'gap-1.5 px-3 py-1.5 font-medium first:rounded-l-[7px] last:rounded-r-[7px]',
      on: 'bg-brand-500 text-white',
      off: 'text-slate-600 hover:bg-surface-2 hover:text-slate-900',
      count: 'bg-white/20 text-white',
      trigger: 'gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-surface-2',
    };
  }
  const on = accentTone.value ? 'border-accent-400 text-slate-900' : 'border-brand-500 text-brand-500';
  const pad = props.inset ? 'px-3 pb-3' : 'px-4 py-2';
  return {
    row: props.inset ? '' : 'border-b border-line',
    items: 'gap-1',
    item: `-mb-px gap-1.5 border-b-2 text-sm font-semibold ${pad}`,
    on,
    off: 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800',
    count: 'bg-surface-2 text-slate-500',
    trigger: `-mb-px gap-2 border-b-2 text-sm font-semibold ${pad} ${on}`,
  };
});
</script>

<template>
  <div ref="root" class="relative min-w-0 max-w-full" @keydown="onKeydown">
    <component
      :is="navigates ? 'nav' : 'div'"
      ref="row"
      class="group/tabs flex min-w-0 max-w-full items-end"
      :class="look.row"
      :aria-label="navigates ? label : undefined"
    >
      <div
        class="flex shrink-0 items-end group-data-[collapsed]/tabs:hidden"
        :class="look.items"
        :role="navigates ? undefined : 'tablist'"
        :aria-label="navigates ? undefined : label"
      >
        <component
          :is="item.to ? RouterLink : 'button'"
          v-for="item in items"
          :key="item.key"
          v-bind="attrs(item)"
          class="inline-flex shrink-0 cursor-pointer items-center whitespace-nowrap transition"
          :class="[look.item, item.key === modelValue ? look.on : look.off]"
          :style="tint(item)"
          :title="item.title"
          @click="choose(item)"
        >
          <Icon v-if="item.icon" :icon="item.icon" class="h-3.5 w-3.5 shrink-0" />
          <span :class="item.short ? 'group-data-[short]/tabs:hidden' : ''">{{ item.label }}</span>
          <span v-if="item.short" class="hidden group-data-[short]/tabs:inline">{{ item.short }}</span>
          <span
            v-if="hasCount(item)"
            class="rounded-full px-1.5 py-0.5 font-figures text-[11px] leading-none"
            :class="item.key === modelValue && variant !== 'underline' ? look.count : 'bg-surface-2 text-slate-500'"
          >{{ item.count }}</span>
        </component>
      </div>

      <!-- Plegadas: la pestaña activa con la hamburguesa; al pulsar, todas en una lista. -->
      <button
        ref="trigger"
        type="button"
        class="hidden shrink-0 cursor-pointer items-center whitespace-nowrap transition group-data-[collapsed]/tabs:inline-flex"
        :class="look.trigger"
        aria-haspopup="true"
        :aria-expanded="open"
        :aria-controls="panelId"
        @click="toggle"
      >
        <Icon :icon="open ? 'xmark' : 'bars'" class="h-3.5 w-3.5 shrink-0" />
        <span v-if="active?.color" class="h-2 w-2 shrink-0 rounded-full" :style="{ background: active.color }" aria-hidden="true" />
        <span><span class="sr-only">{{ label }}: </span>{{ active?.label ?? label }}</span>
        <span v-if="active && hasCount(active)" class="rounded-full px-1.5 py-0.5 font-figures text-[11px] leading-none" :class="look.count">{{ active.count }}</span>
        <Icon icon="chevron-down" class="h-3 w-3 shrink-0 transition-transform" :class="open ? 'rotate-180' : ''" />
      </button>
    </component>

    <ul
      v-if="open && collapsed"
      :id="panelId"
      class="absolute top-full z-30 mt-1.5 w-max min-w-48 max-w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-line bg-surface py-1 shadow-card"
      :class="alignRight ? 'right-0' : 'left-0'"
    >
      <li v-for="item in items" :key="item.key">
        <component
          :is="item.to ? RouterLink : 'button'"
          v-bind="attrs(item, true)"
          class="flex w-full cursor-pointer items-center gap-2.5 px-3 py-2 text-left text-sm transition"
          :class="item.key === modelValue ? 'bg-brand-500/15 font-semibold text-slate-900' : 'text-slate-700 hover:bg-surface-2'"
          :title="item.title"
          @click="choose(item)"
        >
          <Icon v-if="item.icon" :icon="item.icon" class="h-3.5 w-3.5 shrink-0 text-slate-500" />
          <span v-else-if="item.color" class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: item.color }" aria-hidden="true" />
          <span class="min-w-0 flex-1">{{ item.label }}</span>
          <span v-if="hasCount(item)" class="rounded-full bg-surface-2 px-1.5 py-0.5 font-figures text-[11px] leading-none text-slate-500">{{ item.count }}</span>
          <Icon v-if="item.key === modelValue" icon="check" class="h-3 w-3 shrink-0 text-brand-500" />
        </component>
      </li>
    </ul>
  </div>
</template>
