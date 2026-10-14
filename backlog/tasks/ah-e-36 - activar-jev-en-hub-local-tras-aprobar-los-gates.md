---
id: AH-E-36
title: Desplegar soporte JEV opcional en Hub local
status: Done
assignee: []
created_date: '2026-10-03 08:52'
updated_date: '2026-10-03 15:03'
labels:
  - jev
  - local-deploy
dependencies:
  - 'AH-E-35:FS'
modified_files:
  - server.js
  - lib/jev.js
  - skills/ariadne/SKILL.md
  - docs/jev-opcional.md
priority: medium
type: enhancement
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Publicar el backend JEV y el flujo conversacional en el Hub local después de completar los gates, manteniendo JEV apagado hasta que el usuario configure opt-in y su propia clave.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Los gates de implementación, integración y verificación están cerrados.
- [x] #2 El LaunchAgent ejecuta el checkout actualizado y GET /api/jev/status responde 200 con enabled=false y configured=false si no hay opt-in/clave.
- [x] #3 POST /api/projects/ariadne/jev/dafo devuelve provider_disabled y no llama al proveedor cuando JEV está apagado.
- [x] #4 La clave no se almacena en Git/LaunchAgent; cada persona puede habilitarlo con ARIADNE_JEV_ENABLED=true y TYPESAFE_API_KEY.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-10-03 15:03
---
Desplegado 2026-10-03 en /Users/mauriciootalvaro/Code/Ariadne. LaunchAgent reiniciado con kickstart; GET status 200 enabled=false/configured=false y POST devuelve provider_disabled. Sin clave ni llamada externa.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Soporte JEV opcional desplegado en Hub local, sin opt-in ni llamadas externas por defecto.
<!-- SECTION:FINAL_SUMMARY:END -->
