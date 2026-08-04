---
name: ariadne-lite
description: Lightweight Ariadne for simple backlog and ledger updates — move tasks, update status, record decisions, run check_plan.py. Use for small operational requests. Do NOT use for code audits, deployments, Pharos, Gantt engine work, or multi-file refactors; use the full ariadne skill instead.
---

# Ariadne Lite

Minimal governance for **read/write/update** on Markdown backlogs and plan ledgers. Same evidence rules as full Ariadne; **narrower scope** and **fewer files to read**.

Full rules and deployment gates: `skills/ariadne/SKILL.md` and `docs/ariadne-lite.md`.

## Use this skill when

- Create, move, or close a Backlog task (Hub/Kanban/CLI)
- Update `docs/plans/<slug>.md` (estado, evidencia, próxima acción)
- Reprioritize queue (`ordinal`)
- Run `check_plan.py` on one ledger
- Answer: current gate, next action, blockers (single project)

## Do NOT use when

- Code changes beyond task Markdown/frontmatter
- Pharos, production deploy, migrations, security review
- Gantt scheduler/API/tests (`lib/gantt/*`)
- Closing a phase without verifiable evidence
- Multi-project audit → use `npm run ariadne:audit` + full `ariadne`

## Workflow (lite)

1. Read **one** ledger: `docs/plans/<slug>.md` (Control + active task row).
2. If touching Backlog, read **only** the task file(s) involved.
3. Apply the smallest change (Hub API, PATCH, or Markdown edit).
4. Update ledger heartbeat + evidence line.
5. Validate:

```bash
npm run ariadne:sync -- --fix
# or: python3 skills/ariadne/scripts/check_plan.py docs/plans/<slug>.md
```

## Allowed commands (conceptual)

Same names as full Ariadne, scoped:

- `ariadne status` — one project, short report
- `ariadne checkpoint` / `ariadne resume` — ledger + active task only
- `ariadne plan` — append history / fix one row (not full program design)

Skip in lite: deep `ariadne audit` (use `npm run ariadne:sync -- --fix`), `ariadne close` for whole programs, deployment flows.

## Hub (local)

```bash
npm start
# Hub :4177 · Kanban :6421/?project=<slug>&view=bugs|mejoras
```

## Evidence (unchanged)

Done still requires tests, diff, log, or explicit acceptance — lite does not relax this.

## Routing hint

```bash
node scripts/ariadne-route-hint.js "<user message>"
```

Returns JSON suggesting `ariadne-lite` vs `ariadne` for external wrappers. Full launcher: `npm run ariadne:launcher` · `docs/ariadne-launcher.md`.
