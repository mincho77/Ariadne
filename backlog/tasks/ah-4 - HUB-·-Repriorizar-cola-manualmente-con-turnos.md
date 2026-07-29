---
id: AH-4
title: HUB · Repriorizar cola manualmente con turnos
status: Done
assignee: []
created_date: '2026-07-29 09:30'
updated_date: '2026-07-29 09:45'
labels:
  - ariadne
  - hub
  - kanban
dependencies:
  - AH-2
references:
  - docs/plans/ariadne-local.md
priority: high
type: feature
ordinal: 40
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Permitir reordenar tareas dentro de la columna Queue arrastrando, persistir el orden con `ordinal` y actualizar los números de turno visibles.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La cola se ordena por `ordinal`, no por prioridad automática.
- [x] #2 Arrastrar dentro de Queue guarda el nuevo orden en Backlog.
- [x] #3 Los badges **Turno 1, 2, 3…** cambian al mover tarjetas.
- [x] #4 Arrastrar desde To Do a Queue respeta la posición de soltado.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Añadir `POST /api/tasks/queue-order`, `sortQueuedTasks`, indicador visual de inserción y refresco de turnos en DOM.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL:BEGIN -->
Commit `71f19d1`. Pruebas 14/14 incluyen `sortQueuedTasks` y endpoint `/api/tasks/queue-order`.
<!-- SECTION:FINAL:END -->
