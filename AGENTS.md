# AGENTS.md — Ariadne

## Cursor Cloud specific instructions

### Bootstrap (every session)

```bash
cd /agent/repos/Ariadne   # repo root in this monorepo layout
npm install
```

### Smoke before Gantt/hub changes

```bash
npm run smoke:cloud
npm run smoke:lifecycle   # ARLOCAL-010 two-project Kanban lifecycle
npm test
npm run ariadne:sync -- --fix   # post-edit: audit + ledger hygiene + check_plan
npm run ariadne:audit   # audit only (same as sync step 1)
```

Kanban task APIs (`/api/tasks/*`) listen on **`ARIADNE_BOARD_PORT`** (default `6421`); hub/Gantt on **`ARIADNE_HUB_PORT`** (default `4177`). Integration tests that exercise create/status/content must start both ports (see `tests/two-project-lifecycle.test.js`).

### Lite vs full skill

Simple backlog/ledger updates: **`skills/ariadne-lite/`** (`docs/ariadne-lite.md`). After edits: **`npm run ariadne:sync -- --fix`** (`docs/ariadne-automation.md`).

```bash
npm run ariadne:route-hint -- "mueve tarea a cola"   # JSON hint for wrappers
npm run ariadne:launcher -- "actualiza el ledger"   # skill path + env exports
```

### Run Hub locally (manual)

```bash
npm start
# Hub http://127.0.0.1:4177 · portfolio /portfolio.html
```

Tests bind ephemeral ports; no need to keep `npm start` running for CI-style verification.

### Gantt program

Ledger: `docs/plans/ariadne-gantt.md` (AH-E-9 … AH-E-29 **cerrado**).

| Doc | Topic |
|-----|--------|
| `docs/gantt-operaciones.md` | Manual operativo |
| `docs/GANTT.md` | Visión funcional |
| `docs/cloud-dev-environment.md` | Entorno cloud |

### Do not commit

- `projects.json` (machine-local paths)
- Ad-hoc sandboxes under `/tmp`

### UI Gantt externa

Repo `frontend-angular` en `:63447` — fuera del workspace (AGANTT-DEF-01). Backend listo vía `npm run gantt:smoke`.
