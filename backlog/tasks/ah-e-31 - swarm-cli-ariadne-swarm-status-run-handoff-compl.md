---
id: AH-E-31
title: 'SWARM · CLI ariadne-swarm status run handoff complete'
status: Done
assignee: []
created_date: '2026-08-09 13:10'
updated_date: '2026-08-09 13:20'
labels:
  - swarm
  - e2e-program
  - fase-0
dependencies: []
priority: ultra high
type: enhancement
ordinal: 10
actual_start: '2026-08-09'
actual_finish: '2026-08-09'
progress: 100
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Módulo swarm/ + CLI que lee Queue, valida deps Done, marca Doing, registra handoff y complete con evidencia.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 CLI status/run/handoff/complete documentado y ejecutable
- [x] #2 Solo Queue con deps Done entra; Doing al run
- [x] #3 Tests unitarios del módulo
<!-- AC:END -->

## Swarm handoffs

- 2026-08-09 · coder → qa · módulo swarm + CLI + tests

## Evidence

- 2026-08-09 · npm run swarm + swarm.test.js · integrado sobre master (lib/dependency-gate)
