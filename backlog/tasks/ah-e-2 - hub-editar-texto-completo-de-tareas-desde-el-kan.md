---
id: AH-E-2
title: HUB · Editar texto completo de tareas desde el Kanban
status: Done
assignee: []
created_date: '2026-07-29 07:00'
updated_date: '2026-07-29 09:45'
labels:
  - ariadne
  - hub
  - kanban
dependencies:
  - AH-E-1
references:
  - docs/plans/ariadne-local.md
priority: high
type: feature
ordinal: 20
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Permitir modificar el Markdown completo de una tarea desde el modal del tablero, conservando el frontmatter YAML y validando que no cambie el `id`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 El detalle muestra botón **Editar texto** con textarea del Markdown fuente.
- [x] #2 **Guardar cambios** persiste en `backlog/` y actualiza `updated_date`.
- [x] #3 La API rechaza contenido sin frontmatter o con `id` distinto.
- [x] #4 Existen pruebas automatizadas del flujo.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Añadir `POST /api/tasks/content`, validadores y UI de edición en `queueBoardPage`.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL:BEGIN -->
Commit `657782e`. Pruebas 13/13 incluyen `updateTaskSource` y controles de edición en HTML.
<!-- SECTION:FINAL:END -->
