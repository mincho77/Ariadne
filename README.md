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

**Módulo de bugs:** http://127.0.0.1:6421/?project=jurismate&view=bugs

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

## Arranque automático (macOS)

```bash
cp com.ariadne.hub.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.ariadne.hub.plist
```

## Migración desde JurisMate

Este repo reemplaza `JurisMate/tools/ariadne-hub`. JurisMate sigue registrado en `projects.json` como proyecto externo; sus tareas viven en su propio `backlog/`.
