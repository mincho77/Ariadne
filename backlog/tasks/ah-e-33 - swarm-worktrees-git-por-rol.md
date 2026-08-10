---
id: AH-E-33
title: 'SWARM · Worktrees git por rol'
status: 'Done'
assignee: []
created_date: '2026-08-09 17:00'
updated_date: '2026-08-09 11:56'
labels:
  - 'swarm'
  - 'e2e-program'
  - 'fase-0'
dependencies:
  - 'AH-E-32'
priority: 'high'
type: 'enhancement'
ordinal: 10
actual_start: '2026-08-09'
actual_finish: '2026-08-09'
progress: 100
---
## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Worktrees git por rol bajo `.worktrees/` (gitignore); handoff entre roles sin pisar el mismo tree.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `.worktrees/` en .gitignore
- [x] #2 CLI o helper crea worktree por rol
- [x] #3 Documentado en docs/swarm
<!-- AC:END -->

## Swarm handoffs

- 2026-08-09 16:56:21 · coder → qa · worktrees CLI + gitignore

## Evidence

- 2026-08-09 16:56:21 · swarm.test.js worktree ok; .worktrees/ gitignored · AH-E-33
