---
id: AH-E-12
title: GANTT · Modularizar motor de programación
status: Done
assignee: []
created_date: '2026-08-04 17:10'
updated_date: '2026-08-04 17:20'
labels:
  - gantt
  - fase-1
  - motor
priority: High
type: enhancement
ordinal: 1000
estimate_days: 5
dependencies:
  - AH-E-9
  - AH-E-10
epic: 'Gantt integrado'
references:
  - docs/plans/ariadne-gantt.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extraer de server.js módulos: esquema, grafo, calendarios, restricciones, capacidad, ruta crítica, diagnósticos, baselines.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Módulos en lib/gantt/ o equivalente
- [x] #2 server.js delega sin cambiar comportamiento
- [x] #3 Regresión npm test verde
<!-- AC:END -->
