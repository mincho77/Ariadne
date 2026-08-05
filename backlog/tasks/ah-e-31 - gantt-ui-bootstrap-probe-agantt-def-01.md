---
id: AH-E-31
title: Gantt UI bootstrap probe AGANTT-DEF-01
status: Done
priority: Low
type: task
labels:
  - gantt
  - tooling
estimate_days: 0.25
dependencies:
  - AH-E-23
---

## Descripción

Script de diagnóstico para AGANTT-DEF-01: verificar repo frontend Git (`ARIADNE_GANTT_UI_REPO`), probe HTTP de la UI (`ARIADNE_GANTT_BASE_URL`) e imprimir pasos de arranque sin clonar.

## Criterios de aceptación

- [x] `npm run gantt:ui:bootstrap` sale 0 con reporte JSON (`--json`)
- [x] `lib/gantt/ui-probe.js` reutilizable desde smoke/tests
- [x] Smoke cloud incluye el CLI
- [x] Documentación en `docs/gantt-ui-integration.md` y AGENTS.md

## Evidencia

- `lib/gantt/ui-probe.js`, `scripts/gantt-ui-bootstrap.js`
- `tests/gantt-ui-probe.test.js`
- `npm test` verde
