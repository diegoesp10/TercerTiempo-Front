<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { MY_CLUB_GROUP } from '@/composables/useMyClub';
import { useAuthStore } from '@/stores/auth';
import type { CompetitionDto, CompetitionLevel } from '@/types/api';
import { groupByLevel, levelLabels } from '@/utils/format';

const auth = useAuthStore();

const props = defineProps<{
  competitions: CompetitionDto[];
  modelValue: string | null;
}>();

const emit = defineEmits<{ 'update:modelValue': [id: string] }>();

const groups = computed(() => groupByLevel(props.competitions));

const activeLevel = ref<CompetitionLevel | null>(null);

watch(
  () => [props.modelValue, groups.value] as const,
  ([selected, levelGroups]) => {
    const current = levelGroups.find((g) => g.competitions.some((c) => c.id === selected));
    activeLevel.value = current?.level ?? activeLevel.value ?? levelGroups[0]?.level ?? null;
  },
  { immediate: true },
);

const visible = computed(() => groups.value.find((g) => g.level === activeLevel.value)?.competitions ?? []);

function selectLevel(level: CompetitionLevel) {
  activeLevel.value = level;
  const first = groups.value.find((g) => g.level === level)?.competitions[0];
  if (first && !visible.value.some((c) => c.id === props.modelValue)) emit('update:modelValue', first.id);
}
</script>

<template>
  <div class="space-y-3">
    <div class="flex flex-wrap gap-2" role="tablist" aria-label="Nivel">
      <button
        v-for="group in groups"
        :key="group.level"
        type="button"
        role="tab"
        :aria-selected="group.level === activeLevel"
        class="rounded-full px-4 py-1.5 text-sm font-medium transition"
        :class="group.level === activeLevel ? 'bg-action text-white shadow-glow' : 'bg-surface text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100'"
        @click="selectLevel(group.level)"
      >
        {{ levelLabels[group.level] }}
      </button>
    </div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="competition in visible"
        :key="competition.id"
        type="button"
        class="rounded-lg border px-3 py-2 text-left text-sm transition"
        :class="competition.id === modelValue
          ? 'border-brand-400 bg-brand-500/15 text-emerald-700'
          : 'border-slate-200 bg-surface text-slate-700 hover:border-brand-400/60'"
        @click="emit('update:modelValue', competition.id)"
      >
        <Icon v-if="auth.myCompetitionIds.includes(competition.id)" icon="star" class="mr-1 h-3 w-3 text-accent-400" :title="MY_CLUB_GROUP" />
        <span class="font-medium">{{ competition.category }}</span>
        <span v-if="competition.group" class="ml-1 text-slate-500">· Grupo {{ competition.group }}</span>
        <span class="ml-2 text-xs text-slate-400">{{ competition.teamsCount }} equipos</span>
      </button>
    </div>
  </div>
</template>
