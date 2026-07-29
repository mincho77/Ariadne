---
id: AH-E-5
title: HUB · Modo liviano y enrutamiento de modelo barato
status: Queued
assignee: []
created_date: '2026-07-28 00:00'
updated_date: '2026-07-29 15:09'
labels:
  - ariadne
  - cost-control
dependencies: []
references:
  - docs/plans/ariadne-mejoras.md
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
- [ ] #1 Existe regla documentada para decidir cuándo Ariadne puede usar modo liviano.
- [ ] #2 Se decide entre `ariadne-lite`, ajuste del skill actual o wrapper externo.
- [ ] #3 El wrapper, si se implementa, enruta Ariadne a modelo barato y mantiene auditorías/despliegues en modelo fuerte.
- [ ] #4 Los ledgers siguen validando con `check_plan.py`.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Revisar el entorno real de invocación, definir triggers del modo liviano y validar una actualización simple sin ampliar contexto técnico.
<!-- SECTION:PLAN:END -->
