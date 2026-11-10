<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ErrorPage from '@/components/ui/ErrorPage.vue';

/** La API no responde (sin conexión) o ha fallado (5xx). `?status=` distingue el caso; `?from=` permite reintentar. */
const route = useRoute();
const status = computed(() => (typeof route.query.status === 'string' ? route.query.status : '503'));
const offline = computed(() => status.value === '0' || status.value === '503');
</script>

<template>
  <ErrorPage
    :code="offline ? '503' : status"
    :title="offline ? 'La API no responde' : 'Algo ha fallado en el servidor'"
    :message="offline ? 'No hemos podido contactar con el servidor de Tercer Tiempo. Puede estar arrancando o en mantenimiento; inténtalo de nuevo en un momento.' : 'El servidor ha devuelto un error inesperado. Ya queda registrado; vuelve a intentarlo en unos instantes.'"
    retry
  />
</template>
