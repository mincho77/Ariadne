---
id: AM-1
title: Ariadne · Modo liviano y enrutamiento de modelo barato
status: To Do
assignee: []
created_date: '2026-07-28 00:00'
updated_date: '2026-07-28 00:00'
labels:
  - ariadne
  - cost-control
dependencies: []
references:
  - ../../../docs/plans/ariadne-mejoras.md
priority: low
type: enhancement
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Definir y, si aplica, implementar un flujo liviano para tareas simples de Ariadne, orientado a registrar, mover, priorizar y actualizar trabajo con menor consumo de tokens.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Existe regla documentada para decidir cuando Ariadne puede usar modo liviano.
- [ ] #2 Se decide entre `ariadne-lite`, ajuste del skill actual o wrapper externo.
- [ ] #3 El wrapper, si se implementa, enruta Ariadne a modelo barato y mantiene auditorias/despliegues en modelo fuerte.
- [ ] #4 Los ledgers siguen validando con `check_plan.py`.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Revisar el entorno real de invocacion de Codex, definir los triggers del modo liviano y validar una actualizacion simple de Ariadne sin ampliar contexto tecnico.
<!-- SECTION:PLAN:END -->
