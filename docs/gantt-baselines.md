# Gantt baselines — immutable schedule snapshots

Baselines capture a point-in-time forecast from the Gantt planner and store it under the project backlog for later comparison.

## Storage

```
backlog/docs/gantt/baselines/{id}.json
```

Each file is written once and never overwritten. A duplicate `id` returns HTTP 409.

## JSON schema

| Field | Description |
|-------|-------------|
| `id` | Stable id (`bl-YYYYMMDD-name-hex`) |
| `name` | Human label chosen at creation |
| `author` | Creator (defaults to `unknown`) |
| `createdAt` | ISO timestamp |
| `project` | `{ slug, name }` |
| `parameters` | Planner options used when snapshot was taken |
| `summary` | Aggregate metrics copied from the plan |
| `tasks[]` | Per-task snapshot: `id`, `title`, `status`, `lane`, `startDate`, `endDate`, `startIaHour`, `endIaHour`, `durationIaHours` |

## API

### List baselines

`GET /api/projects/{slug}/gantt/baselines`

Response: `{ project, baselines: [{ id, name, author, createdAt, taskCount, summary }] }`

### Create baseline

`POST /api/projects/{slug}/gantt/baselines`

Body:

```json
{
  "name": "Sprint 1 freeze",
  "author": "mincho",
  "id": "bl-20260804-sprint-1-deadbeef",
  "ganttOptions": { "startDate": "2026-08-04", "capacity": 2 }
}
```

- `name` is required.
- `id` is optional; generated when omitted.
- Query string Gantt params (`capacity`, `startDate`, …) apply unless overridden in `ganttOptions`.

Response: HTTP 201 `{ project, baseline }`. Duplicate id → HTTP 409.

### Read baseline

`GET /api/projects/{slug}/gantt/baselines/{id}`

Response: `{ project, baseline }`. Missing id → HTTP 404.

### Compare to current forecast

`GET /api/projects/{slug}/gantt/baselines/{id}/compare`

Uses the same Gantt query params as `GET …/gantt` to build the live forecast.

Response highlights:

- `summary.addedTasks`, `removedTasks`, `slippedTasks`, `pulledForwardTasks`, `unchangedTasks`
- `summary.maxEndSlipDays`, `pendingDaysDelta`
- `tasks[]` with `baseline`, `forecast`, `delta`, `change` (`added|removed|slipped|pulled_forward|unchanged`)

## Immutability

Baselines are append-only artifacts in version control. The Hub API rejects writes when the target file already exists; there is no PATCH or DELETE endpoint.
