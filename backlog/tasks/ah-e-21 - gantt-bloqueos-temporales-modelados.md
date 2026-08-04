---
id: AH-E-21
title: GANTT · Bloqueos temporales modelados
status: Done
assignee: []
created_date: '2026-08-04 17:10'
updated_date: '2026-08-04 21:00'
labels:
  - gantt
  - fase-3
  - bloqueos
priority: High
type: enhancement
ordinal: 1000
estimate_days: 2
dependencies:
  - AH-E-13
  - AH-E-16
epic: 'Gantt integrado'
references:
  - docs/plans/ariadne-gantt.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Modelar blocked_since, blocked_reason, blocked_by, expected_unblock_date; pronóstico de baja confianza sin fecha.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Campos en frontmatter
- [x] #2 Motor marca confianza baja
- [x] #3 Pruebas de bloqueo temporal
<!-- AC:END -->
