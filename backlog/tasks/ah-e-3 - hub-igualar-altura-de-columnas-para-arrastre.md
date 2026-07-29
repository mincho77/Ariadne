---
id: AH-E-3
title: HUB · Igualar altura de columnas para arrastre
status: Done
assignee: []
created_date: '2026-07-29 07:00'
updated_date: '2026-07-29 09:45'
labels:
  - ariadne
  - hub
  - kanban
dependencies:
  - AH-E-1
references:
  - docs/plans/ariadne-local.md
priority: medium
type: enhancement
ordinal: 30
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hacer que todas las columnas del Kanban tengan la misma altura para poder soltar tarjetas al fondo de una columna corta sin volver arriba.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 El grid usa `align-items: stretch` y cada columna es flex vertical.
- [x] #2 `task-list` crece hasta el fondo de la columna más alta.
- [x] #3 La zona vacía inferior acepta drop de arrastre.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Ajustar CSS de `.board`, `.column` y `.task-list` en `queueBoardPage`.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL:BEGIN -->
Incluido en commit `657782e`. Prueba `queue board stretches columns for full-height drag targets`.
<!-- SECTION:FINAL:END -->
