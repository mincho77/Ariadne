# Dependency Relations: Migration and Operations Guide

## Scope
This guide covers rollout and day-to-day use of typed dependencies in Ariadne Gantt:
- FS (Finish to Start)
- SS (Start to Start)
- FF (Finish to Finish)
- SF (Start to Finish)
- Lag/lead with day and hour units

## Backward Compatibility
Legacy dependencies are still supported:
- Legacy format: `JM-E-10`
- Interpreted as: `JM-E-10:FS`
- Lag default: `0`

No migration is required for existing projects to keep running.

## Canonical Dependency Format
Use this canonical form in task frontmatter:
- `TASK_ID:RELATION`
- `TASK_ID:RELATION+Nd`
- `TASK_ID:RELATION-Nd`
- `TASK_ID:RELATION+Nh`
- `TASK_ID:RELATION-Nh`

Examples:
- `JM-E-14:FS`
- `JM-E-20:SS+1d`
- `JM-E-31:FF+8h`
- `JM-E-8:SF-1d`

## Relation Semantics
- FS: successor start must be after predecessor end plus lag.
- SS: successor start must be after predecessor start plus lag.
- FF: successor end must be after predecessor end plus lag.
- SF: successor end must be after predecessor start plus lag.

## UI Workflow
In task inspector:
1. Select predecessor task.
2. Select relation type (FS/SS/FF/SF).
3. Set lag value and unit (days or IA hours).
4. Save dependencies.

The backend endpoint `/api/projects/:slug/tasks/dependencies` persists these tokens in frontmatter.

## Operational Validation Checklist
Run before release:
1. Build frontend: `cd repoxai/frontend-angular && npm run build`
2. Run backend tests: `cd Ariadne && npm test`
3. Smoke Gantt API:
   - `GET /api/projects/:slug/gantt`
   - Confirm `dependencyEdges` includes `relation`, `fromAnchor`, `toAnchor`, `lagBusinessDays`, `lagIaHours`.
4. Spot-check one task with each relation type.

## Migration Strategy (Recommended)
For each project backlog:
1. Leave legacy dependencies untouched initially.
2. Convert only critical-path tasks first to typed tokens.
3. Introduce SS/FF/SF where real parallelism/finish constraints exist.
4. Keep lags explicit to avoid hidden schedule assumptions.

## Failure Modes and Mitigations
- Self-dependency: blocked by API validation.
- Duplicate dependencies: deduplicated on save.
- Missing predecessor ID: appears as unresolved dependency in summary.
- Over-constrained network: check `cycleDetected` and unresolved counters in Gantt summary.

## Evidence Mapping
Related plan tasks in `ariadne-mejoras`:
- AM-E-8 model
- AM-E-9 parser/normalization
- AM-E-10 scheduler constraints
- AM-E-11 anchor-based rendering
- AM-E-12 editor UX and persistence
- AM-E-13 QA/migration/docs
