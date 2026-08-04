---
id: AH-E-30
title: HUB · Pipeline ariadne sync post-edicion
status: Done
assignee: []
created_date: '2026-08-04 18:45'
updated_date: '2026-08-04 18:45'
priority: Medium
type: enhancement
ordinal: 1000
labels:
  - hub
  - automation
  - cloud
references:
  - docs/ariadne-automation.md
  - scripts/ariadne-sync.js
  - tests/cloud-dev-smoke.test.js
---

## Description

Automatizar validación post-edicion de ledgers para agentes cloud: un comando ejecuta audit-all, fix opcional de higiene y check_plan.py.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `npm run ariadne:sync` y `--fix` documentados y verdes
- [x] #2 smoke:cloud verifica scripts sync/launcher y exit 0
- [x] #3 Ledger ariadne-mejoras cerrado (ARIM-005)
<!-- AC:END -->

## Evidence

- scripts/ariadne-sync.js; tests/ariadne-sync.test.js
- cloud-dev-smoke ampliado; npm test 176/176
