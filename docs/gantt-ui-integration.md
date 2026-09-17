# Gantt UI — integración con frontend externo

La UI editable del diagrama vive **fuera** de este repo. Ariadne expone el motor y las APIs; el frontend en `:63447` consume JSON y persiste cambios vía PATCH.

## Bloqueo conocido (AGANTT-DEF-01)

| Item | Valor |
|------|-------|
| Repo frontend | Configurable mediante `ARIADNE_GANTT_UI_REPO` |
| Puerto default | `63447` |
| Estado en workspace cloud | **No clonado** — no se puede desarrollar ni probar la UI aquí |
| Qué sí entrega Ariadne | Contrato API, CORS, `hub-config`, smoke backend |

Para trabajo visual completo: clonar el repo frontend, `npm install && npm start` (puerto 63447), y apuntar `ARIADNE_GANTT_BASE_URL` si difiere.

## Arranque local (flujo completo)

1. Hub Ariadne: `npm start` → `http://127.0.0.1:4177`
2. Frontend Gantt (repo externo) → `http://localhost:63447`
3. Hub → **Abrir Gantt** abre `{ganttBaseUrl}?project={slug}`

Variables:

| Variable | Default | Uso |
|----------|---------|-----|
| `ARIADNE_HUB_PORT` | `4177` | API backend |
| `ARIADNE_GANTT_BASE_URL` | `http://localhost:63447/` | URL de la UI |
| `ARIADNE_GANTT_UI_REPO` | Vacío | Metadato opcional en contrato |

## Descubrimiento

```
GET /api/hub-config
GET /api/gantt-ui-contract
```

`hub-config` incluye `ganttUi` con endpoints, claves JSON requeridas, URL de lanzamiento y estado de bloqueo.

Ejemplo mínimo:

```json
{
  "ganttBaseUrl": "http://localhost:63447/",
  "hubApiBase": "http://127.0.0.1:4177",
  "ganttLaunchExample": "http://localhost:63447/?project=ariadne",
  "ganttUi": {
    "contractVersion": "1.0",
    "frontend": {
      "repoUrl": "",
      "blockedInWorkspace": true,
      "blockId": "AGANTT-DEF-01"
    }
  }
}
```

## Lectura (timeline + tabla)

```
GET {hubApiBase}/api/projects/{slug}/gantt?capacity=2&startDate=2026-08-04&includeDone=0
```

Campos clave para la UI:

| Vista | Fuente JSON |
|-------|-------------|
| Tabla de tareas | `tasks[]`, `hierarchy.nodes` |
| Timeline | `tasks[]`, `dayMarkers[]`, `monthMarkers[]` |
| Dependencias visuales | `dependencyEdges[]` (`fromId`, `toId`, `relation`, anchors) |
| Hitos | `milestones[]` (duración 0) |
| Ruta crítica | `criticalPath.route` |
| Diagnósticos | `tasks[].diagnostics`, `tasks[].violations` |

Contrato completo del plan: `docs/gantt-planner-contract.md`.

## Escritura (edición)

| Acción | API |
|--------|-----|
| Campos temporales / progreso / bloqueos / jerarquía | `PATCH /api/projects/{slug}/tasks/{id}` + `If-Match: {sourceHash}` |
| **Autorizar a Queue** (drawer) | `POST /api/projects/{slug}/tasks/{id}/queue` body `{ "position": "end"\|"head", "ordinal"?: number }` |
| Dependencias | `POST /api/projects/{slug}/tasks/{id}/dependencies` → use `.../tasks/dependencies` |
| Línea base | `POST /api/projects/{slug}/gantt/baselines` |

### Autorizar a Queue desde Gantt

Persiste `status: Queued` y recalcula `ordinal` de toda la cola (`10, 20, 30…`):

```bash
curl -sS -X POST "http://127.0.0.1:4177/api/projects/ariadne/tasks/AH-E-43/queue" \
  -H 'content-type: application/json' \
  -d '{"position":"end"}'
# cabeza de cola:
curl -sS -X POST "http://127.0.0.1:4177/api/projects/ariadne/tasks/AH-E-43/queue" \
  -H 'content-type: application/json' \
  -d '{"position":"head"}'
# slot por ordinal deseado (se normaliza):
curl -sS -X POST "http://127.0.0.1:4177/api/projects/ariadne/tasks/AH-E-43/queue" \
  -H 'content-type: application/json' \
  -d '{"ordinal":20}'
```

La UI Angular debe exponer la acción en el drawer (contrato: `ganttUi.endpoints.taskQueueAuthorize` en `/api/hub-config`).

## CORS

El Hub responde `Access-Control-Allow-Origin: *` y permite `GET`, `POST`, `PATCH`, `OPTIONS` con header `If-Match` para que la UI en otro origen (63447) llame al API en 4177.

## Smoke test

```bash
npm run gantt:smoke
```

Valida:

- `GET /api/hub-config` y `/api/gantt-ui-contract`
- URL de lanzamiento Hub→UI
- `GET /api/projects/{slug}/gantt` cumple el contrato UI
- Opcional: reachability HTTP del `ganttBaseUrl` (informativo si el frontend no está levantado)

## Referencias

- `docs/GANTT.md` — arquitectura general
- `docs/gantt-temporal-model.md` — campos editables
- `docs/gantt-baselines.md`, `docs/gantt-progress.md`, `docs/gantt-blocks.md`, `docs/gantt-hierarchy.md`
