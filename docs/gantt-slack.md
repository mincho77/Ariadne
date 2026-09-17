# Holgura y ruta crítica condicionada (AH-E-26)

Cada plan Gantt incluye análisis de **holgura** (slack) y dos rutas críticas:

| Ruta | Campo | Significado |
|------|-------|-------------|
| Lógica | `criticalPath` y `slack.logicalCriticalPath` | Cadena más larga solo por dependencias y duraciones |
| Condicionada por recursos | `slack.resourceCriticalPath` | Cadena más larga según fechas **programadas** (capacidad + recursos + restricciones) |

## Objeto `slack`

```json
{
  "logicalCriticalPath": { "route": [], "estimatedIaHours": 24, "kind": "logical" },
  "resourceCriticalPath": { "route": [], "estimatedIaHours": 32, "kind": "resource" },
  "projectEndIaHour": 32
}
```

## Campos por tarea (`tasks[]`)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `totalSlackIaHours` | número | Holgura total (late start − early start) |
| `freeSlackIaHours` | número | Igual a total en v1 |
| `isCriticalSlack` | boolean | `true` cuando holgura ≤ 0 |
| `earlyStartIaHour` / `lateStartIaHour` | número | Ventana CPM sobre el cronograma actual |

`summary.criticalSlackTasks` cuenta tareas con holgura cero.

## Cuándo difieren las rutas

Con `resourceAware=1` o capacidad limitada, la ruta **resource** suele ser más larga que la **logical**: el cuello de botella pasa de dependencias puras a capacidad operativa o pools de habilidad.

Fixture de referencia: `tests/fixtures/gantt/scenarios/resource-pool-capacity/`.
