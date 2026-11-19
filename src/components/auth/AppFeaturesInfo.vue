<script setup lang="ts">
import { ref } from 'vue';
import Modal from '@/components/ui/Modal.vue';

// Todo lo que hace Tercer Tiempo, de lo que se ve sin cuenta a lo de cada tipo de cuenta. Es el escaparate de la app:
// se abre desde «Qué incluye», en «Darme de alta», y cada función nueva tiene aquí su línea.
const open = ref(false);

const sections: { icon: string; title: string; items: string[] }[] = [
  {
    icon: 'globe',
    title: 'Sin cuenta',
    items: [
      'Las 10 ligas, de 1ª RFEF a 3ª AsturFútbol: jornadas, clasificación y actas oficiales.',
      'El previsor: cómo puede acabar cada liga.',
      'Cada equipo con su plantilla y su cuerpo técnico (entrenadores, ayudantes, fisios y delegados).',
      'Los árbitros de cada categoría, como principales o asistentes.',
    ],
  },
  {
    icon: 'magnifying-glass',
    title: 'Con cualquier cuenta',
    items: [
      'El buscador (también con Ctrl+F) y la ficha de cada jugador con sus actas oficiales.',
      'El perfil de cada técnico: sus equipos, su balance y la posición de cada equipo que ha tenido.',
    ],
  },
  {
    icon: 'shield-halved',
    title: 'Clubes',
    items: [
      'Todo lo del cuerpo técnico, en todos tus equipos.',
      'Tus equipos y su cuerpo técnico, temporada a temporada.',
      'La licencia del club.',
      'Los pases de partido: abres el acta interna y el vídeo a quien tú decidas, gratis o con precio.',
    ],
  },
  {
    icon: 'user',
    title: 'Jugadores',
    items: [
      'Tus cifras, con los partidos que llevas frente a los de tu equipo.',
      'Tus entrenamientos y tu asistencia.',
      'Tus convocatorias, con el campo en el mapa; si estás sancionado o apercibido (4 amarillas), te lo dicen.',
      'Tus avisos y tu perfil.',
    ],
  },
  {
    icon: 'user-group',
    title: 'Cuerpo técnico',
    items: [
      'Actas internas con minutos, goles, tarjetas y una nota justa: cada uno carga solo los goles encajados con él en el campo.',
      'Vídeo con su análisis en directo (y pausa): reconoce a cada jugador por su dorsal y saca faltas y fueras de juego; los minutos, del acta oficial.',
      'Estadísticas y comparador, con el dato de cada puesto (paradas, despejes, pases, tiros), el partido a partido y tablas ordenables.',
      'La plantilla con fichas, fotos y jugadores a prueba que pasan a ficha; todas las listas de jugadores, agrupables por posición.',
      'Lesionados que no entrenan ni van convocados (y por qué) y el historial de lesiones con sus radiografías e informes.',
      'Entrenamientos en un calendario por mes, semana, día o lista, con ejercicios por líneas (porteros, defensas, centrocampistas o delanteros) y la duración sumada sola.',
      'Partidos jugados en el calendario en verde, amarillo o rojo según el resultado, con el marcador.',
      'Asistencia resumida, ampliada, por semana o por día, agrupada por posición, con un filtro de quién faltó (avisando o sin avisar), el motivo de cada falta y un buscador que lista las coincidencias y abre la ficha de cada jugador.',
      'Convocatorias por posición, con repaso, el visto de cada jugador y la cita en el campo con su mapa; el acta interna sale ya con los convocados.',
      'Sanciones de liga: la 5.ª amarilla y cada expulsión dejan al jugador sin el siguiente partido, sin poder convocarle ni ponerle en el acta; la agenda dice quién no está disponible.',
      'Previas con solo lo jugado antes del partido y los precedentes de otras temporadas.',
      'Tu nota a quien pita, definitiva tras confirmarla dos veces.',
    ],
  },
];
</script>

<template>
  <button
    type="button"
    class="group inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-brand-400/60 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    title="Qué puedes hacer en Tercer Tiempo, sin cuenta y con cada tipo de cuenta"
    aria-haspopup="dialog"
    @click="open = true"
  >
    <Icon icon="circle-info" class="h-3.5 w-3.5 text-brand-500" />Qué incluye
  </button>

  <Modal :open="open" title="Qué puedes hacer en Tercer Tiempo" size="xl" @close="open = false">
    <template #header>
      <div class="flex min-w-0 items-center gap-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-500"><Icon icon="circle-info" class="h-4 w-4" /></span>
        <div class="min-w-0">
          <h2 class="text-lg font-bold leading-tight text-slate-900">Qué puedes hacer en Tercer Tiempo</h2>
          <p class="text-xs text-slate-500">Lo que ves sin cuenta y lo que suma cada una: club, cuerpo técnico o jugador.</p>
        </div>
      </div>
    </template>

    <!-- En dos columnas desde tablet, cada bloque entero: lo general, clubes y jugadores a un lado; el cuerpo técnico, que
         es lo más largo, al otro. -->
    <div class="gap-8 sm:columns-2">
      <section v-for="s in sections" :key="s.title" class="mb-5 break-inside-avoid">
        <h3 class="mb-2 flex items-center gap-2 font-display text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          <span class="grid h-6 w-6 place-items-center rounded-md bg-surface-2 text-slate-600"><Icon :icon="s.icon" class="h-3 w-3" /></span>
          {{ s.title }}
        </h3>
        <ul class="space-y-1.5">
          <li v-for="item in s.items" :key="item" class="flex gap-2.5 text-sm text-slate-700">
            <Icon icon="check" class="mt-1 h-3 w-3 shrink-0 text-brand-500" />
            <span>{{ item }}</span>
          </li>
        </ul>
      </section>
    </div>

    <template #footer>
      <div class="flex justify-end">
        <button type="button" class="btn-primary" @click="open = false">Entendido</button>
      </div>
    </template>
  </Modal>
</template>
