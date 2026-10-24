# Tercer Tiempo · Frontend

SPA de **Tercer Tiempo**, plataforma de seguimiento del rendimiento de cada jugador, partido a partido. El **club** nombra a los
técnicos de sus equipos cada temporada y les entrega un código de acceso. El **cuerpo técnico** gestiona la plantilla
de su equipo, genera un código personal para cada jugador y, tras cada partido, rellena el acta interna
(minutos, goles, asistencias, tiros, tarjetas; la nota se calcula sola), la compara con el **acta oficial de la
federación** (asturfutbol.es) y puede subir el **vídeo del partido**, que su plantilla ve gratis y el resto de técnicos
previo pago. Cada **jugador** se vincula a su ficha y ve en su panel cuánto aporta a nivel individual, a su equipo y
frente al resto de la liga. Los datos de cada plantilla son privados salvo que su cuerpo técnico la haga pública.

La API vive en su propio repositorio: [TercerTiempo-Back](https://github.com/diegoesp10/TercerTiempo-Back).

## Stack

- Vue 3 (`<script setup>`) + TypeScript estricto
- Vite 8
- Tailwind CSS 4 (configuración CSS-first en `src/style.css`)
- Pinia (sesión) y Vue Router (guardas `requiresAuth` / `guestOnly`, rutas anidadas para la plantilla)
- [Apache ECharts 6](https://echarts.apache.org) con [vue-echarts 8](https://vue-echarts.dev) para los gráficos: solo
  se registran los tipos que se usan (`src/charts/setup.ts`), con un tema propio alineado con Tailwind
  (`src/charts/theme.ts`) y en un chunk aparte que solo se descarga en las páginas con gráficos
- [Three.js](https://threejs.org) usado directamente (sin wrapper, para que el tree-shaking deje solo el renderer, la
  esfera, el material y las luces: ~130 kB gzip) para el balón 3D de la portada y de las pantallas de acceso: geometría
  y textura generadas en código (`src/three/ballTexture.ts`, los doce pentágonos en los vértices de un icosaedro),
  luces de estadio en azul y cian, se descarga cuando el navegador está ocioso (`utils/idle.ts`), se pausa fuera de
  pantalla y cae a un balón estático en SVG si no hay WebGL o el usuario prefiere menos animación
- [GSAP 3](https://gsap.com) para las animaciones: balón que bota en los loaders (`BallLoader`), líneas del campo que
  se dibujan al cargar (`PitchBackground`) y entrada escalonada de la portada

## Diseño

Sincronización: `stores/sync.ts` sondea `GET /api/sync/status` (cada minuto; cada 5 s mientras corre) y `SyncBanner`
muestra bajo la cabecera «Actualizando partidos…» con el logo animado, la liga en curso y la barra de progreso, y un
aviso breve de «Datos actualizados» al terminar. Navegación: toda página que no es principal (`meta.root`) muestra un botón **Atrás** (`BackButton`, historial del
router o la ruta padre si se entró por URL). Errores: `useAsync` lleva a `/error/servidor` cuando la API no responde o
falla (5xx) y a la página 404 cuando el recurso no existe; ambas (`ErrorPage`) usan el logotipo animado y ofrecen
reintentar, volver o ir al inicio. Iconos de **Font Awesome** (`src/icons.ts` registra solo los que se usan; `<Icon icon="chevron-down" />`). Todos los
desplegables son `SearchSelect` (botón + panel con buscador por nombre, grupos y teclado); el indicador de carga es el
logotipo animado (`BrandMark animated`).

Tema **claro y oscuro** (`src/style.css`): todos los colores son variables CSS con un valor por tema, y las utilidades de
Tailwind apuntan a ellas (`@theme inline`), así que las vistas no saben de temas. El tema lo elige el usuario en
*Ajustes* (claro, oscuro o el del sistema) o con el icono de la barra superior; se guarda en el dispositivo
(`stores/settings.ts`, atributo `data-theme` en `<html>`, fijado antes de pintar desde `index.html` para evitar
parpadeos). La escala `slate` es la escala de grises de la interfaz (slate-900 texto principal, slate-500 secundario,
slate-200 líneas, slate-50 relleno sutil) y `emerald`/`sky`/`amber`/`red` los tonos semánticos; `brand-*` es el azul de
la marca y `surface`/`line`/`canvas` las superficies. Tipografía deportiva: **Barlow** para el texto y **Barlow
Condensed** para titulares, cifras y cabeceras de tabla. Fondo fijo con un campo de césped en perspectiva (bandas de
siega, líneas que se dibujan al cargar, haz de luz de los focos) en `components/backgrounds/PitchBackground.vue`, más
tenue en el tema claro. Los gráficos tienen un tema de ECharts por cada tema de la interfaz (`charts/theme.ts`).

## Textos legales

La **política de privacidad** (`/privacidad`) y las **condiciones de uso** (`/condiciones`) están en
`src/views/legal/` sobre `components/legal/LegalPage.vue`; se enlazan desde el pie y el registro exige aceptarlas. Los
datos del titular (razón social, NIF, domicilio, alojamiento, pasarela de pago), la fecha de versión y las fuentes de
datos con su atribución están en `src/legal/entity.ts`: los valores entre corchetes son marcadores que hay que rellenar
antes de abrir el servicio al público. Los textos están redactados conforme al RGPD/LOPDGDD para el modelo actual
(cuentas de club, cuerpo técnico y jugador; datos de fuentes públicas; nota calculada; vídeos de pago; menores) y
conviene que los revise un abogado antes de comercializar la aplicación.

## Arranque rápido

Requisitos: Node 22+ y la API arrancada en `http://localhost:5080` (ver repo del backend).

```bash
npm install
```

```bash
npm run dev
```

La aplicación queda en `http://localhost:5173`. La URL de la API se configura en `.env.development`
(`VITE_API_URL`); `.env.example` documenta las variables disponibles.

Flujo de prueba como **club**: *Darme de alta* (Club, eligiendo el club del desplegable: sus equipos quedan vinculados) →
**«Nombrar a un técnico»** (equipo, nombre, rol y validez; por defecto hasta el final de la temporada) → aparece el
**código de acceso** para entregárselo. Desde la tabla de nombramientos se prorroga, acorta o revoca cada uno.

Flujo de prueba como **cuerpo técnico**: *Darme de alta* (Cuerpo técnico) con el código de acceso del club → se crea
la plantilla de tu equipo (se importan las fichas publicadas por futbolasturiano.es; el club o técnico genera después
un código personal junto al nombre de cada jugador) → *Partidos y actas* → abrir un partido disputado → marcar quién jugó, rellenar sus líneas y
**«Guardar acta»** (la nota de cada jugador se calcula sola con los datos) → pestaña **«Comparador con la
federación»** (acta interna frente a la oficial, con las discrepancias marcadas y las líneas oficiales sin ficha; si la
federación aún no la ha publicado, el backend comprueba los datos pendientes como máximo una vez al día) → pestaña **«Vídeo»** (subir el vídeo del partido; los técnicos
de otras plantillas lo compran) →
*Estadísticas* (gráficos del equipo: resultados y puntos, nota media por partido, reparto de goles, minutos y ranking de
nota; cada nombre abre la ficha del jugador con su nota partido a partido, el desglose de la nota y su radar por 90') →
*Comparador* (hasta 4 jugadores: radar superpuesto, cara a cara, nota por partido y acciones por 90'). En *Plantilla* se añaden o editan fichas, se regenera
el código personal de cada jugador y se cambia la visibilidad.

Flujo de prueba como **jugador**: *Darme de alta* (Jugador, solo con el código personal que te generó el técnico: la cuenta se crea con el nombre de la ficha y ya vinculada) →
pedir al club o entrenador su código personal → introducirlo → comprobar la única ficha que autoriza el código → **«Vincular mi ficha»** → *Mi panel*. El nombre de la cuenta debe coincidir con la ficha y el código solo se usa una vez. *Mi plantilla* y *Partidos* muestran
la plantilla y las actas de tu equipo.

Sin cuenta se pueden consultar los equipos de cada liga, sus calendarios, la clasificación, el acta oficial de cada
partido y las actas internas de las plantillas públicas. En *Liga* aparece la **jornada en curso** (o la próxima) de la liga elegida, con sus partidos por
hora y resultado, y se puede navegar al resto de jornadas; la ficha de cada equipo destaca su próximo partido.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Type-check (`vue-tsc`) + build de producción en `dist/`. Las librerías pesadas van en chunks propios y estables (`vite.config.ts` → `manualChunks`): `echarts` (solo en las páginas con gráficos), `three` (portada y acceso), `gsap` y `vue` |
| `npm run preview` | Sirve el build de producción |
| `npm run typecheck` | Solo type-check |

## Estructura

```
src/
├── api/          cliente fetch con JWT y ApiError (ProblemDetails) + funciones por recurso
├── types/api.ts  tipos espejo de los DTOs de la API
├── stores/auth   token + cuenta (jugador con su plantilla / técnico con sus plantillas), persistidos en localStorage
├── router/       rutas y guardas de autenticación
├── composables/  useAsync (estado de carga/error), useSquad (contexto de la plantilla para sus pestañas)
├── utils/        formato de fechas, etiquetas (posición, rol, visibilidad, estado), resultado por equipo
├── three/        textura del balón generada en canvas
├── legal/        datos del titular, fecha de versión y fuentes de datos para los textos legales
├── charts/       ECharts: registro y tema, escala de color de las notas, perfil por 90' y constructores de opciones
│                 (nota por partido, desglose de la nota, radar, comparador, resultados y nota del equipo, repartos)
├── components/   layout (AppShell, BrandMark, AuthPanel: acceso con balón 3D), backgrounds (PitchBackground),
│                 three (BallScene, Ball), ui (StatCard, Badge, Alert, Spinner y BallLoader,
│                 PageHeader, PercentileBar, RatingBadge), charts (AppChart, ChartCard), competitions (CompetitionPicker:
│                 nivel → liga/grupo), matches (MatchRow, MatchdayFixtures: jornada con navegación),
│                 sheet (OfficialSheetPanel: acta oficial con estado y reintento; SheetComparison: comparador),
│                 videos (MatchVideos: lista, reproductor con ticket, compra, subida), legal (LegalPage),
│                 clubs (ClubPicker: desplegable con búsqueda sobre el catálogo de clubes del registro),
│                 teams (TeamCrest: escudo servido por la API o insignia con iniciales; ClubRosterEditor: el club
│                 corrige la plantilla publicada de sus equipos), matches (MatchPreview: previa con probabilidades y
│                 análisis del rival para el técnico), ui (SearchSelect: el desplegable único con buscador)
└── views/        Home (landing / panel del club / panel del técnico / panel del jugador), Login, Registro (tres tipos
                  de cuenta; el técnico con código de acceso), Invitación (jugadores), Equipos, Equipo, Partido (acta
                  oficial, vídeos y actas internas), Liga, Ajustes, NotFound
    ├── legal/    PrivacyView (política de privacidad) y TermsView (condiciones de uso)
    ├── club/     ClubHomeView (equipos del club con cambio de escudo, vincular otro, nombramientos y códigos de acceso)
    ├── coach/    CoachHomeView (mis plantillas y nombramientos), RedeemView (canjear un código de acceso)
    ├── player/   PlayerDashboardView (vínculo con la plantilla y estadísticas)
    └── squad/    SquadLayoutView (cabecera + pestañas) con SquadPlayersView (fichas, staff, código, visibilidad),
                  SquadMatchesView (partidos con estado del acta), SquadStatsView (gráficos del equipo + tabla
                  ordenable), SquadCompareView (comparador de hasta 4 jugadores), SquadPlayerProfileView (ficha y
                  gráficos de un jugador) y MatchSheetView (pestañas: acta interna, comparador con la federación, vídeo)
```

Convenciones:

- Los tipos de `src/types/api.ts` deben mantenerse alineados con los DTOs del backend (los enums viajan como string).
- Las llamadas a la API pasan siempre por `src/api/index.ts`; los errores llegan como `ApiError` con
  `fieldErrors` (claves en camelCase) para pintarlos bajo cada campo.
- Las vistas usan `useAsync` para carga/error y los componentes de `ui/` para mantener el mismo lenguaje visual.
- Lo que puede hacer cada cuenta lo decide la API (`canManage`, `canEdit`, `canView`, 403); la UI solo oculta lo que
  no procede.

## Siguientes pasos sugeridos

- Precargar el acta interna con las líneas del acta oficial (minutos, goles y tarjetas ya vienen de la federación).
- Pasarela de pago real y retransmisión en directo de los partidos.
- Comparativa por posición y entre jugadores de distintas plantillas públicas de la liga.
- Refresco automático del token / manejo de expiración más fino.
- PWA para rellenar el acta desde el móvil nada más terminar el partido.
