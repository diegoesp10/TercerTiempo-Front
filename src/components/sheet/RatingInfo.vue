<script setup lang="ts">
import { ref } from 'vue';
import Modal from '@/components/ui/Modal.vue';

// De dónde sale la nota del acta interna, contado para quien la lee. Las cifras son las de la cuenta del dominio
// (PerformanceRating): si allí cambia un peso, aquí también.
const open = ref(false);

interface Item {
  label: string;
  value: string;
  detail?: string;
}

const blocks: { title: string; icon: string; tone: string; items: Item[] }[] = [
  {
    title: 'Lo que suma',
    icon: 'plus',
    tone: 'text-emerald-600',
    items: [
      { label: 'Gol', value: '+0,9 a +1,5', detail: 'Más cuanto más atrás juega: delantero +0,9, centrocampista +1, defensa +1,2 y portero +1,5.' },
      { label: 'Asistencia de gol', value: '+0,7 a +0,8', detail: 'Y los pases clave, si llegan con la sugerencia aprobada de un jugador: de +0,15 a +0,25.' },
      { label: 'Tiro a puerta', value: '+0,1 a +0,15', detail: 'Lo que más, al delantero.' },
      { label: 'Entrada o intercepción', value: '+0,08 a +0,15', detail: 'Lo que más, al defensa.' },
      { label: 'Recuperación o despeje', value: '+0,03 a +0,08', detail: 'Lo que más, al defensa.' },
      { label: 'Parada', value: '+0,3 a +0,35', detail: 'Lo que más, al portero.' },
      {
        label: 'Portería a cero',
        value: 'hasta +1',
        detail: 'Ningún gol encajado con él en el campo y 60 minutos o más: portero +1, defensa +0,6 y centrocampista +0,2; al delantero, nada.',
      },
      { label: 'Buen acierto en el pase', value: 'hasta +0,3', detail: 'Con 10 pases o más, si acierta más de 3 de cada 4.' },
      { label: 'Ganar o empatar', value: '+0,4 o +0,1', detail: 'Por los 90 minutos; con menos, la parte que jugó.' },
    ],
  },
  {
    title: 'Lo que resta',
    icon: 'minus',
    tone: 'text-red-600',
    items: [
      { label: 'Pérdida de balón', value: '−0,05' },
      { label: 'Gol encajado con él en el campo', value: 'hasta −0,3', detail: 'Portero −0,3, defensa −0,2 y centrocampista −0,05; al delantero, nada.' },
      { label: 'Mal acierto en el pase', value: 'hasta −0,3', detail: 'Con 10 pases o más, si acierta menos de 3 de cada 4.' },
      { label: 'Perder', value: '−0,3', detail: 'Por los 90 minutos; con menos, la parte que jugó.' },
      { label: 'Tarjeta amarilla', value: '−0,3', detail: 'Cada una.' },
      { label: 'Tarjeta roja', value: '−1,5', detail: 'Y sus amarillas ya no restan aparte.' },
    ],
  },
];
</script>

<template>
  <button
    type="button"
    class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-brand-400/60 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    title="Cómo se calcula la nota de cada jugador"
    aria-haspopup="dialog"
    @click="open = true"
  >
    <Icon icon="circle-info" class="h-3.5 w-3.5 text-brand-500" />¿De dónde sale la nota?
  </button>

  <Modal :open="open" title="¿De dónde sale la nota?" size="lg" @close="open = false">
    <template #header>
      <div class="flex min-w-0 items-center gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="star" class="h-4 w-4" /></span>
        <div class="min-w-0">
          <h2 class="text-lg font-bold leading-tight text-slate-900">¿De dónde sale la nota?</h2>
          <p class="text-xs text-slate-500">La calcula la aplicación con lo apuntado en el acta, igual para todos: nadie la pone a mano.</p>
        </div>
      </div>
    </template>

    <p class="text-sm text-slate-700">
      Cada jugador que ha jugado <strong class="text-slate-900">empieza con un 6</strong>, lo de un partido normal. Lo que hizo la
      sube o la baja, y queda siempre <strong class="text-slate-900">entre 3 y 10</strong>, con un decimal. Quien no jugó ningún
      minuto no tiene nota.
    </p>

    <div class="mt-5 grid gap-6 sm:grid-cols-2">
      <section v-for="block in blocks" :key="block.title">
        <h3 class="mb-1 flex items-center gap-2 font-display text-2xs font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span class="grid h-6 w-6 place-items-center rounded-md bg-surface-2" :class="block.tone"><Icon :icon="block.icon" class="h-3 w-3" /></span>
          {{ block.title }}
        </h3>
        <ul class="divide-y divide-line">
          <li v-for="item in block.items" :key="item.label" class="py-2">
            <div class="flex items-baseline justify-between gap-3">
              <span class="min-w-0 text-sm font-medium text-slate-800">{{ item.label }}</span>
              <span class="shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums" :class="block.tone">{{ item.value }}</span>
            </div>
            <p v-if="item.detail" class="mt-0.5 text-xs text-slate-500">{{ item.detail }}</p>
          </li>
        </ul>
      </section>
    </div>

    <div class="mt-6 space-y-4 text-sm text-slate-700">
      <section>
        <h3 class="mb-1 font-semibold text-slate-900"><Icon icon="people-group" class="mr-1.5 h-3.5 w-3.5 text-brand-500" />Cada puesto pesa lo suyo</h3>
        <p>
          No todo vale igual en cada posición: el gol de un defensa suma más que el de un delantero, porque es más raro; al portero
          y a los defensas les pesan la portería a cero y los goles encajados, y al delantero le cuentan más los tiros a puerta. Se
          usa la posición de su ficha en la plantilla; quien no tiene posición puntúa como centrocampista.
        </p>
      </section>
      <section>
        <h3 class="mb-1 font-semibold text-slate-900"><Icon icon="eye-slash" class="mr-1.5 h-3.5 w-3.5 text-brand-500" />Lo que no cuenta</h3>
        <ul class="list-disc space-y-1 pl-5">
          <li>Los tiros fuera y las faltas se apuntan, pero no cambian la nota.</li>
          <li>
            Los goles que entran cuando él no está en el campo: se miran en el acta oficial cerrada. Mientras no la hay, se le
            cuenta la parte de los goles del partido que corresponde a los minutos que jugó.
          </li>
          <li>
            Lo que puso el vídeo (lo marca la cámara junto a la nota): sus tiros, pases, paradas, recuperaciones y pérdidas no
            cuentan hasta que el cuerpo técnico los revisa y guarda el acta, porque el vídeo solo ve a cada uno el rato que lo
            reconoce.
          </li>
        </ul>
      </section>
      <section>
        <h3 class="mb-1 font-semibold text-slate-900"><Icon icon="clock-rotate-left" class="mr-1.5 h-3.5 w-3.5 text-brand-500" />Cuándo se calcula</h3>
        <p>
          Al guardar el acta (y al aprobar la sugerencia de un jugador). Se vuelve a calcular sola cuando llega el acta oficial
          cerrada, con los goles encajados con cada uno en el campo, y si se le cambia la posición en la plantilla. Mientras
          editas, la nota de la tabla es la de la última vez que se guardó.
        </p>
      </section>
    </div>

    <div class="mt-6 rounded-xl bg-surface-2 px-4 py-3 text-sm text-slate-700">
      <p class="font-semibold text-slate-900"><Icon icon="futbol" class="mr-1.5 h-3.5 w-3.5 text-brand-500" />Un ejemplo</p>
      <p class="mt-1">
        Un defensa juega los 90 minutos de un 1-0 con 3 entradas y 2 despejes: 6 + 0,45 (entradas) + 0,16 (despejes) + 0,6
        (portería a cero) + 0,4 (victoria) = <strong class="text-slate-900">7,6</strong>.
      </p>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <button type="button" class="btn-primary" @click="open = false">Entendido</button>
      </div>
    </template>
  </Modal>
</template>
