# Plantillas de Acceptance Criteria

Al crear tareas (Hub Kanban, API o CLI), Ariadne puede sembrar `## Acceptance Criteria` con plantillas nombradas.

## Plantillas

| id | Uso |
|----|-----|
| `bug` | Repro → causa → fix → sin regresión |
| `enhancement` | Comportamiento + AC binarios + prueba + evidencia |
| `feature` | Flujo principal + bordes + tests + docs |
| `swarm` | API/CLI + tests + evidencia de complete |
| `minimal` | Un solo criterio de done |
| `none` | Sin AC |

Por defecto: bugs → `bug`; mejoras → `enhancement`; títulos con hub/swarm → `swarm`.

## API

```bash
GET  /api/tasks/ac-templates?project=ariadne
POST /api/tasks/create?project=ariadne
# body: { "title":"…", "type":"enhancement", "template":"swarm" }
# o:    { "title":"…", "acceptanceCriteria":["…","…"] }
```

## CLI

```bash
npm run task:create -- ariadne --mejora "HUB · Ejemplo" --template swarm
npm run bug:create -- project-demo --bug "BUG · Ejemplo" --template bug
```

## UI

En tableros Bugs / Mejoras, al crear se pide título y plantilla AC (`bug | enhancement | feature | swarm | minimal | none`).

Implementación: `lib/ac-templates.js` · `task-ids.js` (`buildTaskSource`).
