<script setup lang="ts">
import { computed } from 'vue';

// Correo enlazado que, si no cabe en la línea, se parte por la arroba y no a media palabra.
const props = defineProps<{ email: string }>();
const at = computed(() => props.email.indexOf('@') + 1);
</script>

<template>
  <a :href="`mailto:${email}`" class="[overflow-wrap:anywhere]">{{ email.slice(0, at) }}<wbr />{{ email.slice(at) }}</a>
</template>
