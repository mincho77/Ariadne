# Gantt temporal blocks

Tasks can be temporarily blocked while remaining in the backlog. The planner models block metadata, delays starts when an unblock date exists, and downgrades forecast confidence when it does not.

## Frontmatter fields

| Field | Type | Description |
|-------|------|-------------|
| `blocked` | boolean | Explicit block flag |
| `blocked_since` | YYYY-MM-DD | When the block started |
| `blocked_reason` | text | Why work is paused |
| `blocked_by` | text | Person/system owning the block |
| `expected_unblock_date` | YYYY-MM-DD | Earliest date work may resume |
| `blocked_until` | YYYY-MM-DD | Legacy alias of `expected_unblock_date` |

A task is also treated as blocked when Kanban status is **Blocked**.

## Planner behaviour

| Situation | Start constraint | `forecastConfidence` |
|-----------|------------------|----------------------|
| Not blocked | Normal | `high` |
| Blocked + expected date | Cannot start before unblock date (working calendar) | `medium` |
| Blocked without date | No date constraint; schedule is indicative | `low` |

Diagnostics use cause `block` with codes `blocked_until` or `blocked_open`.

## Plan JSON

Each scheduled task may include:

- `isBlocked`, `blockedSince`, `blockedReason`, `blockedBy`, `expectedUnblock`
- `forecastConfidence`: `high` \| `medium` \| `low`

`summary` adds:

- `blockedTasks` — pending tasks currently blocked
- `lowConfidenceForecasts` — scheduled tasks with `forecastConfidence: low`

## PATCH

All block fields are editable via `PATCH /api/projects/{slug}/tasks/{id}` (snake_case or camelCase aliases).

```json
{
  "blocked": true,
  "blocked_since": "2026-08-04",
  "blocked_by": "legal",
  "blocked_reason": "Contract review",
  "expected_unblock_date": "2026-08-20"
}
```

Clear a field with `null`.
