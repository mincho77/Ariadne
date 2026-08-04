# Vista portafolio Gantt (AH-E-28)

Agrega una vista **multiproyecto** sobre el catálogo del Hub: métricas, hitos, riesgos, capacidad por proyecto y dependencias cross-project.

## API

```http
GET /api/gantt/portfolio?capacity=2&startDate=2026-08-04&includeDone=0
```

Acepta los mismos query params que `GET /api/projects/{slug}/gantt` (`capacity`, `resourceAware`, `startDate`, …).

### Respuesta (fragmento)

| Campo | Descripción |
|-------|-------------|
| `summary.projectCount` | Proyectos en `projects.json` |
| `summary.atRiskProjects` | Proyectos con alertas activas |
| `summary.latestForecastFinish` | Fecha fin más lejana del portafolio |
| `summary.crossProjectDependencies` | Aristas cross-project detectadas |
| `projects[]` | Fila por proyecto con `metrics` (Hub) y `riskFlags` |
| `milestones[]` | Hitos de todos los proyectos (`compositeId`: `slug:taskId`) |
| `crossProjectDependencies[]` | Dependencias entre proyectos |
| `sharedCapacity[]` | Capacidad efectiva por proyecto |
| `risks[]` | Alertas agregadas por proyecto |

## Dependencias cross-project

En el frontmatter de una tarea, referencie otra proyecto con:

```yaml
dependencies:
  - jurismate:JM-E-10
  - ariadne:AH-E-19:FS+2d
```

Formato: `{slug}:{taskId}` o `{slug}:{taskId}:{RELATION}{lag}`.

Separadores válidos entre slug e id: `:`, `@`, `|`.

El motor **no reprograma** el grafo global en v1; el portafolio **indexa y alerta** estas dependencias para coordinación entre equipos.

## UI Hub

Página estática: `http://127.0.0.1:4177/portfolio.html`

Enlace desde el Hub principal (**Portafolio Gantt**). Consume `GET /api/gantt/portfolio`.

## Operación

1. Registrar proyectos en `projects.json` (vía Hub o manual).
2. Abrir portafolio para ver hitos alineados y riesgos.
3. Corregir `unresolvedCrossProjectDependencies` (typo en slug/id).
4. Abrir Gantt individual desde cada tarjeta de proyecto en el Hub.

Ver también `docs/gantt-hub-metrics.md` y `docs/gantt-planner-contract.md`.
