---
id: AH-E-10
title: GANTT · Contrato y escenarios de prueba del planificador
status: Done
assignee: []
created_date: '2026-08-04 17:10'
updated_date: '2026-08-04 17:20'
labels:
  - gantt
  - fase-0
  - tests
priority: Ultra High
type: enhancement
ordinal: 1000
estimate_days: 3
dependencies:
  - AH-E-9
epic: 'Gantt integrado'
references:
  - docs/plans/ariadne-gantt.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Definir contrato JSON estable del planificador y fixtures reproducibles para FS/SS/FF/SF, lags, ciclos, capacidad, queue ordinal, festivos CO y tareas bloqueadas.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Fixtures versionados bajo tests/fixtures/gantt/
- [x] #2 Escenarios documentados en docs/GANTT.md
- [x] #3 Pruebas fallan antes de cambios y pasan con motor actual donde aplique
<!-- AC:END -->
