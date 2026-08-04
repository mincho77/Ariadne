---
id: AH-E-15
title: GANTT · Fechas reales automáticas desde Kanban
status: Done
assignee: []
created_date: '2026-08-04 17:10'
updated_date: '2026-08-04 18:30'
labels:
  - gantt
  - fase-2
  - kanban
priority: Ultra High
type: enhancement
ordinal: 1000
estimate_days: 3
dependencies:
  - AH-E-13
  - AH-E-14
epic: 'Gantt integrado'
references:
  - docs/plans/ariadne-gantt.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Registrar actual_start al entrar In Progress y actual_finish al Done; no destruir fechas al reabrir.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Reglas aplican por UI, CLI, runner y API
- [x] #2 Pruebas de transición de estado
- [x] #3 Reapertura no falsifica historial
<!-- AC:END -->
