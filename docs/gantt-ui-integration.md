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
| `ARIADNE_GANTT_UI_REPO` | GitHub frontend-angular | Metadato en contrato; override si el repo se movió |
| `ARIADNE_GANTT_UI_PORT` | `63447` | Puerto default documentado en contrato |

## Bootstrap / diagnóstico (AGANTT-DEF-01)

```bash
npm run gantt:ui:bootstrap          # texto: repo remoto + probe HTTP UI
npm run gantt:ui:bootstrap -- --json
npm run gantt:ui:bootstrap -- --strict   # exit 1 si git ls-remote falla
```

El script **no clona** el frontend. Verifica `git ls-remote` contra `ARIADNE_GANTT_UI_REPO`, hace probe HTTP a `ARIADNE_GANTT_BASE_URL` e imprime pasos de arranque. En cloud el repo documentado suele responder 404 — el backend sigue listo vía `npm run gantt:smoke`.

Implementación: `lib/gantt/ui-probe.js`, `scripts/gantt-ui-bootstrap.js`.

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
npm run gantt:ui:bootstrap   # diagnóstico repo + UI (AGANTT-DEF-01)
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
