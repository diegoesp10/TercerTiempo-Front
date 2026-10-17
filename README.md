# Tercer Tiempo · Frontend

SPA de **Tercer Tiempo**, plataforma de seguimiento de rendimiento para futbolistas amateur: el jugador se da de
alta, reclama su ficha en la plantilla de su equipo, registra su rendimiento partido a partido y ve en su panel
cuánto aporta a nivel individual, a su equipo y frente al resto de la liga.

La API vive en su propio repositorio: [TercerTiempo-Back](https://github.com/diegoesp10/TercerTiempo-Back).

## Stack

- Vue 3 (`<script setup>`) + TypeScript estricto
- Vite 8
- Tailwind CSS 4 (configuración CSS-first en `src/style.css`)
- Pinia (sesión) y Vue Router (guardas `requiresAuth` / `guestOnly`)

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

Flujo de prueba: *Darme de alta* → *Equipos* → elegir nivel (Nacional/Regional), liga y grupo → entrar en tu
equipo → **«Soy yo»** sobre tu ficha de la plantilla (o **«Unirme a este equipo»** si la web no la publica) →
*Partidos* → abrir un partido disputado → guardar rendimiento → *Panel*. En *Liga* se puede consultar la
clasificación de cualquier liga sincronizada.

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
├── stores/auth   token + jugador (persistidos en localStorage)
├── router/       rutas y guardas de autenticación
├── composables/  useAsync (estado de carga/error)
├── utils/        formato de fechas, etiquetas de posición/estado, resultado por equipo
├── components/   layout (AppShell), ui (StatCard, Badge, Alert, Spinner, PageHeader, PercentileBar),
│                 competitions (CompetitionPicker: nivel → liga/grupo), matches (MatchRow), performance (PerformanceForm)
└── views/        Login, Registro, Panel, Equipos, Equipo, Partidos, Partido, Liga, NotFound
```

Convenciones:

- Los tipos de `src/types/api.ts` deben mantenerse alineados con los DTOs del backend (los enums viajan como string).
- Las llamadas a la API pasan siempre por `src/api/index.ts`; los errores llegan como `ApiError` con
  `fieldErrors` (claves en camelCase) para pintarlos bajo cada campo.
- Las vistas usan `useAsync` para carga/error y los componentes de `ui/` para mantener el mismo lenguaje visual.

## Siguientes pasos sugeridos

- Gráficas de evolución por jornada (p. ej. Chart.js o ECharts) en el panel.
- Vista colectiva de la plantilla y comparativa por posición.
- Refresco automático del token / manejo de expiración más fino.
- PWA para registrar el rendimiento desde el móvil nada más terminar el partido.
