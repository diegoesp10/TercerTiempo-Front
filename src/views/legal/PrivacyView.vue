<script setup lang="ts">
import LegalPage from '@/components/legal/LegalPage.vue';
import MailLink from '@/components/legal/MailLink.vue';
import { dataSources, legalEntity } from '@/legal/entity';
</script>

<template>
  <LegalPage title="Política de privacidad" subtitle="Cómo trata Tercer Tiempo los datos personales, conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).">
    <section>
      <h2>1. Responsable del tratamiento</h2>
      <p>
        <strong>{{ legalEntity.name }}</strong>, NIF {{ legalEntity.nif }}, con domicilio en {{ legalEntity.address }}
        (en adelante, «Tercer Tiempo»). Contacto para cualquier cuestión sobre datos personales:
        <MailLink :email="legalEntity.email" />.
      </p>
    </section>

    <section>
      <h2>2. Qué es Tercer Tiempo y a quién se refieren los datos</h2>
      <p>
        Tercer Tiempo es una plataforma para equipos de categoría absoluta (amateur, regional y nacional) en la que los
        <strong>clubes</strong> dan de alta a sus equipos y a su cuerpo técnico, el <strong>cuerpo técnico</strong> lleva la
        plantilla (actas internas de cada partido, vídeos, lesiones, entrenamientos, asistencia y convocatorias), la plataforma
        compara el acta interna con la oficial de la federación y calcula estadísticas, y cada <strong>jugador</strong> consulta
        sus números, sus entrenamientos y sus convocatorias. Tratamos datos de las personas que crean una cuenta y también de
        personas que no la tienen: jugadores que figuran en las plantillas y en las actas, jugadores a prueba, técnicos
        nombrados por su club, y árbitros y miembros del cuerpo técnico que aparecen en las actas oficiales.
      </p>
    </section>

    <section>
      <h2>3. Datos que tratamos, de dónde salen y para qué</h2>
      <table>
        <thead>
          <tr><th>Datos</th><th>Origen</th><th>Finalidad</th><th>Base jurídica</th></tr>
        </thead>
        <tbody>
          <tr>
            <td data-label="Datos"><strong>Cuenta</strong>: correo electrónico, contraseña (guardada con un resumen irreversible), nombre y apellidos o nombre del club, tipo de cuenta; en jugadores, posición y, si se indica, fecha de nacimiento; los avisos que recibe en la plataforma.</td>
            <td data-label="Origen">El propio usuario al darse de alta; los avisos los genera la plataforma.</td>
            <td data-label="Finalidad">Crear y gestionar la cuenta, identificar al usuario, comprobar que es mayor de edad, mostrarle sus plantillas, estadísticas y avisos.</td>
            <td data-label="Base jurídica">Ejecución del contrato (art. 6.1.b RGPD).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Nombramientos</strong>: nombre del técnico, correo opcional, función, equipo, temporada y fechas de validez; código de acceso; historial de equipos del técnico.</td>
            <td data-label="Origen">El club que nombra al técnico.</td>
            <td data-label="Finalidad">Que solo el cuerpo técnico autorizado por el club gestione la plantilla de su equipo durante la temporada, y mostrar en el perfil del técnico los equipos que ha entrenado.</td>
            <td data-label="Base jurídica">Ejecución del contrato con el club e interés legítimo del técnico y del club (art. 6.1.b y f).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Fichas y actas internas</strong>: nombre, posición y foto de cada jugador (si la suben; el recorte de la figura se hace en el propio navegador); por partido, dorsal (el del acta oficial), minutos, titularidad, goles, asistencias, tiros, pases, entradas, intercepciones, despejes, paradas, faltas, pérdidas, recuperaciones, tarjetas y observaciones del técnico.</td>
            <td data-label="Origen">El club y su cuerpo técnico; las fichas pueden importarse de la plantilla publicada por la fuente pública indicada abajo; el jugador puede sugerir correcciones de su línea.</td>
            <td data-label="Finalidad">Llevar el acta interna del equipo y calcular estadísticas individuales y colectivas.</td>
            <td data-label="Base jurídica">Ejecución del contrato con el club y su cuerpo técnico; respecto de los jugadores, interés legítimo del club en analizar el rendimiento deportivo de su propia plantilla (art. 6.1.f), ponderado con la privacidad por defecto del apartado 7.</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Entrenamientos y convocatorias</strong>: sesiones y ejercicios; asistencia de cada jugador (vino, faltó, avisó) y el motivo de la falta; jugadores a prueba (nombre y notas); convocatorias: quién va, la cita, la firma del jugador y cuándo le llegó y la abrió.</td>
            <td data-label="Origen">El club y su cuerpo técnico; el jugador, al avisar de una falta o firmar; la llegada y la apertura, automáticamente.</td>
            <td data-label="Finalidad">Organizar los entrenamientos y los partidos del equipo y saber con quién se cuenta.</td>
            <td data-label="Base jurídica">Ejecución del contrato con el club y con el jugador que tiene cuenta; interés legítimo del club respecto de quien no la tiene (art. 6.1.b y f).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Lesiones</strong> (datos de salud): tipo de lesión y dónde fue en el cuerpo (el músculo, el hueso, el tendón, el ligamento, la articulación o la zona, con el lado), su grado y cómo se produjo (con contacto, sin contacto o por sobrecarga), fecha del parte y cuándo se registró, días de baja, vuelta prevista (la de entonces y la actual), alta y recaídas, motivo, dónde se lesionó (el partido o el entrenamiento de su equipo, con su día) y documentos médicos (radiografías, informes). Además, las <strong>posibles lesiones</strong> que cuenta la crónica pública de un partido: la frase que lo cuenta, el minuto en que el jugador dejó el campo según el acta oficial y el enlace a la crónica.</td>
            <td data-label="Origen">El club y su cuerpo técnico. Las posibles lesiones, de las crónicas que publica FútbolAsturiano (futbolasturiano.es) después de cada partido, cruzadas con el acta oficial para saber de qué jugador hablan.</td>
            <td data-label="Finalidad">Saber quién está disponible (un lesionado no entrena ni va convocado), cuándo y dónde se lesionó (en qué partido o entrenamiento), seguir su recuperación (también cuando sigue lesionado al cambiar de temporada) y conservar en su ficha el historial de lesiones superadas (los días reales del parte al alta frente a los previstos), para que el club conozca lo que tardan en recuperarse sus jugadores. Las posibles lesiones solo sirven para avisar al club y a su cuerpo técnico de que quizá tengan que registrar una: no cuentan como lesión (ni en las convocatorias ni en las estadísticas) hasta que la registran, y si no fue así, la descartan.</td>
            <td data-label="Base jurídica">Consentimiento explícito del jugador (art. 9.2.a RGPD), que el club o su cuerpo técnico deben recabar antes de anotar la lesión o subir sus documentos. Se puede retirar en cualquier momento (apartado 10). Una posible lesión de la crónica no se registra como lesión sin ese consentimiento: hasta entonces es solo un aviso al club con lo que la crónica ya ha publicado, y se borra a los 60 días (apartado 11).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Sanciones de liga</strong>: las amarillas del ciclo que lleva cada jugador (de qué jornadas son y cuáles no cuentan); si un jugador o alguien del cuerpo técnico llega apercibido (cuatro amarillas en el ciclo) o sancionado al próximo partido y por qué (5.ª amarilla, doble amarilla, roja directa o la sanción del comité de competición, con sus partidos o, al cuerpo técnico, sus días de inhabilitación, y su motivo); las tarjetas de la temporada del cuerpo técnico; el aviso que recibe el jugador, su cuerpo técnico y su club.</td>
            <td data-label="Origen">Se calculan con las tarjetas de las actas (la oficial cerrada y, mientras no llega, la interna) y con las resoluciones que publica el comité de competición en la web de la federación.</td>
            <td data-label="Finalidad">Que el cuerpo técnico no convoque ni alinee a un sancionado, que la plantilla vea quién llega apercibido o sancionado al próximo partido y que el jugador, su cuerpo técnico y su club sepan cuántos partidos le han caído; del cuerpo técnico, mostrar sus tarjetas y si puede estar en el banquillo del próximo partido (apartado 6).</td>
            <td data-label="Base jurídica">Ejecución del contrato con el club e interés legítimo en cumplir las normas de la competición (art. 6.1.b y f).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Datos deportivos de fuentes públicas</strong>: calendarios, resultados, clasificaciones, plantillas publicadas (nombre y posición), actas oficiales (alineaciones con el dorsal de cada partido, minutos, goles, tarjetas, árbitros y cuerpo técnico, también con las tarjetas que le enseña el árbitro), el árbitro designado para cada uno de los próximos partidos (de la página de la jornada de la federación) y sanciones del comité de competición a jugadores y al cuerpo técnico (nombre, equipo, motivo y partidos de suspensión o días de inhabilitación).</td>
            <td data-label="Origen">
              <span v-for="(source, index) in dataSources" :key="source.name">
                <a :href="source.url" target="_blank" rel="noopener">{{ source.name }}</a> ({{ source.what }})<span v-if="index < dataSources.length - 1">; </span>
              </span>
            </td>
            <td data-label="Finalidad">Mostrar la competición, el cuerpo técnico de cada equipo, los árbitros de cada categoría y el equipo arbitral de cada partido (también el designado antes de jugarse), localizar el acta oficial de cada partido y compararla con el acta interna, y saber qué jugadores y técnicos de cada equipo están sancionados.</td>
            <td data-label="Base jurídica">Interés legítimo (art. 6.1.f): son datos deportivos ya publicados por las propias entidades que organizan o informan de la competición, y su reutilización no afecta a la esfera privada de los deportistas más allá de esa publicación.</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Notas a los árbitros</strong>: la nota de 0 a 10 o «no votado», el comentario, el partido y quién la puso (el club o el técnico, con su función).</td>
            <td data-label="Origen">El club y su cuerpo técnico.</td>
            <td data-label="Finalidad">La valoración pública del arbitraje por los equipos que lo han tenido.</td>
            <td data-label="Base jurídica">Interés legítimo (art. 6.1.f) y libertad de expresión, con los comentarios moderados (apartado 6).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Nota calculada</strong> de cada línea del acta.</td>
            <td data-label="Origen">Se calcula a partir de los datos del acta interna y del resultado.</td>
            <td data-label="Finalidad">Resumir el rendimiento en un partido (apartado 5).</td>
            <td data-label="Base jurídica">Interés legítimo (art. 6.1.f).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Vídeos de partidos y su análisis</strong>: imágenes y voces de las personas que aparecen; quién lo subió y cuándo (el archivo se guarda con el nombre del partido, los dos equipos y la fecha, y no con el nombre que tenía); del análisis, la posición de cada jugador en el campo, el color de su camiseta, su dorsal, las acciones propuestas con el segundo del vídeo en que pasó cada una y con qué versión del analizador se hizo.</td>
            <td data-label="Origen">El cuerpo técnico que lo sube; el análisis lo hace la plataforma.</td>
            <td data-label="Finalidad">Alojar el vídeo, mostrarlo a quien tiene acceso (también en el momento de cada acción propuesta) y proponer acciones para el acta interna, que el cuerpo técnico revisa antes de guardarlas.</td>
            <td data-label="Base jurídica">Ejecución del contrato con quien lo sube; respecto de las personas que aparecen, el consentimiento o la base que haya obtenido el club. El análisis no usa reconocimiento facial: identifica a cada jugador por su dorsal y el acta oficial y, cuando no se le ve el número, por su aspecto en la imagen (la equipación y la figura), comparado solo con los momentos de ese mismo partido en los que sí se le leyó. Esa comparación se hace durante el análisis y no se guarda ni se usa para nada más.</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Licencias y pases</strong>: importe, fecha y referencia del pago; cuenta que canjea cada pase. Los datos de la tarjeta los trata exclusivamente la pasarela de pago.</td>
            <td data-label="Origen">El club o el usuario que paga.</td>
            <td data-label="Finalidad">Prestar lo contratado, repartir el importe de los pases con el club, facturar y cumplir obligaciones fiscales.</td>
            <td data-label="Base jurídica">Ejecución del contrato y obligación legal (art. 6.1.b y c).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Analítica propia</strong>: páginas vistas, búsquedas y botones pulsados, con un identificador aleatorio y sin la IP.</td>
            <td data-label="Origen">Tu navegador, solo si lo aceptas.</td>
            <td data-label="Finalidad">Saber qué partes de la web se usan para mejorarla.</td>
            <td data-label="Base jurídica">Consentimiento (art. 6.1.a), que puedes retirar en la política de cookies.</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Datos técnicos</strong>: dirección IP, navegador y páginas solicitadas, en los registros del servidor.</td>
            <td data-label="Origen">Automático al usar el servicio.</td>
            <td data-label="Finalidad">Seguridad, detección de abusos y resolución de incidencias.</td>
            <td data-label="Base jurídica">Interés legítimo (art. 6.1.f).</td>
          </tr>
        </tbody>
      </table>
      <p>
        La única categoría especial de datos que se trata son los de salud de las lesiones, con las garantías de este apartado y
        del 7. Las observaciones del acta, los motivos de las faltas y las notas de los jugadores a prueba deben limitarse al
        juego: no deben incluir datos de salud (para eso está la lesión) ni valoraciones ajenas al rendimiento deportivo.
      </p>
    </section>

    <section>
      <h2>4. Datos que no nos ha facilitado el interesado</h2>
      <p>
        Cuando tratamos datos de una persona que no los ha introducido ella misma (jugadores de una plantilla, jugadores a
        prueba, técnicos nombrados, personas que figuran en las actas oficiales o de las que una crónica cuenta que se
        lesionaron), la información que exige el artículo 14 del
        RGPD se proporciona mediante esta política. Dado el número de personas y que no disponemos de sus datos de contacto,
        informar individualmente supondría un esfuerzo desproporcionado; los clubes y el cuerpo técnico se comprometen a
        informar a sus jugadores de que usan Tercer Tiempo. Cualquier persona puede ejercer en todo momento los derechos del
        apartado 10, en particular el de <strong>oposición</strong>, sin necesidad de tener cuenta.
      </p>
    </section>

    <section>
      <h2>5. La nota calculada</h2>
      <p>
        La nota de cada jugador en un partido no la pone ninguna persona: se calcula con una fórmula fija a partir de los
        datos del acta (minutos, goles, asistencias, tiros, pases, acciones defensivas, paradas, tarjetas y los goles
        encajados con él en el campo), de la posición del jugador y del resultado, en una escala de 3,0 a 10,0. Es una
        síntesis orientativa, no produce efectos jurídicos ni decisiones automatizadas en el sentido del artículo 22 del RGPD,
        y la fórmula se explica en la propia pantalla del acta. El jugador puede oponerse a su cálculo (apartado 10).
      </p>
    </section>

    <section>
      <h2>6. Sanciones y notas a los árbitros</h2>
      <ul>
        <li>Las <strong>sanciones de liga</strong> aplican la regla de la competición (la 5.ª amarilla, la 10.ª… y cada expulsión cuestan el siguiente partido de liga) a las tarjetas de las actas. Las de los jugadores (también quién llega apercibido) las ve la plantilla (su club, su cuerpo técnico y sus jugadores vinculados) y no se publican fuera de ella. Las del cuerpo técnico (sus tarjetas de la temporada y si llega apercibido o sancionado al próximo partido) se calculan solo con las actas oficiales cerradas y las resoluciones del comité, que ya son públicas, y salen en la ficha pública del equipo y en el perfil del técnico. No sustituyen a las resoluciones del comité de competición, que prevalecen.</li>
        <li>Las <strong>notas a los árbitros</strong> son públicas en la ficha de cada árbitro, con el nombre del club o del técnico que las puso. Los comentarios se filtran con una lista de palabras prohibidas y la administración retira los que no respetan las normas de uso. El árbitro puede oponerse a un comentario concreto (apartado 10).</li>
      </ul>
    </section>

    <section>
      <h2>7. Quién ve qué: privacidad por defecto</h2>
      <ul>
        <li>Cada plantilla es <strong>privada</strong>: sus actas internas, notas, estadísticas, vídeos, entrenamientos, asistencia, convocatorias y lesiones solo los ven su club, su cuerpo técnico vigente y los jugadores vinculados a ella, cada uno en lo que le corresponde.</li>
        <li>Las <strong>posibles lesiones</strong> de las crónicas solo las ven el club y el cuerpo técnico de la plantilla del jugador (el administrador de la plataforma, sin poder tocarlas); ni el jugador ni sus compañeros las ven mientras nadie las registra. Registrada (o enlazada con la lesión que el jugador ya tenía abierta), es una lesión más.</li>
        <li>Una lesión que dice <strong>dónde fue</strong> sale como registrada en los sucesos del acta de ese partido o, si fue en un entrenamiento, en esa sesión («Se lesionó aquí»), solo para quien puede ver esa lesión: el club, su cuerpo técnico y el propio jugador.</li>
        <li>Los <strong>datos de salud</strong> (el detalle de la lesión y sus documentos médicos) solo los ven el club, su cuerpo técnico y el propio jugador; sus compañeros solo ven que está lesionado. Los documentos médicos se guardan fuera de cualquier carpeta pública y solo se entregan, sin copias en caché, a quien puede abrirlos.</li>
        <li>El <strong>historial de lesiones</strong> de cada jugador reúne las de todas sus temporadas en el club (por su cuenta o, si no la tenía, por su nombre en el mismo equipo, solo cuando no hay duda de que es él) y nunca sale del club: lo ven el club, el cuerpo técnico de su plantilla actual y él mismo; los documentos médicos de otras temporadas, solo el club y el propio jugador. Si una lesión sigue abierta al empezar la temporada siguiente, pasa a su plantilla de esa temporada con la misma fecha del parte (con el mismo criterio para saber que es él), para que no salga disponible; sus documentos médicos se quedan donde se subieron y en la temporada anterior queda como historial.</li>
        <li>El club o su cuerpo técnico pueden dar a una persona concreta un <strong>pase de un partido</strong> (un código de un solo uso, gratuito o de pago) que le deja ver dentro de la plataforma el acta interna o el vídeo de ese partido. El pase queda ligado a la cuenta que lo canjea; el club ve el nombre de esa cuenta, nunca su correo.</li>
        <li>Si la plantilla se abre a solicitudes, cualquier usuario puede pedir ese pase al club, que decide si lo concede. Abrirla no hace visible nada por sí mismo. El club y su cuerpo técnico son responsables de a quién dan acceso y de informar a sus jugadores.</li>
        <li>Son públicos, como lo son en sus fuentes, los calendarios, resultados, clasificaciones y actas oficiales; también el perfil de cada técnico con su cuenta (sus equipos y su balance, sacados de las actas oficiales) y las notas a los árbitros.</li>
        <li>Las estadísticas comparativas «frente a la liga» de un jugador usan, solo de forma agregada (percentiles), las actas de su plantilla y las de las plantillas abiertas a solicitudes; nunca muestran los datos de otro jugador.</li>
        <li>El personal de administración de Tercer Tiempo puede consultar los datos en modo de solo lectura para dar soporte, garantizar la seguridad y atender requerimientos legales, con verificación en dos pasos y deber de confidencialidad. No puede abrir los documentos médicos.</li>
        <li>Un jugador vinculado puede desvincularse de su ficha en cualquier momento desde su panel.</li>
      </ul>
    </section>

    <section>
      <h2>8. Menores de edad</h2>
      <ul>
        <li>Tercer Tiempo está dirigido a equipos de categoría absoluta y no admite cuentas de menores de edad: al darse de alta, cada usuario confirma que es mayor de edad.</li>
        <li>Si en una plantilla figura excepcionalmente un menor, el club debe contar con la autorización de sus padres o tutores para tratar sus datos en la plataforma y, si aparece en un vídeo, para la grabación y su difusión en ella.</li>
        <li>En las actas oficiales, la federación publica a los menores solo con su nombre de pila; Tercer Tiempo mantiene esa presentación.</li>
      </ul>
    </section>

    <section>
      <h2>9. Destinatarios, encargados y transferencias</h2>
      <p>No vendemos ni cedemos datos personales a terceros. Acceden a ellos, como encargados del tratamiento y con contrato conforme al artículo 28 del RGPD:</p>
      <ul>
        <li><strong>Alojamiento</strong>: {{ legalEntity.hosting }}.</li>
        <li><strong>Pagos</strong>: {{ legalEntity.payments }}, que trata los datos de pago como responsable propio conforme a su política.</li>
      </ul>
      <p>
        El análisis de los vídeos se hace en nuestros propios equipos o en los del proveedor de alojamiento, sin enviar las
        imágenes a otros terceros. Podemos comunicar datos a autoridades públicas cuando una norma lo exija. No realizamos
        transferencias internacionales fuera del Espacio Económico Europeo; si un proveedor lo requiriese, se harían con las
        garantías del capítulo V del RGPD (decisión de adecuación o cláusulas contractuales tipo).
      </p>
    </section>

    <section>
      <h2>10. Tus derechos</h2>
      <p>
        Puedes ejercer los derechos de <strong>acceso, rectificación, supresión, oposición, limitación del tratamiento y
        portabilidad</strong>, y retirar un consentimiento prestado, escribiendo a
        <MailLink :email="legalEntity.email" /> con una copia de un documento que acredite tu
        identidad. Respondemos en el plazo de un mes. También puedes reclamar ante la Agencia Española de Protección de
        Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>).
      </p>
      <p>
        Si te opones al tratamiento de tus datos como jugador, dejaremos de calcular tu nota y de mostrar tus estadísticas a
        terceros, salvo los datos que sigan publicados por las fuentes oficiales de la competición. Si retiras el
        consentimiento para tus datos de salud, se borran el detalle de tus lesiones y sus documentos médicos.
      </p>
    </section>

    <section>
      <h2>11. Conservación</h2>
      <ul>
        <li>Datos de la cuenta: mientras esté activa y, tras su baja, bloqueados durante los plazos de prescripción legales (hasta 5 años) y después eliminados.</li>
        <li>Actas internas, notas, estadísticas, entrenamientos, asistencia y convocatorias: mientras exista la plantilla; el club y el cuerpo técnico pueden corregir o eliminar lo que anotaron. Lo de un jugador que causa baja se conserva como historial de la plantilla (en el grupo «De baja»), sin que se le pueda anotar nada nuevo salvo que se le reincorpore.</li>
        <li>Lesiones y documentos médicos: mientras exista la plantilla de cada temporada (de ahí sale el historial de lesiones de cada jugador), hasta que el club o el cuerpo técnico los borren o hasta que el jugador retire su consentimiento. Borrar una lesión borra sus documentos; si tenía una recaída, esa se queda como una lesión más, y si había pasado a la temporada siguiente, la de allí se queda.</li>
        <li>Posibles lesiones de las crónicas: la frase y el enlace que se leen de la crónica se borran a los 60 días; la posible lesión que nadie registra, también a los 60 días (antes, si la crónica deja de contarlo), y la registrada se queda con su lesión mientras esta exista (si se borra la lesión, o si la lesión pasa a decir que fue en otro sitio, queda descartada y se borra con las demás).</li>
        <li>Vídeos y su análisis: hasta que los elimine quien los subió o se cierre la plantilla.</li>
        <li>Notas a los árbitros: mientras la temporada esté disponible en la plataforma.</li>
        <li>Datos de compras: los exigidos por la normativa fiscal y contable (en general, 4 a 6 años).</li>
        <li>Datos deportivos de fuentes públicas: mientras se mantengan publicados y la temporada esté disponible en la plataforma.</li>
        <li>Analítica propia: 13 meses. Registros técnicos del servidor: 12 meses.</li>
      </ul>
    </section>

    <section>
      <h2>12. Seguridad</h2>
      <p>
        Las contraseñas se guardan con funciones de resumen irreversibles y se exige una contraseña robusta; la comunicación
        va cifrada (HTTPS); el acceso a los datos de cada plantilla está limitado por su visibilidad y por los nombramientos
        vigentes del club; los vídeos se sirven con tickets de corta duración; los documentos médicos no se sirven nunca en
        abierto, y el acceso de administración exige verificación en dos pasos. Mantenemos copias de seguridad y registros de
        acceso. Si se produjera una brecha de seguridad con riesgo para los interesados, la notificaríamos a la autoridad de
        control y, cuando proceda, a los afectados en los plazos legales.
      </p>
    </section>

    <section>
      <h2>13. Cookies y almacenamiento local</h2>
      <p>
        Tercer Tiempo no utiliza cookies de publicidad ni de terceros. Guarda en el almacenamiento de tu navegador lo necesario
        para funcionar (tu sesión, que haya una sola por navegador, tu elección sobre las cookies y la subida de un vídeo que
        se ha cortado) y las preferencias que tú eliges (tema, temporada, vistas del calendario y de la asistencia, listas
        agrupadas por posición y búsquedas recientes), que están exentas de consentimiento. Con tu permiso, y solo entonces,
        mide de forma anónima qué páginas, búsquedas y botones se usan (analítica propia): esos datos se guardan en nuestros
        servidores con un identificador aleatorio, sin tu IP, no se comparten con nadie y se borran a los 13 meses. Guardamos
        también tu elección (qué aceptaste y cuándo) para poder demostrarla. Qué guarda cada dato, cuánto dura y cómo cambiar
        tu elección está en la <RouterLink to="/cookies" class="text-accent-400 hover:underline">política de cookies</RouterLink>.
      </p>
    </section>

    <section>
      <h2>14. Fuentes de terceros</h2>
      <p>
        Los datos deportivos se obtienen de las fuentes citadas en el apartado 3, a las que se atribuyen y enlazan en la
        propia plataforma. Tercer Tiempo cuenta con los servicios de FútbolAsturiano, diario independiente digital del fútbol
        asturiano (futbolasturiano.es), que autoriza el uso de sus calendarios, resultados, clasificaciones, plantillas
        publicadas y escudos de los equipos. De sus crónicas de los partidos solo se lee si cuentan que un jugador se
        lesionó, para avisar a su club (apartado 3): se guarda la frase que lo cuenta, con el enlace a la crónica, nunca la
        crónica entera. De esa frase se propone el tipo de lesión y dónde fue en el cuerpo, sin guardarlo aparte: lo confirma
        o lo corrige quien la registra. Tercer Tiempo no es un servicio oficial de la Real Federación de Fútbol del
        Principado de Asturias y no garantiza la exactitud de los datos que estas fuentes publican. Si detectas un error, el
        acta oficial enlazada prevalece.
      </p>
    </section>

    <section>
      <h2>15. Cambios en esta política</h2>
      <p>
        Publicaremos aquí cualquier cambio y, si es relevante, lo comunicaremos a los usuarios registrados. La fecha de la
        última versión figura al pie.
      </p>
    </section>
  </LegalPage>
</template>
