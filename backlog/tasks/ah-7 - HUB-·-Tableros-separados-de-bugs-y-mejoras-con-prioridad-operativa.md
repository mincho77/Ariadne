---
id: AH-7
title: HUB · Tableros separados de bugs y mejoras con prioridad operativa
status: Done
assignee: []
created_date: '2026-07-29 10:05'
updated_date: '2026-07-29 10:05'
labels:
  - ariadne
  - hub
  - bugs
  - mejoras
dependencies:
  - AH-6
references:
  - docs/plans/ariadne-local.md
  - bugs-board.js
  - mejoras-board.js
priority: high
type: feature
ordinal: 60
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Separar el trabajo operativo en dos tableros Kanban independientes por proyecto: bugs y mejoras. El Hub y la lógica de "siguiente tarea" deben priorizar siempre bugs sobre mejoras, sin mezclar ambos flujos en una sola vista principal.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Vista `?view=bugs` filtra solo bugs (type/label/título)
- [x] #2 Vista `?view=mejoras` filtra todo lo que no es bug
- [x] #3 Hub muestra botones separados "Ver bugs" y "Ver mejoras"
- [x] #4 "Siguiente" en Hub elige bug abierto antes que mejora
- [x] #5 Cola completa sigue disponible como vista auxiliar
<!-- AC:END -->
