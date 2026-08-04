---
id: AH-E-13
title: GANTT · Modelo temporal de tareas y precedencia
status: To Do
assignee: []
created_date: '2026-08-04 17:10'
updated_date: '2026-08-04 17:10'
labels:
  - gantt
  - fase-1
  - modelo
priority: Ultra High
type: enhancement
ordinal: 1000
estimate_days: 4
dependencies:
  - AH-E-11
  - AH-E-12
epic: 'Gantt integrado'
references:
  - docs/plans/ariadne-gantt.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Incorporar campos temporales (planned/actual/target/deadline/not_before/fixed/progress/remaining/blocked) con precedencia documentada.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Precedencia y migración documentadas
- [ ] #2 Compatibilidad con estimate_days, due_date, started_date
- [ ] #3 Pronóstico calculado, no persistido como verdad manual
<!-- AC:END -->
