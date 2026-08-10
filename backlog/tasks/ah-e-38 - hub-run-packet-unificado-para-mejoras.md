---
id: AH-E-38
title: 'HUB · Run packet unificado para mejoras'
status: 'Done'
assignee: []
created_date: '2026-08-09 18:25'
updated_date: '2026-08-09 18:23'
labels:
  - 'hub'
  - 'e2e-program'
  - 'fase-1'
dependencies:
  - 'AH-E-37'
priority: 'high'
type: 'enhancement'
ordinal: 10
actual_start: '2026-08-09'
actual_finish: '2026-08-09'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extender run packets (`.ariadne/`) a mejoras, no solo bugs: generar instrucción + JSON para una mejora Queued vía API/CLI, compatible con `ariadne-swarm`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Packet para mejora Queued
- [x] #2 CLI o API genera packet
- [x] #3 Compatible con swarm (instrucción / ruta compartida)
<!-- AC:END -->

## Evidence

- 2026-08-09 23:23:41 · GET/POST /api/queue/mejoras(+claim) + POST /api/queue/packet; .ariadne/mejoras-queue + run-packets/; npm run queue:packet; bug-queue+improvement-queue tests

## Closeout

- 2026-08-09 23:23:41 · structured close
- proof: GET/POST /api/queue/mejoras(+claim) + POST /api/queue/packet; .ariadne/mejoras-queue + run-packets/; npm run queue:packet; bug-queue+improvement-queue tests
