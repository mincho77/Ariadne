---
id: AH-E-17
title: GANTT · Unificar Queue, prioridad y capacidad
status: Done
assignee: []
created_date: '2026-08-04 17:10'
updated_date: '2026-08-04 19:00'
labels:
  - gantt
  - fase-2
  - capacidad
priority: Ultra High
type: enhancement
ordinal: 1000
estimate_days: 4
dependencies:
  - AH-E-12
  - AH-E-13
epic: 'Gantt integrado'
references:
  - docs/plans/ariadne-gantt.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Unificar Doing/Queue/To Do con capacity.total/bugs/enhancements; proyección alineada al runner.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Doing consume capacidad primero
- [x] #2 Queue respeta ordinal
- [x] #3 Compatibilidad ai-capacity.config.json
<!-- AC:END -->
