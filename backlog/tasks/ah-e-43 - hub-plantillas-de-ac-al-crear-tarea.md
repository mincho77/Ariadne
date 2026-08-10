---
id: AH-E-43
title: 'HUB · Plantillas de AC al crear tarea'
status: 'Done'
assignee: []
created_date: '2026-08-09 19:05'
updated_date: '2026-08-10 04:33'
labels:
  - 'e2e-program'
  - 'fase-1'
  - 'hub'
dependencies:
  - 'AH-E-38'
priority: 'medium'
type: 'enhancement'
ordinal: 50
actual_start: '2026-08-10'
actual_finish: '2026-08-10'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Templates de acceptance criteria al crear bug/mejora.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Template selectable
- [x] #2 AC en frontmatter/body
- [x] #3 Docs
<!-- AC:END -->

## Evidence

- 2026-08-10 09:33:29 · lib/ac-templates.js + GET /api/tasks/ac-templates + board Plantilla AC prompt + create-task --template; node --test tests/ac-templates.test.js bugs-board.test.js mejoras-board.test.js → 12 pass; docs/ac-templates.md

## Closeout

- 2026-08-10 09:33:29 · structured close
- proof: lib/ac-templates.js + GET /api/tasks/ac-templates + board Plantilla AC prompt + create-task --template; node --test tests/ac-templates.test.js bugs-board.test.js mejoras-board.test.js → 12 pass; docs/ac-templates.md
