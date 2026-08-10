---
id: AH-E-42
title: 'GANTT · Autorizar a Queue desde Gantt'
status: 'Done'
assignee: []
created_date: '2026-08-09 19:05'
updated_date: '2026-08-09 19:52'
labels:
  - 'e2e-program'
  - 'fase-1'
  - 'gantt'
dependencies:
  - 'AH-E-38'
priority: 'high'
type: 'enhancement'
ordinal: 40
actual_start: '2026-08-09'
actual_finish: '2026-08-09'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Desde Gantt/drawer: mover a Queue con ordinal sin saltar solo a Kanban.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Acción Queue desde Gantt
- [x] #2 Persiste status+ordinal
- [x] #3 Tests
<!-- AC:END -->

## Evidence

- 2026-08-10 00:52:53 · POST /api/projects/:slug/tasks/:id/queue; status Queued + ordinal order; ui-contract taskQueueAuthorize; docs/gantt-ui-integration; tests/queue-authorize.test.js + gantt:smoke

## Closeout

- 2026-08-10 00:52:53 · structured close
- proof: POST /api/projects/:slug/tasks/:id/queue; status Queued + ordinal order; ui-contract taskQueueAuthorize; docs/gantt-ui-integration; tests/queue-authorize.test.js + gantt:smoke
