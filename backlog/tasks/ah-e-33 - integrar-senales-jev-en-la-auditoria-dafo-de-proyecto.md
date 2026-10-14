---
id: AH-E-33
title: Integrar señales JEV en la auditoría DAFO de proyecto
status: Done
assignee: []
created_date: '2026-10-03 08:52'
updated_date: '2026-10-03 15:03'
labels:
  - jev
  - dafo
dependencies:
  - 'AH-E-32:FS'
modified_files:
  - skills/ariadne/SKILL.md
  - /Users/mauriciootalvaro/.codex/skills/ariadne/SKILL.md
  - docs/jev-opcional.md
priority: high
type: enhancement
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Conectar la respuesta tipada al flujo DAFO de proyecto activo, conservando las preguntas aclaratorias y el control humano.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Cada señal aparece ligada a su dimensión y evidencia de entrada.
- [x] #2 Confianza baja o datos faltantes solicitan revisión/contexto y no recomiendan viable automáticamente.
- [x] #3 El dictamen final mantiene las cuatro categorías DAFO y explica reglas y razones.
- [x] #4 La ausencia o falla de JEV conserva el flujo DAFO base.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-10-03 15:03
---
Integrado en skills/ariadne/SKILL.md global y del repo activo: usa endpoint solo si está activo/configurado, pregunta por contexto faltante, presenta señales por dimensión junto a evidencia y conserva revisión humana/fallback.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ariadne audita puede usar las señales JEV desde la conversación, de forma optativa y sin dictamen automático.
<!-- SECTION:FINAL_SUMMARY:END -->
