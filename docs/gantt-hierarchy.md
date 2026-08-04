# Gantt hierarchy, phases, and milestones

Work breakdown uses optional frontmatter grouping fields. Task IDs (`JM-E-*`, `AH-E-*`, …) are unchanged.

## Frontmatter

| Field | Description |
|-------|-------------|
| `parent_id` | Parent task id (phase/deliverable summary) |
| `release` | Release or train label |
| `workstream` | Stream/team grouping |
| `type: milestone` | Zero-duration marker (also `is_milestone: true`) |
| `type: phase` / `epic` | Summary node (`nodeKind: phase`) |
| `type: deliverable` | Deliverable summary (`nodeKind: deliverable`) |

## Planner behaviour

- **Milestones** schedule with `durationIaHours: 0`, `startDate === endDate`, and do not consume parallel capacity.
- **Hierarchy** is derived from `parent_id` links across all backlog tasks (pending + done when included).

## Plan JSON

Top-level additions:

| Field | Description |
|-------|-------------|
| `milestones[]` | Scheduled pending milestones (subset of `tasks[]`) |
| `hierarchy.roots[]` | Root node ids (no parent or orphan parent) |
| `hierarchy.nodes[id]` | `{ id, title, parentId, childrenIds, release, workstream, nodeKind, isMilestone, status, startDate, endDate }` |

Each `tasks[]` item also includes `parentId`, `release`, `workstream`, `nodeKind`, `isMilestone`.

`summary.milestoneCount`, `summary.hierarchyRoots`.

## PATCH

`parent_id`, `release`, and `workstream` are editable via task PATCH (camelCase aliases supported).
