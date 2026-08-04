# Gantt planner — API contract (v1)

Stable JSON shape returned by `GET /api/projects/{slug}/gantt`.

## Top-level

| Field | Type | Description |
|-------|------|-------------|
| `project` | `{ slug, name }` | Project metadata |
| `parameters` | object | Input options echoed |
| `summary` | object | Aggregate metrics |
| `criticalPath` | `{ route[], estimatedIaHours }` | Longest dependency chain by IA hours |
| `parallelGroups` | array | Tasks sharing the same `startIaHour` |
| `dependencyEdges` | array | Drawn edges with relation anchors |
| `tasks` | array | Scheduled pending tasks |
| `doneTimeline` | array | Optional completed tasks |
| `dayMarkers` / `monthMarkers` | array | Calendar grid |
| `generatedAt` | ISO string | Generation timestamp |

## `summary` (required keys)

- `totalTasks`, `doneTasks`, `pendingTasks`, `completionRate`
- `estimatedPendingIaHours`, `estimatedPendingDays`
- `blockedByDependencies`, `unresolvedDependencies`, `cycleDetected`
- `deadlineViolations`, `restrictionViolations`
- `blockedTasks`, `lowConfidenceForecasts`, `blockedWithoutUnblockDate`, `milestoneCount`, `hierarchyRoots`

## `tasks[]` item (scheduled)

Required: `id`, `title`, `status`, `startIaHour`, `endIaHour`, `startDate`, `endDate`, `lane`, `durationIaHours`.

Progress (AH-E-20): `baselineEstimateIaHours`, `remainingIaHours`, `executedIaHours`, `progress`, `durationSource`. See `docs/gantt-progress.md`.

Optional: `dependencyLinks`, `pendingDependencies`, `canRunInParallel`, `diagnostics[]`, `violations[]`, `scheduleDrivers[]`, `progressDeclared`, `progressSuggestedFromChecklist`, `remainingDeclared`.

## `dependencyEdges[]`

Required: `fromId`, `toId`, `relation` (FS|SS|FF|SF), `fromAnchor`, `toAnchor`, `lagIaHours`, `sequential`.

## Query parameters

| Param | Default | Notes |
|-------|---------|-------|
| `capacity` | 2 or ai-config | 1–12 parallel tasks |
| `capacityBugs` | from config | Max parallel in bugs lane |
| `capacityEnhancements` | from config | Max parallel in mejoras lane |
| `resourceAware` | 0 | 1 enables resource pool scheduling |
| `includeDone` | 1 | 0 excludes `doneTimeline` |
| `iaHoursPerDay` | 8 | IA hours per business day |
| `startDate` | today | YYYY-MM-DD |
| `workOnSaturday` | 0 | 1 enables Saturday work |
| `holidays` | — | CSV extra holidays |

## PATCH task (partial update)

`PATCH /api/projects/{slug}/tasks/{id}`

- Body: campos temporales y estimaciones (ver `docs/gantt-temporal-model.md`)
- Optimistic lock: header `If-Match: {sourceHash}` o `expectedUpdatedDate`
- Respuesta: tarea parseada + `sourceHash` + `changes[]`
- Conflictos: HTTP 409

## Scenario fixtures

Reproducible inputs live under `tests/fixtures/gantt/scenarios/*/`. Each folder contains:

- `scenario.json` — options + expectations
- `tasks/*.md` — backlog Markdown inputs

Run via `tests/gantt-scenarios.test.js`.

## Baselines

Immutable schedule snapshots live under `backlog/docs/gantt/baselines/`. See `docs/gantt-baselines.md`.

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/projects/{slug}/gantt/baselines` | List metadata |
| POST | `/api/projects/{slug}/gantt/baselines` | Create snapshot (`name` required); 409 if id exists |
| GET | `/api/projects/{slug}/gantt/baselines/{id}` | Full baseline JSON |
| GET | `/api/projects/{slug}/gantt/baselines/{id}/compare` | Delta vs current `GET …/gantt` forecast |

Compare accepts the same query parameters as the Gantt endpoint (`capacity`, `startDate`, `includeDone`, …).

## Temporal blocks (AH-E-21)

Blocked tasks expose `forecastConfidence` and block metadata on `tasks[]`. See `docs/gantt-blocks.md`.

## Hierarchy and milestones (AH-E-22)

`milestones[]` and `hierarchy` document parent-child structure. See `docs/gantt-hierarchy.md`.

## External UI integration (AH-E-23)

The editable Gantt diagram runs in a separate frontend (`localhost:63447` by default). Hub discovery: `GET /api/hub-config` (`ganttUi`, `ganttLaunchExample`) and `GET /api/gantt-ui-contract`. See `docs/gantt-ui-integration.md`. Smoke: `npm run gantt:smoke`.

## Hub tracking metrics (AH-E-24)

`GET /api/projects` includes `ganttMetrics` per project; dedicated endpoint `GET /api/projects/{slug}/gantt/metrics`. See `docs/gantt-hub-metrics.md`.

## Resources (AH-E-25)

Optional `resourceAware=1` query param. Task fields `assignee`, `required_skills`, `resource_type`; config `backlog/docs/gantt/resources.config.json`. See `docs/gantt-resources.md`.

## Slack and conditioned critical path (AH-E-26)

Plan includes `slack.logicalCriticalPath`, `slack.resourceCriticalPath`, and per-task slack fields. See `docs/gantt-slack.md`.

## What-if scenarios (AH-E-27)

`POST /api/projects/{slug}/gantt/what-if` simulates overrides and task patches without persisting unless `confirmAdopt` + `confirmToken: ADOPT`. See `docs/gantt-what-if.md`.
