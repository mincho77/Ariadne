---
id: AH-E-36
title: 'HUB · Command center Hoy'
status: 'Done'
assignee: []
created_date: '2026-08-09 18:05'
updated_date: '2026-08-09 18:16'
labels:
  - 'hub'
  - 'e2e-program'
  - 'fase-1'
dependencies:
  - 'AH-E-35'
priority: 'ultra high'
type: 'enhancement'
ordinal: 10
actual_start: '2026-08-09'
actual_finish: '2026-08-09'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Vista Hoy en el Hub: Doing, cabeza de Queue, bloqueos FS, CTA Run swarm. API GET /api/hoy.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/hoy (opcional ?project=) con doing/queue/blocked/swarm
- [x] #2 UI Hoy en Hub (sección o /hoy.html)
- [x] #3 CTA Run swarm desde Hoy
<!-- AC:END -->

## Evidence

- 2026-08-09 23:16:12 · hub-hoy.test.js + GET /api/hoy + Hub Hoy panel CTA · AH-E-36

## Closeout

- 2026-08-09 23:16:12 · structured close
- proof: hub-hoy.test.js + GET /api/hoy + Hub Hoy panel CTA
- notes: AH-E-36
- command: node --test hub-hoy.test.js
