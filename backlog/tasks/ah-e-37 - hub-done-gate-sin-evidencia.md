---
id: AH-E-37
title: 'HUB · Done gate sin evidencia'
status: 'Done'
assignee: []
created_date: '2026-08-09 18:20'
updated_date: '2026-08-09 18:22'
labels:
  - 'hub'
  - 'e2e-program'
  - 'fase-1'
dependencies:
  - 'AH-E-36'
priority: 'high'
type: 'enhancement'
ordinal: 10
actual_start: '2026-08-09'
actual_finish: '2026-08-09'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Bloquear o advertir al marcar Done desde Kanban/API si la tarea no tiene sección Evidence / Closeout.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 API status→Done rechaza o exige evidencia
- [x] #2 UI Kanban avisa si falta evidencia
- [x] #3 Tests del gate
<!-- AC:END -->

## Evidence

- 2026-08-09 23:22:05 · done-gate.js + 409 MISSING_EVIDENCE; UI assertClientDoneEvidence; done-gate.test.js + lifecycle 409→evidence→Done

## Closeout

- 2026-08-09 23:22:05 · structured close
- proof: done-gate.js + 409 MISSING_EVIDENCE; UI assertClientDoneEvidence; done-gate.test.js + lifecycle 409→evidence→Done
