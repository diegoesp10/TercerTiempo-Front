<script setup lang="ts">
import LegalPage from '@/components/legal/LegalPage.vue';
import { dataSources, legalEntity } from '@/legal/entity';
</script>

<template>
  <LegalPage title="Condiciones de uso" subtitle="Reglas del servicio para clubes, cuerpo técnico, jugadores y visitantes.">
    <section>
      <h2>1. Titular y objeto</h2>
      <p>
        Tercer Tiempo es un servicio de <strong>{{ legalEntity.name }}</strong>, NIF {{ legalEntity.nif }}, con domicilio en
        {{ legalEntity.address }} y correo de contacto <a :href="`mailto:${legalEntity.email}`">{{ legalEntity.email }}</a>.
        Estas condiciones regulan el acceso y el uso de la plataforma (web y API). Al crear una cuenta o utilizar el servicio
        aceptas estas condiciones y la <RouterLink to="/privacidad">política de privacidad</RouterLink>. Si no estás de
        acuerdo, no utilices el servicio.
      </p>
    </section>

    <section>
      <h2>2. Qué ofrece el servicio</h2>
      <ul>
        <li>Consulta pública de calendarios, resultados, clasificaciones y actas oficiales de las ligas asturianas, a partir de fuentes públicas (apartado 7).</li>
        <li>Para clubes: vinculación de sus equipos y nombramiento de su cuerpo técnico por temporada mediante códigos de acceso.</li>
        <li>Para el cuerpo técnico: gestión de la plantilla, registro del acta interna de cada partido, comparación con el acta oficial, estadísticas, gráficos y subida del vídeo del partido.</li>
        <li>Para jugadores: vinculación a su ficha y consulta de sus estadísticas.</li>
        <li>Acceso de pago a vídeos de partidos para técnicos de otras plantillas (apartado 6).</li>
      </ul>
    </section>

    <section>
      <h2>3. Cuentas</h2>
      <ul>
        <li>Hay tres tipos de cuenta: <strong>club</strong>, <strong>cuerpo técnico</strong> y <strong>jugador</strong>. El tipo no se puede cambiar después del alta.</li>
        <li>Debes tener al menos 14 años para crear una cuenta de jugador y, entre 14 y 17 años, contar con la autorización de tus padres o tutores. Las cuentas de club y de cuerpo técnico requieren mayoría de edad.</li>
        <li>Quien registra una cuenta de club declara estar facultado para actuar en nombre de esa entidad y para nombrar a su cuerpo técnico.</li>
        <li>Los datos facilitados deben ser veraces y mantenerse actualizados. Eres responsable de la confidencialidad de tu contraseña y de todo lo que se haga con tu cuenta.</li>
        <li>Los <strong>códigos de acceso</strong> (club → técnico) y los <strong>códigos de invitación</strong> (técnico → jugador) son personales: entregarlos a quien no corresponde es responsabilidad de quien los facilita. Cada código de acceso se canjea una sola vez y caduca con el nombramiento.</li>
      </ul>
    </section>

    <section>
      <h2>4. Clubes, cuerpo técnico y plantillas</h2>
      <ul>
        <li>Solo el cuerpo técnico con un nombramiento vigente del club puede gestionar la plantilla de un equipo y registrar sus actas. Los nombramientos no superan la temporada; el club puede acortarlos, prorrogarlos o revocarlos en cualquier momento.</li>
        <li>El club y su cuerpo técnico son responsables de la licitud y la exactitud de los datos que introducen sobre sus jugadores, de informarles de que usan Tercer Tiempo y, en el caso de menores, de contar con la autorización de sus padres o tutores.</li>
        <li>Las observaciones del acta deben referirse únicamente al juego. No se admiten comentarios ofensivos, discriminatorios ni ajenos al rendimiento deportivo.</li>
        <li>Las plantillas nacen privadas. Hacerlas públicas es una decisión del cuerpo técnico, que asume sus consecuencias frente a sus jugadores.</li>
        <li>Cuando un nombramiento caduca o se revoca, el técnico pierde el acceso; las actas que registró se conservan como datos de la plantilla.</li>
      </ul>
    </section>

    <section>
      <h2>5. Contenidos que suben los usuarios y vídeos</h2>
      <ul>
        <li>Conservas los derechos sobre los contenidos que subes (vídeos, observaciones, fichas). Concedes a Tercer Tiempo una licencia no exclusiva, mundial y gratuita para alojarlos, reproducirlos, transmitirlos y mostrarlos en la plataforma con el único fin de prestar el servicio, durante el tiempo que permanezcan en ella.</li>
        <li>Quien sube un vídeo garantiza que tiene derecho a hacerlo: que lo ha grabado él o su club, que no vulnera derechos de terceros y que cuenta con el <strong>consentimiento para la grabación y su difusión</strong> de las personas que aparecen o, si son menores, de sus padres o tutores.</li>
        <li>Está prohibido subir contenidos ilícitos, ofensivos, que vulneren la intimidad o el honor de alguien, o que incluyan música u otras obras sin licencia.</li>
        <li>Tercer Tiempo puede retirar cualquier contenido que incumpla estas condiciones o a requerimiento de un afectado o de una autoridad, y puede eliminar los vídeos de plantillas inactivas avisando con antelación.</li>
      </ul>
    </section>

    <section>
      <h2>6. Acceso de pago a vídeos</h2>
      <ul>
        <li>La plantilla que sube un vídeo (su cuerpo técnico vigente y sus jugadores vinculados) lo ve sin coste. Los técnicos de otras plantillas pueden comprar el acceso al precio indicado, impuestos incluidos, mediante la pasarela de pago. Tercer Tiempo emitirá la factura correspondiente.</li>
        <li>El acceso comprado es <strong>personal e intransferible</strong>, para visualización en la plataforma: no incluye la descarga, la copia, la difusión ni ningún uso comercial del vídeo.</li>
        <li>Como consumidor, dispones de un plazo de desistimiento de 14 días; al iniciar la visualización consientes expresamente que el contenido digital se te suministre de inmediato y reconoces que pierdes el derecho de desistimiento. Si el vídeo se elimina o deja de estar disponible por causa de Tercer Tiempo o de quien lo subió, se te reembolsará el importe.</li>
        <li>El reparto del precio con el club o el cuerpo técnico que sube el vídeo, si lo hubiera, se regirá por el acuerdo específico con ese club.</li>
      </ul>
    </section>

    <section>
      <h2>7. Datos deportivos de fuentes públicas</h2>
      <p>Los calendarios, resultados, clasificaciones, plantillas publicadas y actas oficiales proceden de:</p>
      <ul>
        <li v-for="source in dataSources" :key="source.name">
          <a :href="source.url" target="_blank" rel="noopener">{{ source.name }}</a>: {{ source.what }}.
        </li>
      </ul>
      <p>
        Tercer Tiempo no es un servicio oficial de la Real Federación de Fútbol del Principado de Asturias ni de ningún medio,
        no está vinculado a ellos y no garantiza la exactitud, integridad ni actualidad de esos datos. En caso de discrepancia
        prevalece el acta oficial publicada por la federación, que se enlaza desde cada partido. Los nombres y escudos de
        clubes y competiciones se utilizan únicamente para identificarlos y pertenecen a sus titulares.
      </p>
    </section>

    <section>
      <h2>8. La nota calculada y las estadísticas</h2>
      <p>
        La nota de cada jugador en un partido se calcula automáticamente con los datos del acta interna, la posición y el
        resultado, según una fórmula fija y pública en la pantalla del acta. Es una referencia orientativa para el propio club
        y el jugador: no es una valoración oficial ni sirve de base para ninguna decisión con efectos jurídicos.
      </p>
    </section>

    <section>
      <h2>9. Uso aceptable</h2>
      <ul>
        <li>No accedas a plantillas, actas o vídeos a los que no tengas derecho, ni intentes eludir la privacidad de una plantilla o los tickets de reproducción.</li>
        <li>No utilices la plataforma ni su API de forma automatizada o masiva (extracción de datos, rastreo, reventa) sin autorización escrita.</li>
        <li>No subas contenidos ilícitos ni suplantes a otra persona, club o entidad.</li>
        <li>No interfieras con el funcionamiento del servicio ni intentes acceder a sus sistemas.</li>
      </ul>
    </section>

    <section>
      <h2>10. Propiedad intelectual de la plataforma</h2>
      <p>
        El software, el diseño, los textos propios, las marcas y los gráficos de Tercer Tiempo pertenecen a
        {{ legalEntity.name }} o a sus licenciantes. Se te concede una licencia personal, limitada, no exclusiva y revocable
        para usar el servicio conforme a estas condiciones. Las estadísticas y notas calculadas a partir de las actas de tu
        plantilla son datos de tu club; puedes exportarlos o pedir su portabilidad.
      </p>
    </section>

    <section>
      <h2>11. Disponibilidad y responsabilidad</h2>
      <p>
        Tercer Tiempo se presta «tal cual». Haremos lo razonable para mantenerlo disponible y seguro, pero puede haber
        interrupciones por mantenimiento, fallos de terceros (alojamiento, fuentes de datos, pasarela de pago) o causas
        ajenas. No respondemos de los daños indirectos ni de las decisiones que se tomen a partir de las estadísticas, de las
        notas o de los datos de terceros; en todo caso, nuestra responsabilidad frente a un usuario se limita a las cantidades
        que haya pagado al servicio en los doce meses anteriores, salvo en lo que la ley no permita limitar.
      </p>
    </section>

    <section>
      <h2>12. Baja, suspensión y cambios</h2>
      <ul>
        <li>Puedes darte de baja en cualquier momento escribiendo a <a :href="`mailto:${legalEntity.email}`">{{ legalEntity.email }}</a>; los datos se tratan según la política de privacidad.</li>
        <li>Podemos suspender o cancelar una cuenta que incumpla estas condiciones, con aviso previo salvo urgencia o requerimiento legal.</li>
        <li>Podemos modificar estas condiciones; avisaremos a los usuarios registrados con antelación razonable y los cambios no se aplicarán retroactivamente a compras ya realizadas.</li>
      </ul>
    </section>

    <section>
      <h2>13. Ley aplicable y reclamaciones</h2>
      <p>
        Estas condiciones se rigen por la legislación española. Para cualquier controversia, los consumidores pueden acudir a
        los juzgados de su domicilio; también puedes utilizar la plataforma europea de resolución de litigios en línea en
        <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener">ec.europa.eu/consumers/odr</a>. Para el
        resto de usuarios serán competentes los juzgados del domicilio de {{ legalEntity.name }}.
      </p>
    </section>
  </LegalPage>
</template>
