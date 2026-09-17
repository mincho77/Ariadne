# Gantt progress and remaining work

The planner distinguishes **baseline estimate**, **declared progress**, **remaining IA hours**, and **checklist-derived suggestions**.

## Duration precedence (forecast)

1. `remaining_ia_hours` when present (including `0` for effectively complete work still open in Kanban)
2. Derived from declared `progress` against baseline estimate
3. Checklist completion ratio when no progress is declared (forecast only; not persisted)
4. Full baseline estimate (`estimate_ia_hours` or `estimate_days`)

Done tasks always report `progress: 100` and are excluded from pending scheduling.

## Plan JSON fields (`tasks[]`)

| Field | Description |
|-------|-------------|
| `baselineEstimateIaHours` | Original effort before progress/remaining |
| `remainingIaHours` | Effort left used for scheduling |
| `executedIaHours` | `baseline - remaining` |
| `progress` | Effective % (100 for Done) |
| `progressDeclared` | Frontmatter `progress` if set |
| `progressSuggestedFromChecklist` | Checklist ratio; informational |
| `remainingDeclared` | Frontmatter `remaining_ia_hours` if set |
| `durationSource` | `remaining_ia_hours` \| `progress` \| `checklist_suggestion` \| `estimate` |

## Kanban checklist API

`POST /api/tasks/checklist`

After toggling a checklist item, the response includes:

- `suggestedProgress` — completion % from all `- [ ]` items in the task body
- `progressApplied` — `true` only when `applySuggestedProgress: true` in the request body
- `remainingPreserved` — `true` when `remaining_ia_hours` exists (never auto-updated from checklist)

Example authorized progress sync:

```json
{
  "id": "AH-E-1",
  "index": 0,
  "checked": true,
  "applySuggestedProgress": true
}
```

`remaining_ia_hours` is only changed via `PATCH /api/projects/{slug}/tasks/{id}`.

## PATCH

Both `progress` (0–100) and `remaining_ia_hours` (≥ 0) are editable on **In Progress** tasks. Done transitions still set `progress: 100` via Kanban sync (AH-E-15).
