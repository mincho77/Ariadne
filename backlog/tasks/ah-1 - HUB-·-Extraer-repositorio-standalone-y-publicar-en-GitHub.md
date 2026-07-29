---
id: AH-1
title: HUB · Extraer repositorio standalone y publicar en GitHub
status: Done
assignee: []
created_date: '2026-07-28 15:00'
updated_date: '2026-07-29 09:45'
labels:
  - ariadne
  - hub
dependencies: []
references:
  - docs/plans/ariadne-local.md
priority: high
type: feature
ordinal: 10
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Mover el Hub, skill, planes y proyecto interno fuera de JurisMate hacia `/Users/mauriciootalvaro/Code/Ariadne` y publicarlo en `mincho77/Ariadne`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Existe repo local con Hub, skill, `docs/plans` y `projects/ariadne-mejoras`.
- [x] #2 JurisMate sigue registrado en `projects.json` como proyecto externo.
- [x] #3 El Hub arranca en `127.0.0.1:4177` y el Kanban en `6421`.
- [x] #4 El repo está publicado en GitHub.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Copiar artefactos desde JurisMate, ajustar LaunchAgent, crear README y empujar a GitHub.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL:BEGIN -->
Commit `af2bdeb` en https://github.com/mincho77/Ariadne. Hub activo con `com.ariadne.hub.plist`.
<!-- SECTION:FINAL:END -->
