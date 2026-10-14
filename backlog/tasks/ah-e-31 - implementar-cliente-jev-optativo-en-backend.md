---
id: AH-E-31
title: Implementar cliente JEV optativo en backend
status: Done
assignee: []
created_date: '2026-10-03 08:52'
updated_date: '2026-10-03 09:20'
dependencies:
  - AH-E-30:FS
labels:
  - jev
  - backend
priority: High
type: enhancement
ordinal: 1000
---

## Description

Crear cliente aislado para la API TypeSafe con flag de opt-in, clave de servidor, timeout y validación de respuestas. Evidencia: `lib/jev.js`.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 JEV permanece desactivado salvo ARIADNE_JEV_ENABLED=true.
- [x] #2 Sin flag no se requiere clave ni se realiza ninguna solicitud externa.
- [x] #3 Con flag sin TYPESAFE_API_KEY se devuelve un error de configuración claro sin revelar secretos.
- [x] #4 La llamada usa timeout y valida el contrato de respuesta antes de devolver datos.
<!-- AC:END -->
