---
id: AH-E-11
title: GANTT · Parser YAML confiable con ida y vuelta
status: To Do
assignee: []
created_date: '2026-08-04 17:10'
updated_date: '2026-08-04 17:10'
labels:
  - gantt
  - fase-1
  - parser
priority: Ultra High
type: enhancement
ordinal: 1000
estimate_days: 5
dependencies:
  - AH-E-9
epic: 'Gantt integrado'
references:
  - docs/plans/ariadne-gantt.md
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Reemplazar parseo regex de frontmatter por parser YAML confiable con round-trip sin perder cuerpo Markdown ni campos desconocidos.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Leer/modificar/guardar tarea preserva contenido
- [ ] #2 Compatibilidad con archivos existentes verificada
- [ ] #3 Pruebas de ida y vuelta incluidas
<!-- AC:END -->
