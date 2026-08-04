---
id: AH-E-22
title: GANTT · Fases, entregables e hitos
status: Done
assignee: []
created_date: '2026-08-04 17:10'
updated_date: '2026-08-04 21:30'
labels:
  - gantt
  - fase-3
  - hitos
priority: High
type: enhancement
ordinal: 1000
estimate_days: 3
dependencies:
  - AH-E-11
  - AH-E-13
epic: 'Gantt integrado'
references:
  - docs/plans/ariadne-gantt.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Soportar parent_id, release, workstream, hitos duración cero; IDs B/E existentes intactos.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hitos visibles en API Gantt
- [x] #2 Jerarquía padre-hijo en JSON
<!-- AC:END -->
