# Escenarios qué-pasa-si (AH-E-27)

Simula cambios de capacidad, festivos, estimaciones o parches de tareas **sin alterar el backlog** hasta confirmación explícita.

## Endpoint

`POST /api/projects/{slug}/gantt/what-if`

Query params: mismos que `GET …/gantt` (`capacity`, `startDate`, `resourceAware`, …).

### Body (JSON)

```json
{
  "label": "Capacidad +1",
  "overrides": {
    "capacity": 3,
    "resourceAware": true
  },
  "taskPatches": [
    {
      "id": "AH-E-10",
      "estimate_ia_hours": 16
    }
  ],
  "includePlans": false
}
```

| Campo | Descripción |
|-------|-------------|
| `label` | Nombre del escenario |
| `overrides` | Opciones del planificador para la simulación |
| `taskPatches` / `tasks` | Parches parciales (mismo esquema que PATCH tarea) |
| `includePlans` | `true` incluye `currentPlan` y `scenarioPlan` completos |
| `confirmAdopt` | `true` persiste `taskPatches` en el backlog |
| `confirmToken` | Debe ser `"ADOPT"` cuando `confirmAdopt` es true |

## Respuesta

- `current` / `scenario`: resúmenes (`summary`, `forecastFinishDate`, …)
- `comparison`: tabla side-by-side por tarea (`change`: `unchanged`, `slipped`, `pulled_forward`, …)
- `metrics`: métricas Hub para plan actual vs escenario
- `persisted`: `false` por defecto; `true` solo tras adopt confirmado
- `adopted`: lista `{ id, changes[] }` cuando se aplicaron parches

## Adoptar cambios

```json
{
  "label": "Subir estimación",
  "taskPatches": [{ "id": "AH-E-10", "estimate_ia_hours": 20 }],
  "confirmAdopt": true,
  "confirmToken": "ADOPT"
}
```

Sin `confirmToken: ADOPT` → HTTP 400. Los escenarios de simulación **nunca** escriben disco por defecto.

## Baselines

Para congelar un escenario aprobado, use `POST …/gantt/baselines` sobre el plan vigente (no sustituye adopt de parches).
