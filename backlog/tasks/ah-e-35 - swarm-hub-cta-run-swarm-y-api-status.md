---
id: AH-E-35
title: 'SWARM · Hub CTA Run swarm y API status'
status: 'Done'
assignee: []
created_date: '2026-08-09 17:15'
updated_date: '2026-08-09 12:00'
labels:
  - 'swarm'
  - 'e2e-program'
  - 'fase-0'
dependencies:
  - 'AH-E-34'
priority: 'high'
type: 'enhancement'
ordinal: 10
actual_start: '2026-08-09'
actual_finish: '2026-08-09'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
CTA en Hub para ver status del swarm y disparar run (cola) vía API delgada GET/POST /api/swarm/*.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 GET /api/projects/:slug/swarm/status
- [x] #2 POST /api/projects/:slug/swarm/run
- [x] #3 CTA visible en Hub (proyecto)
<!-- AC:END -->

## Evidence

- 2026-08-09 17:00:45 · GET/POST /api/projects/:slug/swarm/status|run + Hub CTA buttons · AH-E-35

## Closeout

- 2026-08-09 17:00:45 · structured close
- proof: GET/POST /api/projects/:slug/swarm/status|run + Hub CTA buttons
- notes: AH-E-35
- command: node -e require server+swarm
