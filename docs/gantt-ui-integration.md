# Gantt UI — integración con frontend externo

La UI editable del diagrama vive **fuera** de este repo. Ariadne expone el motor y las APIs; el frontend en `:63447` consume JSON y persiste cambios vía PATCH.

## Bloqueo conocido (AGANTT-DEF-01)

| Item | Valor |
|------|-------|
| Repo frontend | [repoxai/frontend-angular](https://github.com/repoxai/frontend-angular) |
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
| `ARIADNE_GANTT_UI_REPO` | GitHub frontend-angular | Metadato en contrato |

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
      "repoUrl": "https://github.com/repoxai/frontend-angular",
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
| Dependencias | `POST /api/projects/{slug}/tasks/dependencies` |
| Línea base | `POST /api/projects/{slug}/gantt/baselines` |

La UI **no** escribe Markdown crudo; usa PATCH atómico (AH-E-14).

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
