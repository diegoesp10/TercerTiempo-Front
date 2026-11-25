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
      'Las 10 ligas, de 1ª RFEF a 3ª AsturFútbol: jornadas, clasificación y actas oficiales, con los titulares y los suplentes bien separados.',
      'El previsor: cómo puede acabar cada liga.',
      'Equipos y árbitros por ámbito (Nacional, Asturias y las comunidades que vayan llegando) y por liga o categoría, con buscador.',
      'Cada equipo con su plantilla y su cuerpo técnico (entrenadores, ayudantes, fisios y delegados), con sus tarjetas y quién llega apercibido o sancionado al próximo partido.',
      'Los árbitros de cada categoría, como principales o asistentes.',
      'En cada acta, el equipo arbitral que pitó el partido; en los próximos partidos, el árbitro que ha designado la federación en cuanto lo publica.',
    ],
  },
  {
    icon: 'magnifying-glass',
    title: 'Con cualquier cuenta',
    items: [
      'El buscador (también con Ctrl+F) y la ficha de cada jugador con sus actas oficiales.',
      'El perfil de cada técnico: sus equipos, su balance, la posición de cada equipo que ha tenido y sus tarjetas de la temporada.',
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
      'Tus cifras y los dorsales que has llevado, con los partidos que llevas frente a los de tu equipo.',
      'Tus estadísticas y tu comparador, contigo delante: en qué puesto quedas en la plantilla y frente a quien elijas.',
      'Tu resumen en cualquier puesto: en la cabecera eliges portero, defensa, centrocampista o delantero y ves tus cifras con el dato de ese puesto.',
      'Tus entrenamientos y tu asistencia.',
      'Tus lesiones: los días de baja que llevas desde el parte (aunque venga de la temporada anterior), qué te pasó y en qué parte del cuerpo (con el lado y el grado), dónde te lesionaste (el partido o el entrenamiento) y tu historial de lesiones superadas.',
      'Tus convocatorias, con el campo en el mapa y quién ha firmado al momento; si estás sancionado o apercibido (4 amarillas), te lo dicen, también en tu panel.',
      'Un aviso en cuanto el comité de competición te pone partidos de suspensión, con los que te pierdes.',
      'Tus avisos y tu perfil, aparte de tus números: tu foto, quién ve tus actas, tus ajustes y desvincularte de la plantilla.',
      'Tu foto de ficha como en los profesionales: el fondo se quita solo y tú la colocas con el ratón o el dedo, la giras, eliges con quién sales y retocas el recorte con un pincel o un lazo, todo en tu dispositivo (el cuerpo técnico tiene el mismo editor para la suya).',
    ],
  },
  {
    icon: 'user-group',
    title: 'Cuerpo técnico',
    items: [
      'Actas internas con minutos, goles, tarjetas y una nota justa: cada uno carga solo los goles encajados con él en el campo.',
      'Vídeo con su análisis en directo (y pausa): reconoce a cada jugador por su dorsal (al portero, solo si todo cuadra: junto a la portería que defiende en cada parte, con su equipación de portero y un dorsal del acta) y saca faltas y fueras de juego; los minutos, del acta oficial.',
      'Cada vídeo, con el nombre del partido (los dos equipos y la fecha) en cuanto se sube; lo que ocupa solo lo ve quien lo subió.',
      'Cada análisis dice con qué versión del analizador (Ojeador) se hizo, también en los datos del equipo que se vuelcan de él.',
      'Cada acción del análisis, a un clic de verla en el vídeo: los pases, las recuperaciones, las pérdidas, los tiros, los goles, las faltas, los córners y los saques de cada jugador y de los dos equipos, en el segundo en que pasaron, de una en una o seguidas.',
      'Estadísticas y comparador, con el dato de cada puesto (paradas, despejes, pases, tiros) y el resumen de cada jugador como si jugase en otro, el partido a partido y tablas ordenables.',
      'La plantilla con fichas, fotos y jugadores a prueba que pasan a ficha desde «Añadir jugador», con lo que se les anotó a prueba; todas las listas de jugadores, agrupables por posición.',
      'Los jugadores que causan baja pasan al grupo «De baja» con su historial, sin contar para nada más, y se pueden reincorporar.',
      'Lesionados con un contador real de días de baja desde el parte y lo que falta para la vuelta prevista; no entrenan ni van convocados (y se dice por qué) y salen marcados en la tabla de la temporada (sus compañeros solo ven que está lesionado).',
      'En cada ficha, las lesiones superadas, también de otras temporadas del club: del parte al alta, los días reales frente a los previstos, las recaídas y sus radiografías e informes.',
      'Al empezar la temporada, quien sigue lesionado llega a la plantilla nueva con su lesión: no sale disponible y el contador sigue desde el parte.',
      'Posibles lesiones de las crónicas: si la de un partido cuenta que uno de los tuyos se lesionó, te avisa y la registras con un clic (ya rellena), la enlazas con la lesión que ya tiene abierta o la descartas; la registrada sale en los sucesos del acta marcada como «Registrada».',
      'Cada lesión dice dónde fue, el partido o el entrenamiento, con su día: el acta de ese partido la enseña como registrada y la sesión, «Se lesionó aquí» (ese día cuenta como que vino); desde la propia sesión apuntas quién se lesionó.',
      'Lesiones con el detalle de un parte médico: cada tipo pregunta lo suyo (qué músculo en una contractura o una rotura fibrilar, qué hueso en una fractura, qué rodilla y qué ligamento en un cruzado, qué tendón en una tendinitis), el lado, el grado (I, II o III) y si fue con contacto, sin contacto o por sobrecarga; si viene de la crónica, ya propone el sitio y el lado.',
      'Entrenamientos en un calendario por mes, semana, día o lista, con ejercicios por líneas (porteros, defensas, centrocampistas o delanteros) y la duración sumada sola.',
      'Partidos jugados en el calendario en verde, amarillo o rojo según el resultado, con el marcador.',
      'Asistencia resumida, ampliada, por semana o por día, agrupada por posición, con un filtro de quién faltó (avisando o sin avisar), el motivo de cada falta y un buscador que lista las coincidencias y abre la ficha de cada jugador.',
      'Convocatorias por posición, en la pestaña «Convocatoria» de cada partido, con repaso, el visto y la firma de cada jugador al momento, sin recargar, y la cita en el campo con su mapa; el acta interna sale ya con los convocados.',
      'El acta interna con el dorsal del acta oficial, que no se cambia a mano, y la línea de cada jugador siempre dentro de la pantalla: si no cabe en una fila, sus casillas se recolocan.',
      'El acta interna se ordena por cualquier columna, también mientras la rellenas (ninguna fila salta al escribir), y «¿De dónde sale la nota?» cuenta con palabras sencillas cómo se calcula la de cada jugador.',
      'Enviada la convocatoria, la lista queda fija (se modifica a propósito) y se filtra al momento: quién la ha visto, quién ha respondido y a quién le falta firmar.',
      'La convocatoria del próximo partido te avisa mientras no la envías (en la lista de partidos, la agenda, el calendario y la página del partido), y la de un partido ya empezado queda cerrada con candado: se ve tal como se envió, sin nada que cambiar ni firmar.',
      'El número de convocados, fijo o el que digas en cada partido: no deja pasarse y avisa si faltan por convocar.',
      'Sanciones de liga: la 5.ª amarilla y cada expulsión dejan al jugador sin el siguiente partido, sin poder convocarle ni ponerle en el acta; la agenda dice quién no está disponible.',
      'Apercibidos y sancionados para el próximo partido, marcados en la tabla de la temporada (junto a quién está lesionado), en cada ficha y en la convocatoria, con un aviso de los apercibidos mientras convocas; en esa tabla, cuántas amarillas cuentan para el ciclo y por qué (las dos de una doble amarilla no cuentan); también el cuerpo técnico, con sus tarjetas de la temporada.',
      'Las sanciones del comité de competición en cuanto se publican: los partidos que caen de verdad y un aviso a ti, al club y al jugador.',
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
