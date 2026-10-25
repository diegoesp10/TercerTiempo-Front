<script setup lang="ts">
import { computed } from 'vue';
import Badge from '@/components/ui/Badge.vue';
import PlayerAvatar from '@/components/teams/PlayerAvatar.vue';
import TeamCrest from '@/components/teams/TeamCrest.vue';
import type { SearchItemDto } from '@/types/api';
import { formatKickoff } from '@/utils/format';
import { highlightParts } from '@/utils/highlight';

/** Un resultado del buscador: imagen (escudo, foto o los dos escudos del partido), título con lo buscado resaltado y contexto. */
const props = defineProps<{ item: SearchItemDto; terms: string[]; active?: boolean; compact?: boolean }>();

const title = computed(() => highlightParts(props.item.title, props.terms));
const typeIcon: Record<SearchItemDto['type'], string> = {
  competition: 'list-ol',
  team: 'shield-halved',
  club: 'house',
  player: 'user',
  match: 'futbol',
  squad: 'users',
};
const badgeTone = (badge: string) => (badge.startsWith('Tu') || badge.startsWith('De tu') || badge === 'Partido tuyo' ? 'blue' : 'slate');
</script>

<template>
  <RouterLink
    :to="item.link"
    class="group flex items-center gap-3 rounded-xl px-3 py-2.5 outline-none transition"
    :class="active ? 'bg-brand-500/15 ring-1 ring-brand-400/60' : 'hover:bg-surface-2'"
  >
    <!-- Imagen -->
    <div class="relative flex h-10 w-10 shrink-0 items-center justify-center">
      <template v-if="item.imageKind === 'match'">
        <TeamCrest :src="item.imageUrl" :name="item.title" size="xs" class="absolute left-0 top-0" />
        <TeamCrest :src="item.secondaryImageUrl" :name="item.title" size="xs" class="absolute bottom-0 right-0" />
      </template>
      <template v-else-if="item.imageKind === 'photo'">
        <PlayerAvatar :src="item.imageUrl" :name="item.title" size="md" />
        <TeamCrest v-if="item.secondaryImageUrl" :src="item.secondaryImageUrl" :name="item.subtitle ?? ''" size="xs" class="absolute -bottom-1 -right-1 ring-2 ring-surface" />
      </template>
      <TeamCrest v-else-if="item.imageKind === 'crest'" :src="item.imageUrl" :name="item.title" size="md" />
      <span v-else class="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/15 text-brand-500">
        <Icon :icon="typeIcon[item.type]" class="h-4 w-4" />
      </span>
    </div>

    <!-- Texto -->
    <div class="min-w-0 flex-1">
      <p class="truncate font-semibold text-slate-900" :class="compact ? 'text-sm' : ''">
        <template v-for="(part, i) in title" :key="i"><mark v-if="part.match" class="rounded-sm bg-accent-400/25 px-0.5 text-inherit">{{ part.text }}</mark><template v-else>{{ part.text }}</template></template>
      </p>
      <p v-if="item.subtitle || item.date" class="truncate text-xs text-slate-500">
        {{ item.subtitle }}<template v-if="item.date"> · {{ formatKickoff(item.date) }}</template>
      </p>
    </div>

    <!-- Lo de la derecha -->
    <div class="flex shrink-0 items-center gap-2">
      <span v-if="item.badges.length" class="hidden items-center gap-2 sm:flex">
        <Badge v-for="badge in item.badges.slice(0, compact ? 1 : 2)" :key="badge" :tone="badgeTone(badge)">{{ badge }}</Badge>
      </span>
      <span v-if="item.type === 'match' && item.meta" class="rounded-md bg-surface-2 px-2 py-0.5 font-figures text-sm font-bold tabular-nums text-slate-900">{{ item.meta }}</span>
      <Icon icon="chevron-right" class="h-3 w-3 text-slate-400 transition group-hover:translate-x-0.5" :class="active ? 'text-brand-500' : ''" />
    </div>
  </RouterLink>
</template>
