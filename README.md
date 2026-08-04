# Ariadne

Hub local multiproyecto para planes Markdown, Backlog.md y gobernanza Ariadne.

## Requisitos

- Node.js 18+ (recomendado 20)
- Python 3 (para `skills/ariadne/scripts/check_plan.py`)

## Inicio rápido

```bash
npm install
npm start
```

- **Hub:** http://127.0.0.1:4177
- **Kanban JurisMate:** http://127.0.0.1:6421/?project=jurismate
- **Kanban Ariadne (este repo):** http://127.0.0.1:6422/?project=ariadne

En el detalle de cualquier tarea del Kanban, usa **Editar texto** para modificar el Markdown completo y **Guardar cambios**.

**Tablero de bugs:** http://127.0.0.1:6421/?project=jurismate&view=bugs  
**Tablero de mejoras:** http://127.0.0.1:6421/?project=jurismate&view=mejoras  

El Hub muestra dos carriles separados por proyecto. Al abrir un tablero sin `view`, redirige a bugs si hay abiertos; si no, a mejoras. Ya no hay vista mixta por defecto.

## IDs de tareas

Cada proyecto usa un código de dos letras en `projects.json` (`taskCode`). Las tareas nuevas siguen:

- **Bug:** `{CODE}-B-{n}` → `JM-B-1`, `AH-B-3`
- **Mejora:** `{CODE}-E-{n}` → `JM-E-1`, `AH-E-2`

Los IDs legacy o inconsistentes se corrigen con:

```bash
npm run task:normalize -- jurismate          # dry-run
npm run task:normalize -- jurismate --apply  # escribe cambios
npm run task:normalize -- --all --apply      # todos los proyectos
```

Al abrir un tablero, Ariadne normaliza automáticamente IDs mezclados (legacy, B/E incorrecto, código de proyecto distinto o huecos).

Crear tarea localmente (sin HTTP):

```bash
npm run task:create -- jurismate --bug "BUG producción · Upload congela"
npm run task:create -- jurismate --mejora "Mejora de ranking"
npm run task:create -- ariadne --enhancement "HUB · Auditoría multiproyecto"
```

Desde el tablero Kanban también puedes usar **+ New bug** o **+ New enhancement**.

Crear bug desde afuera (entra a Queue y arranca si no hay otro activo):

```bash
curl -s -X POST 'http://127.0.0.1:6421/api/bugs/create?project=jurismate' \
  -H 'content-type: application/json' \
  -d '{"title":"BUG producción · Upload congela","priority":"Ultra High","description":"Detalle del incidente"}'
```

Runner de cola de bugs (uno a uno):

```bash
npm run queue:bugs -- jurismate
```

Deja un runner activo en otra terminal. Cuando entra un bug:
1. Se encola en **Queue** del tablero de bugs
2. Si no hay otro bug en **Doing**, pasa a ejecución al instante
3. Escribe la instrucción en `<proyecto>/.ariadne/bug-queue/current.md`

Consultar cola:

```bash
curl -s 'http://127.0.0.1:6421/api/queue/bugs?project=jurismate'
```

Marcar bug terminado (libera el runner para el siguiente):

```bash
npm run queue:complete -- jurismate JM-B-23
```

Crear tarea genérica vía API:

```bash
curl -s -X POST 'http://127.0.0.1:6421/api/tasks/create?project=jurismate' \
  -H 'content-type: application/json' \
  -d '{"title":"BUG producción · Upload congela","type":"bug","priority":"Ultra High"}'
```

## Estructura

```
Ariadne/
├── server.js          # Hub + Kanban local
├── public/            # UI del Hub
├── projects.json      # Catálogo de proyectos (rutas locales)
├── skills/ariadne/    # Skill y validador de ledgers
├── docs/plans/        # Ledgers de gobernanza
└── backlog/           # Tareas del Hub (prefijo AH)
```

## Registrar un proyecto

Edita `projects.json` o usa **+ Nuevo proyecto** en el Hub. Cada entrada necesita:

- `slug`: identificador corto
- `name`: nombre visible
- `path`: ruta absoluta al repo/carpeta con `backlog/` o `docs/plans/`
- `port`: puerto del Kanban (6421, 6422, …)

## Validar un ledger

```bash
python3 skills/ariadne/scripts/check_plan.py docs/plans/ariadne-local.md
```

## Publicar standalone en GitHub

Checklist automatizado de preparación:

```bash
npm run release:check:standalone
```

Generar bundle reproducible del código fuente (git archive):

```bash
npm run release:bundle
```

Se genera un archivo en `dist/` con formato:

- `ariadne-standalone-v{version}-YYYYMMDD.tar.gz`

Runbook completo:

- `docs/plans/standalone-github-publish.md`

## Arranque automático (macOS)

Hub:

```bash
cp com.ariadne.hub.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ariadne.hub.plist 2>/dev/null || launchctl load ~/Library/LaunchAgents/com.ariadne.hub.plist
launchctl kickstart -k gui/$(id -u)/com.ariadne.hub
```

Cola de bugs (JurisMate, uno a uno):

```bash
cp com.ariadne.bug-queue.jurismate.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ariadne.bug-queue.jurismate.plist 2>/dev/null || launchctl load ~/Library/LaunchAgents/com.ariadne.bug-queue.jurismate.plist
launchctl kickstart -k gui/$(id -u)/com.ariadne.bug-queue.jurismate
```

Logs: `/tmp/ariadne-hub.log`, `/tmp/ariadne-bug-queue-jurismate.log`

## Gantt integrado

Planificador multiproyecto sobre el mismo backlog Markdown. Programa **AH-E-9 … AH-E-29** cerrado; ledger en `docs/plans/ariadne-gantt.md`.

```bash
npm test                  # regresión completa (156+ tests)
npm run gantt:smoke       # contrato Hub ↔ API Gantt
npm run gantt:audit       # dry-run readiness backlog
npm run smoke:cloud       # smoke entorno cloud / agente
```

- **Plan por proyecto:** `GET /api/projects/{slug}/gantt`
- **Portafolio:** `GET /api/gantt/portfolio` · Hub `/portfolio.html`
- **Manual:** `docs/gantt-operaciones.md` · **Funcional:** `docs/GANTT.md`

Cloud agents: `AGENTS.md` y `docs/cloud-dev-environment.md`.

Auditoría multiproyecto (ledgers + backlog Gantt):

```bash
npm run ariadne:sync -- --fix    # post-edit: audit + higiene + check_plan
npm run ariadne:audit
npm run ariadne:route-hint -- "mueve tarea a cola"
npm run ariadne:launcher -- "actualiza el ledger"
eval "$(./scripts/ariadne-launcher.sh 'mueve a cola')"
```

Modo liviano y automatización: `docs/ariadne-lite.md` · `docs/ariadne-automation.md` · launcher `docs/ariadne-launcher.md`.

Detener el runner viejo de JurisMate si existía:

```bash
launchctl bootout gui/$(id -u)/com.jurismate.ariadne-hub 2>/dev/null || true
```

## Migración desde JurisMate

Este repo reemplaza `JurisMate/tools/ariadne-hub`. JurisMate sigue registrado en `projects.json` como proyecto externo; sus tareas viven en su propio `backlog/`.
