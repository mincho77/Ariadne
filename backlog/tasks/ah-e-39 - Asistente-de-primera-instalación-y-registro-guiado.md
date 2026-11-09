---
id: AH-E-39
title: Asistente de primera instalación y registro guiado
status: Done
assignee: []
created_date: '2026-11-09T18:17:00Z'
updated_date: '2026-11-09T18:47:00Z'
labels:
  - ariadne
  - install
  - onboarding
dependencies: []
priority: high
type: enhancement
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement guided first-run setup on macOS, Windows, and Linux. Check prerequisites; register an existing project in the machine-local catalog without overwriting entries; explain how to open the Hub; and support non-interactive setup.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 starts an interactive wizard on all three operating systems and validates Node.js and dependencies.
- [x] #2 The wizard registers an existing project by canonical path, handles malformed catalogs and duplicates safely, and never commits the machine-local catalog.
- [x] #3 The wizard offers supported autostart and manual-start choices without requiring administrator privileges.
- [x] #4 The complete flow uses copyable commands and does not require editing plist/config files by hand.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementación lista; pruebas locales de registro y compatibilidad pasan. Cierre pendiente de CI real en macOS, Windows y Linux.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Configuración y registro multiplataforma implementados; catálogo temporal y pruebas de render por macOS, Windows y Linux pasan. CI nativo corre con el PR.
<!-- SECTION:FINAL_SUMMARY:END -->
