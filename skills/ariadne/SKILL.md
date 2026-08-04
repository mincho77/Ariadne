---
name: ariadne
description: Maintain durable, auditable execution plans so requirements, discoveries, dependencies, decisions, deferred work, and verification never get lost across long or deep work. Use when the user asks to create, execute, resume, audit, update, or close a multi-step plan; asks what remains; says work is getting lost; or wants clear project follow-up across sessions or repositories.
---

# Ariadne

Keep one durable Markdown ledger as source of truth. Chat plans are summaries, never the only record.

Goal: no Ariadne project advances blocked tasks or loses evidence between sessions.

## Módulo base: Gobierno de dependencias y orden estricto

All Ariadne projects operate with an ordered queue and explicit dependencies.

### Ledger per project

Each project ledger must track:

- priority
- state
- dependencies
- risks
- evidence
- next action
- decision history

Path: `docs/plans/<slug>.md` (governance layer). Backlog.md tasks (`backlog/tasks/`) are the execution surface when present.

### Visible board states

Map Backlog/Kanban states to ledger intent:

| Board | Meaning | Ledger state |
| --- | --- | --- |
| To Do | Pending, not authorized | `pendiente` |
| Queue | Authorized and ordered | `pendiente` (queued) |
| Doing | Active work | `en_progreso` |
| Done | Finished and verified | `hecho` |

A task never advances if any dependency is:

- not finished
- blocked
- missing evidence
- has pending tests
- not deployed or verified in production when required

### Dependency graph integrity

Before starting work, detect and fix:

- cycles
- orphan tasks (unreachable or unreferenced when they should be linked)
- missing dependency IDs
- duplicate task IDs
- incoherent priorities (e.g. Low blocking Ultra High without documented reason)

Run these checks on `ariadne audit` and before moving a task to Queue or Doing.

### Priority order

1. **Ultra High** — production critical or immediate security
2. **High** — important or blocking bugs
3. **Medium** — functional improvements
4. **Low** — optimizations, docs, future ideas

### Concurrency limits

- At most **three** tasks in Doing (`en_progreso`).
- Prefer **one** primary execution gate (single active focus).

### Advancement gates (never collapse)

Track separately:

- code ready
- audited
- migrated
- deployed
- verified in production

Never infer deployment from local completion alone.

### Done requires verifiable evidence

A task may move to Done only with at least one of:

- tests (command + result)
- diff / commit
- log
- deployment ID or release
- data query output
- screenshot
- explicit human acceptance

### ID conventions

- Bugs: `{CODE}-B-{n}` (e.g. `JM-B-12`)
- Enhancements: `{CODE}-E-{n}` (e.g. `JM-E-22`, `AH-E-7`)
- Ledger rows may use project-specific prefixes (e.g. `ARLOCAL-001`)
- Never reuse IDs
- Run duplicate-ID audit before closing a phase

### Unregistered work

When work appears that is not tracked:

1. Create a new task
2. Assign priority
3. Define dependencies
4. Add acceptance criteria
5. Add it to the ledger
6. Place it in the correct queue order

### Before each execution

1. Read the project ledger
2. Review the active task
3. Review its history
4. Confirm dependencies are satisfied
5. Define the next gate

### After each phase

1. Update state
2. Record files changed
3. Record tests run
4. Record blockers
5. Record next action
6. Validate the ledger (`check_plan.py`)

### Deployment policy

Do **not** deploy automatically. Deployment requires:

- audit approved
- green tests
- dependencies closed
- migrations verified
- explicit authorization

### Failure handling

If a task fails:

- preserve the failed command
- document root cause
- document recovery steps
- do **not** mark Done

## Multi-project mode

When the repository contains a Backlog.md project (`backlog.config.yml` or `backlog/`), use Backlog.md as the task execution surface and Ariadne as the governance layer. Use the CLI or MCP integration for task changes; do not hand-edit task files when the command is available.

- Each project keeps its own tasks; the local Ariadne Hub catalogs project paths and opens each board.
- Keep the ledger in `docs/plans/<slug>.md` for decisions, risks, dependencies, evidence, and deferred work that should survive a tool change.
- Encode binary acceptance criteria in Backlog tasks. A task cannot be `Done` without evidence in the task and ledger.
- Use typed Backlog IDs: `{TASK_CODE}-B-{n}` for bugs, `{TASK_CODE}-E-{n}` for enhancements. Keep legacy IDs readable; do not renumber existing tasks.
- At every meaningful phase, record a checkpoint: current task ID, files changed, verification, blocker, and exact next action.
- On resume, read the ledger first, then inspect the active Backlog task and repository state. Never restart from memory or silently skip an unfinished item.
- Maintain one active project pointer; do not mix tasks from two projects in the same execution phase.
- Hub boards: bugs and improvements are separate (`view=bugs`, `view=mejoras`). Queue order is manual (`ordinal`); turn 1 runs first.

Recommended local Hub (standalone repo):

```bash
cd /path/to/Ariadne
npm install
npm start
```

- Hub: `http://127.0.0.1:4177`
- Kanban: `http://127.0.0.1:6421/?project=<slug>&view=bugs|mejoras`

Local-only; the Hub does not publish project data.

## Workflow

1. Locate an existing plan ledger before creating one. Prefer `docs/plans/<slug>.md`.
2. Read the full ledger before acting. Reconcile with current request, repo state, diffs, tests, and deployed state.
3. Create the ledger from the schema below if none exists.
4. Assign stable IDs. Never renumber or reuse IDs.
5. Record new requirements, findings, risks, or deferred work before continuing implementation.
6. Update task state only with concrete evidence.
7. End each work phase by updating heartbeat, next action, decisions, and evidence.
8. Run `scripts/check_plan.py <ledger>` after material updates.
9. If using Backlog.md, run its task/status commands after each state transition and copy the result into ledger evidence.

## Required Ledger Schema

```markdown
# Plan: <name>

## Control
- Estado:
- Última actualización:
- Objetivo:
- Gate actual:
- Próxima acción:

## Alcance
### Incluye
### No incluye
### Restricciones

## Métricas de éxito

## Registro maestro
| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |

## Riesgos
| ID | Severidad | Riesgo | Mitigación | Estado |

## Decisiones
| Fecha | ID | Decisión | Motivo | Impacto |

## Diferidos
| ID | Trabajo | Motivo | Condición de reactivación |

## Historial
```

Allowed ledger task states:

- `pendiente`
- `en_progreso`
- `bloqueado`
- `hecho`
- `diferido`
- `cancelado`

## Integrity Rules

- Keep acceptance criteria observable and binary where possible.
- Mark `hecho` only with evidence (see module above).
- For `bloqueado`, record exact blocker and smallest unblocking action.
- For `diferido`, record reason and reactivation condition in `Diferidos`.
- Preserve failed attempts in notes when they affect future work.
- Split discovered work into new IDs; do not hide it inside notes.
- Link dependencies by ID in the `Depende de` column.
- Keep at most three tasks `en_progreso`; prefer one primary gate.
- If chat and ledger disagree, inspect evidence and update the ledger explicitly.
- Never delete completed or cancelled rows; history matters.

## Commands

- `ariadne plan` — create or normalize ledger.
- `ariadne status` — report current gate, completed tasks, active task, blockers, next three tasks, new risks (nothing else unless asked).
- `ariadne resume` — read ledger and continue exact next action.
- `ariadne audit` — missing IDs, weak acceptance, stale blockers, dependency cycles, missing deps, duplicates, unsupported `hecho`, untracked discoveries.
- `ariadne close` — verify every item is done, deferred with trigger, or cancelled with reason; then produce closeout.
- `ariadne checkpoint` — write current task, evidence, failed attempts, and next action before changing context.
- `ariadne recover` — reconcile ledger, Backlog state, git diff, and tests after interruption.
- `ariadne projects` — list project health via local Hub and open a board.

## Reporting

Lead with current gate and outcome. Report **only**:

- current gate
- completed tasks (with evidence refs)
- active task
- blockers
- next three tasks
- new risks

Do not restate the entire plan unless requested.

## Validation

```bash
python3 <skill-dir>/scripts/check_plan.py <ledger.md>
```

Fix validation errors before calling a phase closed. Warnings may remain only when explained in the ledger.

The validator also checks dependency integrity:

- missing dependency IDs
- dependency cycles
- tasks in `en_progreso` with unfinished dependencies
- possible orphan tasks (no deps and nothing depends on them)

Run unit tests:

```bash
python3 <skill-dir>/scripts/test_check_plan.py
```
