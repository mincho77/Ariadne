---
id: AH-E-8
title: HUB · Cloud dev environment smoke test
status: Done
assignee: []
created_date: '2026-07-30 19:10'
updated_date: '2026-08-04 18:50'
priority: Medium
type: enhancement
ordinal: 1000
labels:
  - hub
  - cloud
  - smoke
references:
  - docs/cloud-dev-environment.md
  - docs/ariadne-automation.md
  - AGENTS.md
  - tests/cloud-dev-smoke.test.js
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Smoke automatizado para entornos cloud (Cursor Agent): npm install, Hub HTTP, APIs Gantt/portafolio, scripts npm (`ariadne:sync`, `launcher`, etc.) sin depender de UI :63447.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Test smoke:cloud verde en VM sin macOS LaunchAgents
- [x] #2 Documentación cloud-dev-environment + AGENTS.md
- [x] #3 smoke:cloud cubre ariadne:sync y ariadne:launcher (AH-E-30)
<!-- AC:END -->
