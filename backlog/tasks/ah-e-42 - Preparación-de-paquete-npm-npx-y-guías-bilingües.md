---
id: AH-E-42
title: Preparación de paquete npm/npx y guías bilingües
status: In Progress
assignee: []
created_date: '2026-11-09T18:17:00Z'
updated_date: '2026-11-09T18:47:00Z'
labels:
  - ariadne
  - install
  - onboarding
dependencies:
  - AH-E-39
  - AH-E-40
priority: high
type: enhancement
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Prepare the public package manifest and executable entry point for , define the packed file set and prepublish checks, and replace the sparse Spanish-only quickstart with concise English and Spanish installation guides. Do not publish to npm as part of this task.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 and documented setup commands work after a future npm publish; package remains unpublished during this task.
- [ ] #2 contains all runtime assets and excludes tests, local catalog, secrets, and workspace-only data.
- [ ] #3 English and Spanish quickstarts cover requirements, setup, registering an existing project, start/stop, autostart, doctor, and troubleshooting.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Paquete y guías listos; package:check pasa. Nombre npm ariadne-hub sin verificar porque la consulta al registro agotó el tiempo; publicación npm permanece diferida.
<!-- SECTION:NOTES:END -->
