---
id: AH-E-30
title: Diseñar contrato y rúbrica de evaluación JEV
status: Done
assignee: []
created_date: '2026-10-03 08:52'
updated_date: '2026-10-03 09:12'
labels:
  - jev
  - dafo
priority: High
type: enhancement
ordinal: 1000
---

## Description

Definir preguntas tipadas, esquema de entrada/salida, límites de decisión y fallback de Ariadne para el MVP DAFO. Evidencia: contrato y preguntas versionadas en `lib/jev.js`.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Contrato JSON incluye solo preguntas atómicas y respuestas estructuradas.
- [x] #2 Rúbrica versionada separa señales JEV del dictamen explicable de Ariadne.
- [x] #3 Confianza se presenta como señal; contexto insuficiente bloquea la llamada y toda respuesta requiere revisión humana.
<!-- AC:END -->
