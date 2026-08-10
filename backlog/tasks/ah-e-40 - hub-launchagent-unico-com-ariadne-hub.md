---
id: AH-E-40
title: 'HUB · LaunchAgent único com.ariadne.hub'
status: 'Done'
assignee: []
created_date: '2026-08-09 19:05'
updated_date: '2026-08-09 19:49'
labels:
  - 'e2e-program'
  - 'fase-1'
  - 'hub'
dependencies:
  - 'AH-E-38'
priority: 'high'
type: 'enhancement'
ordinal: 10
actual_start: '2026-08-09'
actual_finish: '2026-08-09'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Eliminar conflicto con hub JurisMate; un solo LaunchAgent documentado.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Solo com.ariadne.hub activo
- [x] #2 Docs de bootout del viejo
- [x] #3 Hub sirve Gantt
<!-- AC:END -->

## Evidence

- 2026-08-10 00:49:32 · npm run hub:launchagent; bootout+rm com.jurismate.ariadne-hub; com.ariadne.hub running pid via launchctl; /api/gantt/portfolio + /portfolio.html 200; docs/launchagent-hub.md; tests/launchagent-hub.test.js

## Closeout

- 2026-08-10 00:49:32 · structured close
- proof: npm run hub:launchagent; bootout+rm com.jurismate.ariadne-hub; com.ariadne.hub running pid via launchctl; /api/gantt/portfolio + /portfolio.html 200; docs/launchagent-hub.md; tests/launchagent-hub.test.js
