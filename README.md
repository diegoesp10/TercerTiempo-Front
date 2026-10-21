# Tercer Tiempo · Frontend

SPA de **Tercer Tiempo**, plataforma de actas y rendimiento para el fútbol amateur. El **club** nombra a los
técnicos de sus equipos cada temporada y les entrega un código de acceso. El **cuerpo técnico** gestiona la plantilla
de su equipo, comparte un código de invitación con los jugadores y, tras cada partido, rellena el acta interna
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

Flujo de prueba como **club**: *Darme de alta* (Club) → **«Vincular un equipo»** (nivel, liga, grupo y equipo) →
**«Nombrar a un técnico»** (equipo, nombre, rol y validez; por defecto hasta el final de la temporada) → aparece el
**código de acceso** para entregárselo. Desde la tabla de nombramientos se prorroga, acorta o revoca cada uno.

Flujo de prueba como **cuerpo técnico**: *Darme de alta* (Cuerpo técnico) con el código de acceso del club → se crea
la plantilla de tu equipo (se importan las fichas publicadas por futbolasturiano.es y aparece el código de invitación
para los jugadores) → *Partidos y actas* → abrir un partido disputado → marcar quién jugó, rellenar sus líneas y
**«Guardar acta»** (la nota de cada jugador se calcula sola con los datos) → pestaña **«Comparador con la
federación»** (acta interna frente a la oficial, con las discrepancias marcadas y las líneas oficiales sin ficha; si la
federación aún no la ha publicado, se reintenta solo) → pestaña **«Vídeo»** (subir el vídeo del partido; los técnicos
de otras plantillas lo compran) →
*Estadísticas* (gráficos del equipo: resultados y puntos, nota media por partido, reparto de goles, minutos y ranking de
nota; cada nombre abre la ficha del jugador con su nota partido a partido, el desglose de la nota y su radar por 90') →
*Comparador* (hasta 4 jugadores: radar superpuesto, cara a cara, nota por partido y acciones por 90'). En *Plantilla* se añaden o editan fichas, se regenera
el código y se cambia la visibilidad.

Flujo de prueba como **jugador**: *Darme de alta* (Jugador, con el nombre con el que apareces en la plantilla) →
introducir el código de invitación → **«Soy yo»** sobre tu ficha → *Mi panel*. *Mi plantilla* y *Partidos* muestran
la plantilla y las actas de tu equipo.

Sin cuenta se pueden consultar los equipos de cada liga, sus calendarios, la clasificación, el acta oficial de cada
partido y las actas internas de las plantillas públicas. En *Liga* aparece la **jornada en curso** (o la próxima) de la liga elegida, con sus partidos por
hora y resultado, y se puede navegar al resto de jornadas; la ficha de cada equipo destaca su próximo partido.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con HMR |
| `npm run build` | Type-check (`vue-tsc`) + build de producción en `dist/` |
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
├── charts/       ECharts: registro y tema, escala de color de las notas, perfil por 90' y constructores de opciones
│                 (nota por partido, desglose de la nota, radar, comparador, resultados y nota del equipo, repartos)
├── components/   layout (AppShell, navegación según tipo de cuenta), ui (StatCard, Badge, Alert, Spinner,
│                 PageHeader, PercentileBar, RatingBadge), charts (AppChart, ChartCard), competitions (CompetitionPicker:
│                 nivel → liga/grupo), matches (MatchRow, MatchdayFixtures: jornada con navegación),
│                 sheet (OfficialSheetPanel: acta oficial con estado y reintento; SheetComparison: comparador),
│                 videos (MatchVideos: lista, reproductor con ticket, compra, subida)
└── views/        Home (landing / panel del club / panel del técnico / panel del jugador), Login, Registro (tres tipos
                  de cuenta; el técnico con código de acceso), Invitación (jugadores), Equipos, Equipo, Partido (acta
                  oficial, vídeos y actas internas), Liga, NotFound
    ├── club/     ClubHomeView (equipos del club, nombramientos y códigos de acceso)
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
