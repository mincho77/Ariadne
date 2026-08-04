# Hub — métricas de seguimiento Gantt

Las tarjetas del Hub (`GET /api/projects`) incluyen `ganttMetrics` calculadas desde el planificador y, si existe, la baseline más reciente.

## API

```
GET /api/projects/{slug}/gantt/metrics
```

Acepta los mismos query params que `GET …/gantt` (`capacity`, `startDate`, `includeDone`, …).

Respuesta:

```json
{
  "project": "ariadne",
  "metrics": {
    "forecastFinishDate": "2026-08-20",
    "forecastPendingDays": 6,
    "completionRate": 72,
    "baselineFinishDate": "2026-08-17",
    "finishVarianceDays": 3,
    "pendingDaysDelta": 2,
    "slippedTasks": 1,
    "deadlineAtRisk": 0,
    "blockedTasks": 1,
    "blockedWithoutUnblockDate": 0,
    "lowConfidenceTasks": 0,
    "forecastConfidence": "medium",
    "cycleDetected": false
  }
}
```

## Campos mostrados en la tarjeta Hub

| Campo UI | Fuente |
|----------|--------|
| Fin pronóstico | `forecastFinishDate` |
| % completado | `completionRate` |
| Variación | `finishVarianceDays` o `pendingDaysDelta` vs baseline |
| Riesgos | `deadlineAtRisk`, `blockedTasks`, `slippedTasks`, `cycleDetected` |
| Confianza | `forecastConfidence` |

## Reglas de confianza (`forecastConfidence`)

| Nivel | Condición |
|-------|-----------|
| **low** | `cycleDetected`, o `lowConfidenceForecasts > 0`, o bloqueo sin `expected_unblock_date` |
| **medium** | Violaciones de deadline, bloqueos con fecha, o tareas con confianza media |
| **high** | Ninguna de las anteriores |

La confianza **baja** en una tarea individual (AH-E-21) ocurre cuando está bloqueada sin fecha de desbloqueo. El Hub propaga el peor caso al nivel proyecto.

## Baseline

Si hay archivos en `backlog/docs/gantt/baselines/`, se compara automáticamente con la más reciente para `pendingDaysDelta`, `slippedTasks` y `finishVarianceDays`.
