<script setup lang="ts">
import LegalPage from '@/components/legal/LegalPage.vue';
import { dataSources, legalEntity } from '@/legal/entity';
</script>

<template>
  <LegalPage title="Política de privacidad" subtitle="Cómo trata Tercer Tiempo los datos personales, conforme al Reglamento (UE) 2016/679 (RGPD) y la Ley Orgánica 3/2018 (LOPDGDD).">
    <section>
      <h2>1. Responsable del tratamiento</h2>
      <p>
        <strong>{{ legalEntity.name }}</strong>, NIF {{ legalEntity.nif }}, con domicilio en {{ legalEntity.address }}
        (en adelante, «Tercer Tiempo»). Contacto para cualquier cuestión sobre datos personales:
        <a :href="`mailto:${legalEntity.email}`">{{ legalEntity.email }}</a>.
      </p>
    </section>

    <section>
      <h2>2. Qué es Tercer Tiempo y a quién se refieren los datos</h2>
      <p>
        Tercer Tiempo es una plataforma de seguimiento del rendimiento de cada jugador, partido a partido, en la que los <strong>clubes</strong> dan de alta al cuerpo
        técnico de sus equipos, el <strong>cuerpo técnico</strong> registra el acta interna de cada partido jugador a
        jugador, la plataforma la compara con el acta oficial de la federación y calcula estadísticas, y cada
        <strong>jugador</strong> consulta sus propios números. Tratamos datos de las personas que crean una cuenta y también de
        personas que no la tienen: jugadores que figuran en las plantillas y en las actas, técnicos nombrados por su club,
        árbitros y miembros del cuerpo técnico que aparecen en las actas oficiales.
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
            <td data-label="Datos"><strong>Cuenta</strong>: correo electrónico, contraseña (cifrada de forma irreversible), nombre y apellidos o nombre del club, tipo de cuenta; en jugadores, posición y, si se indica, fecha de nacimiento.</td>
            <td data-label="Origen">El propio usuario al darse de alta.</td>
            <td data-label="Finalidad">Crear y gestionar la cuenta, identificar al usuario, mostrarle sus plantillas y estadísticas.</td>
            <td data-label="Base jurídica">Ejecución del contrato (art. 6.1.b RGPD).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Nombramientos</strong>: nombre del técnico, correo opcional, rol, equipo, temporada y fechas de validez; código de acceso.</td>
            <td data-label="Origen">El club que nombra al técnico.</td>
            <td data-label="Finalidad">Que solo el cuerpo técnico autorizado por el club gestione la plantilla de su equipo durante la temporada.</td>
            <td data-label="Base jurídica">Ejecución del contrato con el club e interés legítimo del técnico y del club (art. 6.1.b y f).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Fichas y actas internas</strong>: nombre, dorsal y posición de cada jugador; por partido, minutos, titularidad, goles, asistencias, tiros, pases clave, entradas, intercepciones, paradas, tarjetas y observaciones del técnico.</td>
            <td data-label="Origen">El cuerpo técnico de la plantilla; las fichas pueden importarse de la plantilla publicada por la fuente pública indicada abajo.</td>
            <td data-label="Finalidad">Llevar el acta interna del equipo y calcular estadísticas individuales y colectivas.</td>
            <td data-label="Base jurídica">Ejecución del contrato con el club y su cuerpo técnico; respecto de los jugadores, interés legítimo del club en analizar el rendimiento deportivo de su propia plantilla (art. 6.1.f), ponderado con la privacidad por defecto que se describe en el apartado 6.</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Datos deportivos de fuentes públicas</strong>: calendarios, resultados, clasificaciones, plantillas publicadas (nombre, dorsal, posición) y actas oficiales (alineaciones, minutos, goles, tarjetas, árbitros y cuerpo técnico).</td>
            <td data-label="Origen">
              <span v-for="(source, index) in dataSources" :key="source.name">
                <a :href="source.url" target="_blank" rel="noopener">{{ source.name }}</a> ({{ source.what }})<span v-if="index < dataSources.length - 1">; </span>
              </span>
            </td>
            <td data-label="Finalidad">Mostrar la competición, localizar el acta oficial de cada partido y compararla con el acta interna.</td>
            <td data-label="Base jurídica">Interés legítimo (art. 6.1.f): son datos deportivos ya publicados por las propias entidades que organizan o informan de la competición, y su reutilización no afecta a la esfera privada de los deportistas más allá de esa publicación.</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Nota calculada</strong> de cada línea del acta.</td>
            <td data-label="Origen">Se calcula a partir de los datos del acta interna y del resultado.</td>
            <td data-label="Finalidad">Resumir el rendimiento en un partido (ver apartado 5).</td>
            <td data-label="Base jurídica">Interés legítimo (art. 6.1.f).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Vídeos de partidos</strong>: imágenes y voces de las personas que aparecen; quién lo subió y cuándo.</td>
            <td data-label="Origen">El cuerpo técnico que lo sube.</td>
            <td data-label="Finalidad">Alojar el vídeo y mostrarlo a quien tiene acceso.</td>
            <td data-label="Base jurídica">Ejecución del contrato con quien lo sube; respecto de las personas que aparecen, el consentimiento o la base que haya obtenido el club (ver apartado 7).</td>
          </tr>
          <tr>
            <td data-label="Datos"><strong>Compras de acceso a vídeos</strong>: importe, fecha y referencia del pago. Los datos de la tarjeta los trata exclusivamente la pasarela de pago.</td>
            <td data-label="Origen">El usuario que compra.</td>
            <td data-label="Finalidad">Prestar el acceso comprado, facturar y cumplir obligaciones fiscales.</td>
            <td data-label="Base jurídica">Ejecución del contrato y obligación legal (art. 6.1.b y c).</td>
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
        No tratamos categorías especiales de datos (salud, origen, ideología…). Las observaciones que el cuerpo técnico escribe
        en el acta deben limitarse al juego: no deben incluir datos de salud ni valoraciones ajenas al rendimiento deportivo.
      </p>
    </section>

    <section>
      <h2>4. Datos que no nos ha facilitado el interesado</h2>
      <p>
        Cuando tratamos datos de una persona que no los ha introducido ella misma (jugadores de una plantilla, técnicos
        nombrados, personas que figuran en las actas oficiales), la información que exige el artículo 14 del RGPD se
        proporciona mediante esta política. Dado el número de personas y que no disponemos de sus datos de contacto, informar
        individualmente supondría un esfuerzo desproporcionado; los clubes y el cuerpo técnico se comprometen a informar a sus
        jugadores de que usan Tercer Tiempo. Cualquier persona puede ejercer en todo momento los derechos del apartado 9,
        en particular el de <strong>oposición</strong>, sin necesidad de tener cuenta.
      </p>
    </section>

    <section>
      <h2>5. La nota calculada</h2>
      <p>
        La nota de cada jugador en un partido no la pone ninguna persona: se calcula con una fórmula fija a partir de los
        datos del acta (minutos, goles, asistencias, tiros, pases clave, entradas, intercepciones, paradas y tarjetas), de la
        posición del jugador y del resultado, en una escala de 3,0 a 10,0. Es una síntesis orientativa, no produce efectos
        jurídicos ni decisiones automatizadas en el sentido del artículo 22 del RGPD, y la fórmula se explica en la propia
        pantalla del acta. El jugador puede oponerse a su cálculo (apartado 9).
      </p>
    </section>

    <section>
      <h2>6. Quién ve qué: privacidad por defecto</h2>
      <ul>
        <li>Cada plantilla es <strong>privada</strong> al crearse: sus actas internas, notas y estadísticas solo las ven su cuerpo técnico vigente y los jugadores vinculados a ella.</li>
        <li>El cuerpo técnico puede hacer pública la plantilla; en ese caso sus actas y estadísticas son visibles para cualquier visitante. El club y su cuerpo técnico son responsables de esa decisión y de informar a sus jugadores.</li>
        <li>Los calendarios, resultados, clasificaciones y actas públicas de la federación son públicos, como lo son en sus fuentes.</li>
        <li>Las estadísticas comparativas «frente a la liga» se calculan únicamente con actas visibles para quien las consulta.</li>
        <li>Un jugador vinculado puede desvincularse de su ficha en cualquier momento desde su panel.</li>
      </ul>
    </section>

    <section>
      <h2>7. Menores de edad</h2>
      <ul>
        <li>No se admite la creación de cuentas por menores de 14 años. Entre 14 y 17 años el jugador necesita la autorización de sus padres o tutores, que el club se compromete a recabar.</li>
        <li>En las actas oficiales, la federación publica a los menores solo con su nombre de pila; Tercer Tiempo mantiene esa presentación en el acta oficial.</li>
        <li>Los vídeos en los que aparezcan menores solo pueden subirse si el club cuenta con el consentimiento de sus padres o tutores para la grabación y su difusión en la plataforma, y únicamente para la visualización por su propia plantilla.</li>
      </ul>
    </section>

    <section>
      <h2>8. Destinatarios, encargados y transferencias</h2>
      <p>No vendemos ni cedemos datos personales a terceros. Acceden a ellos, como encargados del tratamiento y con contrato conforme al artículo 28 del RGPD:</p>
      <ul>
        <li><strong>Alojamiento</strong>: {{ legalEntity.hosting }}.</li>
        <li><strong>Pagos</strong>: {{ legalEntity.payments }}, que trata los datos de pago como responsable propio conforme a su política.</li>
      </ul>
      <p>
        Podemos comunicar datos a autoridades públicas cuando una norma lo exija. No realizamos transferencias
        internacionales fuera del Espacio Económico Europeo; si un proveedor lo requiriese, se harían con las garantías del
        capítulo V del RGPD (decisión de adecuación o cláusulas contractuales tipo).
      </p>
    </section>

    <section>
      <h2>9. Tus derechos</h2>
      <p>
        Puedes ejercer los derechos de <strong>acceso, rectificación, supresión, oposición, limitación del tratamiento y
        portabilidad</strong>, y retirar un consentimiento prestado, escribiendo a
        <a :href="`mailto:${legalEntity.email}`">{{ legalEntity.email }}</a> con una copia de un documento que acredite tu
        identidad. Respondemos en el plazo de un mes. También puedes reclamar ante la Agencia Española de Protección de
        Datos (<a href="https://www.aepd.es" target="_blank" rel="noopener">www.aepd.es</a>).
      </p>
      <p>
        Si te opones al tratamiento de tus datos como jugador, dejaremos de calcular tu nota y de mostrar tus estadísticas a
        terceros, salvo los datos que sigan publicados por las fuentes oficiales de la competición.
      </p>
    </section>

    <section>
      <h2>10. Conservación</h2>
      <ul>
        <li>Datos de la cuenta: mientras esté activa y, tras su baja, bloqueados durante los plazos de prescripción legales (hasta 5 años) y después eliminados.</li>
        <li>Actas internas, notas y estadísticas: mientras exista la plantilla; el cuerpo técnico puede dar de baja fichas y corregir o eliminar líneas del acta.</li>
        <li>Vídeos: hasta que los elimine quien los subió o se cierre la plantilla.</li>
        <li>Datos de compras: los exigidos por la normativa fiscal y contable (en general, 4 a 6 años).</li>
        <li>Datos deportivos de fuentes públicas: mientras se mantengan publicados y la temporada esté disponible en la plataforma.</li>
        <li>Registros técnicos del servidor: 12 meses.</li>
      </ul>
    </section>

    <section>
      <h2>11. Seguridad</h2>
      <p>
        Las contraseñas se guardan con funciones de resumen irreversibles; la comunicación va cifrada (HTTPS); el acceso a los
        datos de cada plantilla está limitado por su visibilidad y por los nombramientos vigentes del club; los vídeos se
        sirven con tickets de corta duración. Mantenemos copias de seguridad y registros de acceso. Si se produjera una brecha
        de seguridad con riesgo para los interesados, la notificaríamos a la autoridad de control y, cuando proceda, a los
        afectados en los plazos legales.
      </p>
    </section>

    <section>
      <h2>12. Cookies y almacenamiento local</h2>
      <p>
        Tercer Tiempo no utiliza cookies de publicidad ni de terceros. Guarda en el almacenamiento de tu navegador lo necesario
        para funcionar (tu sesión y tu elección sobre las cookies) y las preferencias que tú eliges (tema, temporada), que
        están exentas de consentimiento. Con tu permiso, y solo entonces, mide de forma anónima qué páginas, búsquedas y
        botones se usan (analítica propia): esos datos se guardan en nuestros servidores con un identificador aleatorio, sin
        tu IP, no se comparten con nadie y se borran a los 13 meses. Guardamos también tu elección (qué aceptaste y cuándo)
        para poder demostrarla. El detalle de cada dato y cómo cambiar tu elección están en la
        <RouterLink to="/cookies" class="text-accent-400 hover:underline">política de cookies</RouterLink>.
      </p>
    </section>

    <section>
      <h2>13. Fuentes de terceros</h2>
      <p>
        Los datos deportivos se obtienen de las fuentes citadas en el apartado 3, a las que se atribuyen y enlazan en la
        propia plataforma. Tercer Tiempo cuenta con los servicios de FútbolAsturiano, diario independiente digital del fútbol
        asturiano (futbolasturiano.es), que autoriza el uso de sus calendarios, resultados, clasificaciones, plantillas
        publicadas y escudos de los equipos. Tercer Tiempo no es un servicio oficial de la Real Federación de Fútbol del
        Principado de Asturias y no garantiza la exactitud de los datos que estas fuentes publican. Si detectas un error, el
        acta oficial enlazada prevalece.
      </p>
    </section>

    <section>
      <h2>14. Cambios en esta política</h2>
      <p>
        Publicaremos aquí cualquier cambio y, si es relevante, lo comunicaremos a los usuarios registrados. La fecha de la
        última versión figura al pie.
      </p>
    </section>
  </LegalPage>
</template>
