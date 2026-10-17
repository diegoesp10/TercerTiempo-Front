# Tercer Tiempo · Frontend

SPA de **Tercer Tiempo**, plataforma de actas y rendimiento para el fútbol amateur. El **cuerpo técnico** crea la
plantilla de su equipo, comparte un código de invitación con el resto del staff y con los jugadores y, tras cada
partido, rellena el acta (minutos, goles, asistencias, tiros, tarjetas y valoración de cada jugador). Cada **jugador**
se vincula a su ficha y ve en su panel cuánto aporta a nivel individual, a su equipo y frente al resto de la liga.
Los datos de cada plantilla son privados salvo que su cuerpo técnico la haga pública.

La API vive en su propio repositorio: [TercerTiempo-Back](https://github.com/diegoesp10/TercerTiempo-Back).

## Stack

- Vue 3 (`<script setup>`) + TypeScript estricto
- Vite 8
- Tailwind CSS 4 (configuración CSS-first en `src/style.css`)
- Pinia (sesión) y Vue Router (guardas `requiresAuth` / `guestOnly`, rutas anidadas para la plantilla)

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

Flujo de prueba como **cuerpo técnico**: *Darme de alta* (Cuerpo técnico) → *Equipos* → elegir nivel
(Nacional/Regional), liga y grupo → entrar en tu equipo → **«Crear plantilla»** (se importan las fichas publicadas por
futbolasturiano.es y aparece el código de invitación) → *Partidos y actas* → abrir un partido disputado → marcar quién
jugó, rellenar sus líneas y **«Guardar acta»** → *Estadísticas*. En *Plantilla* se añaden o editan fichas, se regenera
el código y se cambia la visibilidad.

Flujo de prueba como **jugador**: *Darme de alta* (Jugador, con el nombre con el que apareces en la plantilla) →
introducir el código de invitación → **«Soy yo»** sobre tu ficha → *Mi panel*. *Mi plantilla* y *Partidos* muestran
la plantilla y las actas de tu equipo.

Sin cuenta se pueden consultar los equipos de cada liga, sus calendarios, la clasificación y las actas de las
plantillas públicas.

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
├── components/   layout (AppShell, navegación según tipo de cuenta), ui (StatCard, Badge, Alert, Spinner,
│                 PageHeader, PercentileBar), competitions (CompetitionPicker: nivel → liga/grupo), matches (MatchRow)
└── views/        Home (landing / panel del técnico / panel del jugador), Login, Registro, Invitación,
                  Equipos, Equipo, Partido, Liga, NotFound
    ├── coach/    CoachHomeView (mis plantillas)
    ├── player/   PlayerDashboardView (vínculo con la plantilla y estadísticas)
    └── squad/    SquadLayoutView (cabecera + pestañas) con SquadPlayersView (fichas, staff, código, visibilidad),
                  SquadMatchesView (partidos con estado del acta), SquadStatsView (tabla ordenable) y
                  MatchSheetView (editor del acta: una línea por jugador)
```

Convenciones:

- Los tipos de `src/types/api.ts` deben mantenerse alineados con los DTOs del backend (los enums viajan como string).
- Las llamadas a la API pasan siempre por `src/api/index.ts`; los errores llegan como `ApiError` con
  `fieldErrors` (claves en camelCase) para pintarlos bajo cada campo.
- Las vistas usan `useAsync` para carga/error y los componentes de `ui/` para mantener el mismo lenguaje visual.
- Lo que puede hacer cada cuenta lo decide la API (`canManage`, `canEdit`, `canView`, 403); la UI solo oculta lo que
  no procede.

## Siguientes pasos sugeridos

- Precargar el acta con las estadísticas oficiales por jugador que publica futbolasturiano.es en cada partido.
- Gráficas de evolución por jornada (p. ej. Chart.js o ECharts) en el panel del jugador y en la plantilla.
- Comparativa por posición y vista de un jugador para el cuerpo técnico.
- Refresco automático del token / manejo de expiración más fino.
- PWA para rellenar el acta desde el móvil nada más terminar el partido.
