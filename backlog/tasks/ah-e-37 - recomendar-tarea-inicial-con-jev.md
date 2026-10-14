---
id: AH-E-37
title: Evaluar opciones de inicio de desarrollo con señales JEV
status: Done
assignee: []
created_date: '2026-10-05 19:01'
updated_date: '2026-10-05 19:21'
labels:
  - ariadne
  - hub
  - jev
dependencies: []
priority: medium
type: enhancement
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Permitir que la persona pida a Ariadne recomendar con qué tarea del backlog iniciar. El análisis conversacional compara opciones acotadas del proyecto activo y, si JEV está habilitado, obtiene señales estructuradas por opción. La respuesta explica evidencia, impacto, dependencias, esfuerzo y riesgos; no cambia el estado ni encola tareas sin autorización.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La solicitud natural puede analizar el backlog del proyecto activo y acotar la comparación a un máximo predeterminado de cinco candidatas.
- [x] #2 Cada candidata se evalúa con criterios versionados y equivalentes; contexto insuficiente se pregunta antes de llamar a JEV.
- [x] #3 La recomendación combina las señales JEV con evidencia del backlog, dependencias y análisis conversacional; no presenta la señal como decisión objetiva.
- [x] #4 La salida muestra orden sugerido, razones, incertidumbre y próximo paso verificable para cada opción.
- [x] #5 Ariadne no modifica estados ni encola una tarea hasta que el usuario lo autorice explícitamente; sin JEV activo, ofrece la comparación conversacional base.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implementado en el Hub/backend local de esta copia con endpoint POST /api/projects/:slug/jev/start-task, rúbrica task-start-v1 versionada, máximo 5 candidatas abiertas y filtro de dependencias bloqueantes. Solo envía metadatos permitidos; devuelve señales y choice/confianza/probabilidades más uso/latencia opcionales. Contexto insuficiente evita la llamada; modo desactivado conserva flujo sin JEV. La guía Ariadne compara señales con evidencia y deja la elección al usuario sin mutar estados. Verificado: pruebas JEV 9/9, smoke cloud 3/3, lifecycle 2/2, npm test 234/234, sync/audit y check_plan correctos. Pendiente desplegar al Hub instalado; no desplegado.
<!-- SECTION:FINAL_SUMMARY:END -->
