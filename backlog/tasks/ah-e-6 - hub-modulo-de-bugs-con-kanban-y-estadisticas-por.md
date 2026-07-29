---
id: AH-E-6
title: HUB · Módulo de bugs con Kanban y estadísticas por tema
status: Done
assignee: []
created_date: '2026-07-29 09:50'
updated_date: '2026-07-29 09:50'
labels:
  - ariadne
  - hub
  - bugs
  - analytics
dependencies:
  - AH-E-1
references:
  - docs/plans/ariadne-local.md
  - bugs-board.js
priority: high
type: feature
ordinal: 50
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vista dedicada de bugs por proyecto con Kanban filtrado, estadísticas por tema, barras comparativas y tabla de cierre para identificar dónde se concentran más errores.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cada proyecto del Hub expone botón **Ver bugs**.
- [x] #2 La vista `view=bugs` muestra solo bugs en columnas To Do / Queue / Doing / Done.
- [x] #3 Existen KPIs, barras por tema y tabla comparativa abierto vs resuelto.
- [x] #4 API `GET /api/bugs/stats` devuelve agregados por tema.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL:BEGIN -->
Módulo `bugs-board.js`; URL `/?project=<slug>&view=bugs`; pruebas en `bugs-board.test.js`.
<!-- SECTION:FINAL:END -->
