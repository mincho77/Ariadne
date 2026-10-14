---
name: ariadne
description: Maintain durable, auditable project plans and perform project-level DAFO audits through conversation. Use when the user asks to create, execute, resume, audit, update, or close a plan, asks what remains, or requests an Ariadne audit, correction, or deployment workflow.
---

# Ariadne

Keep one durable Markdown ledger as source of truth. Chat plans are summaries, never the only record.

Goal: no Ariadne project advances blocked tasks or loses evidence between sessions.

## Conversational project audit (DAFO)

When the user writes a natural-language request such as “Ariadne, audita”, “Ariadne, audita y corrige”, or “Ariadne, audita, corrige y despliega”, handle the audit in the conversation. Do not make the user run a terminal command or pass `--interactive` unless they explicitly ask for CLI use.

- The DAFO is about the **whole active project**, not the Ariadne Hub implementation, an individual task, or the current ledger by itself. Use the active project/repository context. If multiple projects are plausible and there is no clear active project pointer, ask which one before analyzing.
- Read the project's existing ledger, goals, README/product description, backlog, repository structure, and relevant code/configuration. Ground each DAFO factor in that project's evidence; label assumptions and unknown external conditions instead of presenting them as facts.
- Assess internal strengths and weaknesses, external opportunities and threats, then give a project-level viability judgment with reasons, key dependencies, and conditions. Use `viable`, `viable con condiciones`, `no viable`, or `evidencia insuficiente` (or clear English equivalents). Do not use a numeric score or pretend code health alone establishes business viability.
- If the goal, intended users, success criteria, scope, constraints, or external assumptions are unclear in a way that could change the DAFO or viability judgment, ask focused questions in chat before finalizing it. Ask only what is material, group related questions, and wait for answers before resolving those uncertainties. If the user does not know, retain the uncertainty and lower the confidence/judgment accordingly.
- A request to audit alone is read-only: report the DAFO in chat and do not create or edit a ledger just to store it. If the user also asks to correct, that authorizes in-scope corrections after findings are clear; ask before resolving material product/design choices. Record decisions and evidence in the ledger when the requested correction/workflow includes plan updates.
- For a request that includes deployment, audit first and deploy only when the existing deployment gates are satisfied and the target is clear. Ask in chat if the target or a material deployment choice is ambiguous; never infer production readiness from local completion.
- The CLI `npm run ariadne:audit` remains a deterministic ledger/Gantt integrity check. It is not the conversational, whole-project DAFO. Do not substitute the CLI report for the project-level analysis.

## Autonomous development cycle for Enhancement tasks

When the user asks to develop, implement, build, or execute a registered Enhancement (`E`) task, run this workflow in the current conversation. A Hub-generated improvement run packet also carries these instructions; the task card and ledger remain the durable source of scope and evidence.

1. Read the project ledger, task card and history, acceptance criteria, dependencies, repository guidance, and relevant implementation. Confirm dependencies are ready. Before editing, record a concise plan and verification commands in the task/ledger.
2. Ask only about missing decisions that could materially change scope, architecture, UX, security, or acceptance. Otherwise proceed autonomously within the task's criteria.
3. Implement, run focused checks then required project gates, inspect the diff, and verify each acceptance criterion. For UI work, inspect the rendered result and responsive behavior; for every change, review functional behavior and regressions.
4. Run an adversarial review in a separate context where the host supports it. Give the reviewer the goal, criteria, diff, and evidence; require findings with severity, location, reproduction, and unmet criterion. The reviewer does not edit or expand scope. If no independent reviewer/model is available, label the review non-independent.
5. Fix in-scope findings and repeat build, checks, diff review, and arbitration up to `ARIADNE_ENHANCEMENT_MAX_CYCLES` (default 5, valid range 1–20). PASS requires verified mandatory criteria and zero open BLOCK findings. At the limit, report BLOCKED with unresolved findings; never call exhaustion a pass.
6. Use the task's recommended cheap/capable tier only through a model selector or backend that is already installed, authorized, and configured. A prompt or `modelHint` is a recommendation and cannot change the active ChatGPT/Codex model by itself. With no usable router, keep the current model and state that plainly; do not call a new API, enable JEV, or silently switch providers. Honor an explicit user override.
7. Record tier/model/backend and selection reason when available, each cycle's reviewer verdict and finding closure, commands/results, changed files, remaining risks, and next action. Never deploy, publish, merge, or mark Done without explicit authorization and evidence.

### Optional JEV signals

- JEV is opt-in per Ariadne Hub installation. Check `GET http://127.0.0.1:4177/api/jev/status`; use it only when both `enabled` and `configured` are true. If the Hub is unavailable, JEV is off, or no key is configured, continue the normal DAFO without JEV.
- After required context questions are answered, send only the allowlisted state fields to `POST /api/projects/<slug>/jev/dafo` on the local Hub. Never send repository files, arbitrary code, secrets, or environment variables. The Hub redacts some common credential patterns but cannot guarantee secret detection; keep the payload minimal.
- If the endpoint returns `insufficient_context`, ask the user for the missing fields before retrying. On provider/network errors, continue the DAFO without JEV signals and do not retry automatically.
- Treat returned scores, probabilities, and confidence as separate model signals. For each signal, name the dimension and relate it only to the supplied evidence; if the endpoint provides no supporting evidence for a score, say so. If confidence is low or signals conflict, call that out and ask for human review or clarifying context; never infer viability from it. JEV does not author the SWOT/DAFO or decide project viability. Ground the final factors in project evidence, explain uncertainty, and make the viability judgment yourself with human review.

### Choosing where to start

- When the user asks which development task to start first (for example, “revisa el backlog y dime por dónde empezar”), inspect only the active project's open backlog. If the user names candidate task IDs, pass those; otherwise let the local Hub select up to five open tasks by the board's current priority/order.
- Check `GET /api/jev/status` and use `POST /api/projects/<slug>/jev/start-task` only when JEV is enabled and configured. Send `{}` to compare the Hub-selected slate, or `{ "candidateIds": ["...", "..."] }` for two to five user-selected IDs. The Hub reads only each candidate's ID, title, status, priority, type, short description, acceptance criteria, and dependency references; it does not send source files or code.
- The endpoint excludes tasks with unresolved or unfinished blocking dependencies before sending anything to TypeSafe. It also caps the comparison at five and returns `insufficient_candidates` or `insufficient_context` without a provider call when appropriate. Ask the user to clarify the missing task context, then retry only after the user answers or updates the task details.
- Treat `preferred` as JEV's choice signal, not an automatic winner. Compare the per-task value/alignment, implementation readiness, dependency readiness, and risk/effort signals with actual backlog evidence and explain tradeoffs, confidence, and probabilities. If the Hub/JEV is unavailable or disabled, provide the normal conversational comparison without JEV.
- Never change status, reorder a queue, or authorize a task from this recommendation. Ask the user which task they want to start; perform a board change only after explicit authorization.

## Route lite vs full (Cursor)

Before deep context, classify the request:

```bash
npm run ariadne:route-hint -- "<user message>"
npm run ariadne:launcher -- "<user message>"   # adds skillFile + env
```

| Result | Load |
|--------|------|
| `ariadne-lite` | `skills/ariadne-lite/SKILL.md` |
| `ariadne` | this file |

Cursor rule (always on): `.cursor/rules/ariadne-route.mdc`. Wrapper docs: `docs/ariadne-launcher.md`.

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

**Invariant — Kanban covers open plan work:** if the ledger Registro or Control cites a backlog task ID (`AH-E-*`, `*-B-*`, …) while that row is `pendiente` / `en_progreso` / `bloqueado`, the Markdown card **must** exist under `backlog/tasks/`. A plan with more open work than the board is a defect; `npm run ariadne:audit` reports `LEDGER_WITHOUT_KANBAN`. Seed or enqueue cards before writing them into the plan.

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

- Bugs: `{CODE}-B-{n}` (e.g. `PD-B-12`)
- Enhancements: `{CODE}-E-{n}` (e.g. `PD-E-22`, `AH-E-7`)
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
