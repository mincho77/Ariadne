---
id: AH-E-32
title: Exponer evaluación JEV con contexto permitido
status: Done
assignee: []
created_date: '2026-10-03 08:52'
updated_date: '2026-10-03 15:03'
labels:
  - jev
  - api
  - privacy
dependencies:
  - 'AH-E-31:FS'
modified_files:
  - server.js
  - lib/jev.js
  - tests/cloud-dev-smoke.test.js
  - tests/jev.test.js
priority: high
type: enhancement
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Añadir ruta backend para evaluación DAFO que reciba solo el contexto de proyecto permitido y delegue en el cliente JEV. Evidencia parcial: `GET /api/jev/status`, `POST /api/projects/:slug/jev/dafo` en `server.js`; falta verificarla.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 La ruta limita tamaño y el cliente rechaza campos no permitidos antes de llamar al proveedor.
- [x] #2 El cuerpo no admite rutas arbitrarias ni archivos completos del repositorio.
- [x] #3 La respuesta separa las señales, probabilidades y confianza sin dictamen compuesto ni automático.
- [x] #4 Errores de proveedor no filtran la clave ni el contexto enviado.
- [x] #5 Solicitudes de navegador desde otro origen son rechazadas antes de procesar el cuerpo.
<!-- AC:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-10-03 15:03
---
Verificado 2026-10-03 en checkout local activo: smoke HTTP confirma JEV apagado y bloqueo de otro origen; tests/jev.test.js 6/6 cubre allowlist, redacción, contexto faltante, clave ausente, error de proveedor y timeout. Cuerpo limitado a 16 KB.
---
<!-- COMMENTS:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Endpoint JEV con allowlist, tamaño máximo, control de origen y errores seguros verificado.
<!-- SECTION:FINAL_SUMMARY:END -->
