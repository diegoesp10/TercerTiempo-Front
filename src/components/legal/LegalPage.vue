<script setup lang="ts">
import PageHeader from '@/components/ui/PageHeader.vue';
import { legalVersion } from '@/legal/entity';

defineProps<{ title: string; subtitle: string }>();
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <PageHeader :title="title" :subtitle="subtitle" />
    <article class="legal card space-y-6 text-sm leading-relaxed text-slate-700">
      <slot />
      <p class="border-t border-line pt-4 text-xs text-slate-500">Última actualización: {{ legalVersion }}.</p>
    </article>
  </div>
</template>

<style scoped>
/* Tipografía de los textos legales: títulos de sección, listas y énfasis sin depender de un plugin de prosa. */
.legal :deep(h2) {
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--t-slate-900);
  margin-top: 0.5rem;
}
.legal :deep(h3) {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--t-slate-900);
}
.legal :deep(p + p),
.legal :deep(ul + p),
.legal :deep(p + ul) {
  margin-top: 0.75rem;
}
.legal :deep(ul) {
  list-style: disc;
  padding-left: 1.25rem;
  margin-top: 0.5rem;
}
.legal :deep(li + li) {
  margin-top: 0.35rem;
}
.legal :deep(strong) {
  color: var(--t-slate-900);
}
.legal :deep(a) {
  color: var(--t-brand-500);
  text-decoration: underline;
}
.legal :deep(table) {
  width: 100%;
  margin-top: 0.75rem;
  border-collapse: collapse;
}
.legal :deep(th),
.legal :deep(td) {
  border: 1px solid var(--t-line);
  padding: 0.4rem 0.6rem;
  text-align: left;
  vertical-align: top;
}
.legal :deep(th) {
  background: var(--t-surface-2);
  color: var(--t-slate-900);
  font-weight: 600;
}

/* En pantallas estrechas cada fila de la tabla se apila como una tarjeta, con la cabecera de cada celda delante. */
@media (max-width: 640px) {
  .legal :deep(table),
  .legal :deep(tbody),
  .legal :deep(tr),
  .legal :deep(td) {
    display: block;
    width: 100%;
  }
  .legal :deep(thead) {
    display: none;
  }
  .legal :deep(tr) {
    border: 1px solid var(--t-line);
    border-radius: 0.5rem;
    padding: 0.5rem 0.75rem;
  }
  .legal :deep(tr + tr) {
    margin-top: 0.75rem;
  }
  .legal :deep(td) {
    border: 0;
    padding: 0.3rem 0;
  }
  .legal :deep(td)::before {
    content: attr(data-label);
    display: block;
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--t-slate-500);
  }
}
</style>
