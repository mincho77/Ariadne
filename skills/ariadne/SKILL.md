---
name: ariadne
description: Maintain durable, auditable execution plans so requirements, discoveries, dependencies, decisions, deferred work, and verification never get lost across long or deep work. Use when the user asks to create, execute, resume, audit, update, or close a multi-step plan; asks what remains; says work is getting lost; or wants clear project follow-up across sessions or repositories.
---

# Ariadne

Keep one durable Markdown ledger as source of truth. Chat plans are summaries, never the only record.

## Multi-project mode

When the repository contains a Backlog.md project (`backlog.config.yml` or `backlog/`), use Backlog.md as the task execution surface and Ariadne as the governance layer. Use the CLI or MCP integration for task changes; do not hand-edit task files when the command is available.

- Each project keeps its own tasks, while the local Ariadne Hub catalogs project paths and opens each board.
- Keep the Ariadne ledger in `docs/plans/<slug>.md` for decisions, risks, dependencies, evidence, and deferred work that should survive a tool change.
- Encode binary acceptance criteria in Backlog tasks. A task cannot be `Done` without evidence recorded in the task and ledger.
- At every meaningful phase, record a checkpoint: current task ID, files changed, verification, blocker, and exact next action. If a phase fails, preserve the failed command and recovery action.
- On resume, read the ledger first, then inspect the active Backlog task and repository state. Never restart from memory or silently skip an unfinished item.
- Maintain one active project pointer in the ledger or Hub context; do not mix tasks from two projects in the same execution phase.

Recommended local Hub:

```bash
cd tools/ariadne-hub
npm install
npm start
```

Open `http://127.0.0.1:4177`. It is local-only; the Hub does not publish project data.

## Workflow

1. Locate an existing plan ledger before creating one. Prefer `docs/plans/<slug>.md`, then a user-specified path.
2. Read the full ledger before acting. Reconcile it with current request, repository state, diffs, tests, and deployed state.
3. Create the ledger from the schema below if none exists.
4. Assign stable IDs. Never renumber or reuse IDs.
5. Record new requirements, findings, risks, or deferred work before continuing implementation.
6. Update task state only with concrete evidence.
7. End each work phase by updating heartbeat, next action, decisions, and evidence.
8. Run `scripts/check_plan.py <ledger>` after material updates.
9. If using Backlog.md, run its task/status commands after each state transition and copy the result or task URL/path into the ledger evidence.

## Required Ledger Schema

Use these sections:

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

Allowed task states:

- `pendiente`
- `en_progreso`
- `bloqueado`
- `hecho`
- `diferido`
- `cancelado`

## Integrity Rules

- Keep acceptance criteria observable and binary where possible.
- Mark `hecho` only with evidence: test, diff, log, deployment ID, screenshot, query, or explicit user acceptance.
- For `bloqueado`, record exact blocker and smallest unblocking action.
- For `diferido`, record reason and reactivation condition in `Diferidos`.
- Preserve failed attempts in notes when they affect future work.
- Split discovered work into new IDs; do not hide it inside notes.
- Link dependencies by ID.
- Keep at most three tasks `en_progreso`; prefer one.
- Separate code-complete, verified, deployed, and production-verified states.
- Never infer deployment from local completion.
- Never delete completed or cancelled rows; history matters.
- If chat and ledger disagree, inspect evidence and update the ledger explicitly.

## Commands

Interpret these user forms:

- `ariadne plan`: create or normalize ledger.
- `ariadne status`: report current gate, active work, blockers, and next three items.
- `ariadne resume`: read ledger and continue exact next action.
- `ariadne audit`: find missing IDs, weak acceptance, stale blockers, untracked discoveries, and unsupported `hecho`.
- `ariadne close`: verify every item is done, deferred with trigger, or cancelled with reason; then produce closeout.
- `ariadne checkpoint`: write the current task, evidence, failed attempts, and next action before changing context.
- `ariadne recover`: reconcile the ledger, Backlog task state, git diff, and tests after interruption or compaction.
- `ariadne projects`: use the local Ariadne Hub to list project health and open a project board.

## Reporting

Lead with current gate and outcome. Report only:

- completed IDs with evidence;
- active ID;
- blockers or new risks;
- changed decisions;
- next action.

Do not restate entire plan unless requested.

## Validation

Run:

```bash
python3 <skill-dir>/scripts/check_plan.py <ledger.md>
```

Fix validation errors before calling a phase closed. Warnings may remain only when explained in the ledger.
