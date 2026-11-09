---
id: AH-E-41
title: 'Autoinicio sin privilegios para macOS, Windows y Linux'
status: In Progress
assignee: []
created_date: '2026-11-09T18:17:00Z'
updated_date: '2026-11-09T18:46:00Z'
labels:
  - ariadne
  - install
  - onboarding
dependencies:
  - AH-E-39
priority: high
type: enhancement
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide optional per-user auto-start installation and removal on macOS (LaunchAgent), Windows (current-user Startup folder or scheduled task), and Linux (systemd user unit when available). Keep manual start available and expose status/removal guidance.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Install and uninstall work without administrator privileges on macOS, Windows, and Linux where the native user service is available.
- [ ] #2 Generated startup definitions use absolute repository/Node paths, do not embed secrets, and can be inspected before installation.
- [ ] #3 Unsupported environments fail with a clear manual-start path; each supported platform has automated dry-run coverage.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementación lista; pruebas unitarias de render por SO pasan. Cierre pendiente de ejecución de CI en macOS, Windows y Linux.
<!-- SECTION:NOTES:END -->
