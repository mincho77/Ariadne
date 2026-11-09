---
id: AH-E-40
title: Comando doctor y diagnóstico accionable
status: Done
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
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add  checks for runtime version, dependency installation, local catalog validity, registered project paths, port availability, and optional Hub health. Return actionable fixes and stable exit codes. Exclude secret values and never rewrite user files.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 detects missing dependencies, invalid/missing catalog, stale project paths, occupied ports, and Hub availability without leaking secrets.
- [x] #2 Each failure includes a concrete repair step and non-zero exit code; healthy checks exit zero.
- [x] #3 Doctor behavior is covered by automated tests using temporary directories and ports.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Comando doctor implementado con diagnósticos accionables y manejo explícito de puertos no comprobables; verificado con catálogo temporal.
<!-- SECTION:FINAL_SUMMARY:END -->
