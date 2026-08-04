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
npm test
npm run ariadne:audit   # all docs/plans ledgers + optional gantt backlog
```

### Lite vs full skill

Simple backlog/ledger updates: **`skills/ariadne-lite/`** (`docs/ariadne-lite.md`).

```bash
npm run ariadne:route-hint -- "mueve tarea a cola"   # JSON hint for wrappers
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
