---
id: AH-E-41
title: 'HUB · Sync ledger y Backlog checkpoint'
status: 'Done'
assignee: []
created_date: '2026-08-09 19:05'
updated_date: '2026-08-09 19:50'
labels:
  - 'e2e-program'
  - 'fase-1'
  - 'hub'
dependencies:
  - 'AH-E-38'
priority: 'medium'
type: 'enhancement'
ordinal: 30
actual_start: '2026-08-09'
actual_finish: '2026-08-09'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CLI/UI checkpoint: alinear ledger docs/plans con estado Backlog. El audit ya falla si el plan cita IDs de backlog abiertos sin tarjeta Kanban (`LEDGER_WITHOUT_KANBAN`); este ítem añade checkpoint CLI/UI y actualización de next action.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Audit detecta drift ledger↔Kanban (semilla de checkpoint)
- [x] #2 Comando o botón checkpoint que actualiza next action/estado
- [x] #3 check_plan pasa tras checkpoint
<!-- AC:END -->

## Evidence

- 2026-08-10 00:50:51 · npm run ariadne:checkpoint + POST /api/checkpoint + Hub Checkpoint button; check_plan 0 errors; tests/ledger-checkpoint.test.js

## Closeout

- 2026-08-10 00:50:51 · structured close
- proof: npm run ariadne:checkpoint + POST /api/checkpoint + Hub Checkpoint button; check_plan 0 errors; tests/ledger-checkpoint.test.js
