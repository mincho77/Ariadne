---
id: AH-E-5
title: HUB · Modo liviano y enrutamiento de modelo barato
status: Done
assignee: []
created_date: '2026-07-28 00:00'
updated_date: '2026-08-05 01:00'
labels:
  - ariadne
  - cost-control
dependencies: []
references:
  - docs/plans/ariadne-mejoras.md
  - docs/ariadne-lite.md
  - skills/ariadne-lite/SKILL.md
priority: low
type: enhancement
ordinal: 10
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Definir y, si aplica, implementar un flujo liviano para tareas simples de Ariadne orientado a registrar, mover, priorizar y actualizar trabajo con menor consumo de tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Existe regla documentada para decidir cuándo Ariadne puede usar modo liviano.
- [x] #2 Se decide entre `ariadne-lite`, ajuste del skill actual o wrapper externo.
- [x] #3 El wrapper, si se implementa, enruta Ariadne a modelo barato y mantiene auditorías/despliegues en modelo fuerte.
- [x] #4 Los ledgers siguen validando con `check_plan.py`.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Skill `ariadne-lite`, docs/ariadne-lite.md, hint CLI `scripts/ariadne-route-hint.js`. Wrapper que fuerza modelo queda en capa externa (Cursor/Codex).
<!-- SECTION:PLAN:END -->
