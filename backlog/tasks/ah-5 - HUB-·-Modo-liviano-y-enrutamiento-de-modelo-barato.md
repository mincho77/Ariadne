---
id: AH-5
title: HUB · Modo liviano y enrutamiento de modelo barato
status: To Do
assignee: []
created_date: '2026-07-28 00:00'
updated_date: '2026-07-29 09:45'
labels:
  - ariadne
  - cost-control
dependencies: []
references:
  - docs/plans/ariadne-mejoras.md
  - projects/ariadne-mejoras/backlog/tasks/am-1 - Ariadne-·-Modo-liviano-y-enrutamiento-de-modelo-barato.md
priority: low
type: enhancement
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Definir y, si aplica, implementar un flujo liviano para tareas simples de Ariadne orientado a registrar, mover, priorizar y actualizar trabajo con menor consumo de tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Existe regla documentada para decidir cuándo Ariadne puede usar modo liviano.
- [ ] #2 Se decide entre `ariadne-lite`, ajuste del skill actual o wrapper externo.
- [ ] #3 El wrapper, si se implementa, enruta Ariadne a modelo barato y mantiene auditorías/despliegues en modelo fuerte.
- [ ] #4 Los ledgers siguen validando con `check_plan.py`.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Revisar el entorno real de invocación, definir triggers del modo liviano y validar una actualización simple sin ampliar contexto técnico.
<!-- SECTION:PLAN:END -->
