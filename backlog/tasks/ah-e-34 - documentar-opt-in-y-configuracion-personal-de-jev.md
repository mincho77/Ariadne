---
id: AH-E-34
title: Documentar opt-in y configuración personal de JEV
status: Done
assignee: []
created_date: '2026-10-03 08:52'
updated_date: '2026-10-03 09:20'
dependencies:
  - AH-E-31:FS
labels:
  - jev
  - docs
priority: Medium
type: enhancement
ordinal: 1000
---

## Description

Documentar cómo habilitar/deshabilitar JEV al usar Ariadne desde GitHub sin credenciales compartidas. Evidencia: `docs/jev-opcional.md` y referencia en `README.md`.

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La documentación indica que JEV está apagado por defecto.
- [x] #2 Se documentan ARIADNE_JEV_ENABLED y TYPESAFE_API_KEY sin publicar valores secretos.
- [x] #3 Se explica que cada instalación usa su propia clave y que el contexto autorizado sale a TypeSafe.
- [x] #4 La instalación y la auditoría funcionan sin configurar JEV.
<!-- AC:END -->
