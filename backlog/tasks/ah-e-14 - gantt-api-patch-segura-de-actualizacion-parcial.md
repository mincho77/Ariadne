---
id: AH-E-14
title: GANTT · API PATCH segura de actualización parcial
status: To Do
assignee: []
created_date: '2026-08-04 17:10'
updated_date: '2026-08-04 17:10'
labels:
  - gantt
  - fase-1
  - api
priority: Ultra High
type: enhancement
ordinal: 1000
estimate_days: 4
dependencies:
  - AH-E-11
epic: 'Gantt integrado'
references:
  - docs/plans/ariadne-gantt.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implementar PATCH /api/projects/{slug}/tasks/{id} con validación, escritura atómica, hash/updated_date y errores explicativos.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Actualizaciones parciales funcionan
- [ ] #2 Markdown y campos desconocidos preservados
- [ ] #3 Pruebas HTTP de conflicto y validación
<!-- AC:END -->
