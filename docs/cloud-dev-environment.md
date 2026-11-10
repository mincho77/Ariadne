# Cloud dev environment (Cursor Agent)

Validación mínima para que un agente cloud arranque Ariadne, ejecute tests y consulte APIs Gantt con UI Gantt integrada (`/gantt/`).

## Bootstrap

```bash
npm install
npm run smoke:cloud
```

`smoke:cloud` ejecuta `tests/cloud-dev-smoke.test.js` (Hub HTTP, plan Gantt, portafolio, scripts npm).

Regresión completa:

```bash
npm test
npm run ariadne:sync -- --fix   # post-edit ledgers
npm run gantt:smoke
npm run gantt:audit    # dry-run; exit 1 si hay issues en backlog real
```

## Variables de entorno

| Variable | Uso en cloud |
|----------|----------------|
| `ARIADNE_CATALOG_PATH` | Catálogo temporal en tests (sandbox) |
| `ARIADNE_HUB_PORT` | Puerto libre asignado en smoke |
| `ARIADNE_BOARD_PORT` | Igual que hub en tests single-port |
| `ARIADNE_GANTT_BASE_URL` | Sobrescritura opcional de la ruta UI integrada (normalmente no se requiere) |

## Limitaciones conocidas

- El smoke de Gantt verifica el contrato API y que el Hub sirve el frontend integrado.
- **`projects.json`** es local por máquina; en cloud los tests usan catálogo temporal.
- **LaunchAgents macOS** no aplican en Linux cloud.

## Checklist agente

1. `npm install`
2. `npm run smoke:cloud`
3. Tras editar ledgers: `npm run ariadne:sync -- --fix`
4. Tras cambios Gantt: `npm test` + `python3 skills/ariadne/scripts/check_plan.py docs/plans/ariadne-gantt.md`

Ver también `docs/gantt-operaciones.md` y `AGENTS.md`.
