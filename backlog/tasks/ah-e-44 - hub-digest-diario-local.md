---
id: AH-E-44
title: 'HUB · Digest diario local'
status: 'Done'
assignee: []
created_date: '2026-08-09 19:05'
updated_date: '2026-08-10 04:34'
labels:
  - 'e2e-program'
  - 'fase-1'
  - 'hub'
dependencies:
  - 'AH-E-36'
priority: 'low'
type: 'enhancement'
ordinal: 10
actual_start: '2026-08-10'
actual_finish: '2026-08-10'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Archivo digest diario (Doing/Queue/riesgos) opcional.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Script genera digest
- [x] #2 Ruta documentada
- [x] #3 No requiere cloud
<!-- AC:END -->

## Evidence

- 2026-08-10 09:34:44 · lib/daily-digest.js + scripts/ariadne-digest.js; npm run ariadne:digest → .ariadne/digests/; docs/daily-digest.md; tests/daily-digest.test.js 2/2; local-only no cloud

## Closeout

- 2026-08-10 09:34:44 · structured close
- proof: lib/daily-digest.js + scripts/ariadne-digest.js; npm run ariadne:digest → .ariadne/digests/; docs/daily-digest.md; tests/daily-digest.test.js 2/2; local-only no cloud
