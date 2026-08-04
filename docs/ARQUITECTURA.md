# Ariadne — Arquitectura y funcionamiento técnico

Documento de referencia para entender cómo funciona Ariadne desde la arquitectura de software, el modelo de datos, las APIs, los tableros Kanban, la cola de bugs y la capa de gobernanza.

**Versión del repo:** v0.1.x · **Stack:** Node.js (CommonJS) + Python 3 · **Alcance:** local (`127.0.0.1`)

---

## 1. Propósito y principios de diseño

Ariadne es un **hub local multiproyecto** que unifica tres preocupaciones que normalmente viven dispersas:

1. **Ejecución** — tareas concretas en archivos Markdown compatibles con [Backlog.md](https://github.com/MrSimonEmms/backlog.md), organizadas en tableros Kanban.
2. **Orquestación** — cola ordenada de bugs, prioridades, dependencias y gates de avance.
3. **Gobernanza** — ledgers Markdown duraderos (`docs/plans/`) que registran decisiones, riesgos, métricas y el registro maestro de trabajo.

### Principios

| Principio | Implicación |
|-----------|-------------|
| **Archivos como fuente de verdad** | Las tareas viven en `{proyecto}/backlog/**/*.md`. No hay base de datos. |
| **Dos capas de planificación** | `backlog/` = ejecución; `docs/plans/` = gobernanza y auditoría. |
| **Separación bugs / mejoras** | Mismos archivos físicos, filtrados lógicamente en la UI. |
| **Local-first** | Todo corre en `127.0.0.1`; sin auth ni multi-tenant. |
| **Integración con agentes** | La skill `skills/ariadne/` y la cola de bugs escriben instrucciones legibles por humanos y por LLMs. |

---

## 2. Vista de arquitectura

### 2.1 Componentes y puertos

Ariadne levanta **dos servidores HTTP** desde un único proceso Node (`server.js`):

```
┌─────────────────────────────────────────────────────────────────┐
│                     server.js (un proceso)                     │
├────────────────────────────┬────────────────────────────────────┤
│  Hub                       │  Kanban / Board                    │
│  handle()                  │  handleBoard()                     │
│  :4177  ARIADNE_HUB_PORT   │  :6421  ARIADNE_BOARD_PORT         │
│  public/ (estático)        │  HTML generado server-side         │
│  /api/projects             │  /api/tasks/*, /api/queue/*         │
└────────────────────────────┴────────────────────────────────────┘
```

| Superficie | URL base | Responsabilidad |
|------------|----------|-----------------|
| **Hub** | `http://127.0.0.1:4177` | Catálogo de proyectos, resumen bugs/mejoras, alta de proyectos |
| **Kanban** | `http://127.0.0.1:6421/?project={slug}&view={bugs\|mejoras}` | Tableros, CRUD de tareas, cola de bugs, estadísticas |

Si `BOARD_PORT === PORT`, solo se levanta un servidor (caso atípico).

### 2.2 Diagrama de flujo de datos

```mermaid
flowchart TB
  subgraph UI["Interfaces"]
    Hub["Hub UI\npublic/"]
    Kanban["Kanban HTML\nbugs-board / mejoras-board"]
    CLI["Scripts CLI\ncreate-task, runner, queue-complete"]
    Agent["Agente LLM\nskill Ariadne"]
  end

  subgraph Core["Núcleo Ariadne"]
    Server["server.js"]
    TaskIds["task-ids.js"]
    Normalize["task-id-normalize.js"]
    BugQueue["bug-queue.js"]
  end

  subgraph Storage["Persistencia en disco"]
    Catalog["projects.json"]
    Backlog["{proyecto}/backlog/**/*.md"]
    RunPacket["{proyecto}/.ariadne/bug-queue/"]
    Ledger["docs/plans/*.md"]
  end

  subgraph External["Externo"]
    BacklogCLI["backlog.md CLI\nnode_modules/.bin/backlog"]
    CheckPlan["check_plan.py"]
  end

  Hub -->|GET/POST /api/projects| Server
  Kanban -->|POST /api/tasks/*| Server
  CLI -->|HTTP o require()| Server
  Agent -->|lee/escribe| Backlog
  Agent -->|valida| CheckPlan
  CheckPlan --> Ledger

  Server --> Catalog
  Server --> Backlog
  Server --> BugQueue
  Server -->|status, ordinal| BacklogCLI
  Server --> RunPacket
  TaskIds --> Backlog
  Normalize --> Backlog
```

### 2.3 Catálogo de proyectos

El archivo `projects.json` (local, no versionado) registra cada proyecto:

```json
{
  "slug": "jurismate",
  "name": "JurisMate",
  "taskCode": "JM",
  "path": "/Users/.../Code/JurisMate",
  "port": 6421,
  "createdAt": "2026-07-27T12:15:24.779Z"
}
```

| Campo | Uso |
|-------|-----|
| `slug` | Identificador en URLs (`?project=jurismate`) |
| `name` | Nombre visible en Hub y tableros |
| `path` | Ruta absoluta al repo; debe contener (o recibir vía `backlog init`) la carpeta `backlog/` |
| `taskCode` | Prefijo de dos letras para IDs (`JM`, `AH`) |
| `port` | Hint histórico por proyecto; el board compartido usa un solo `BOARD_PORT` |

**Alta de proyectos:**

- Manual: editar `projects.json`
- Hub UI: `POST /api/projects` con `{ name, path? }` → opcionalmente ejecuta `backlog init` si no existe backlog
- Plantilla: `projects.example.json`

---

## 3. Modelo de tareas

### 3.1 Ubicación en disco

```
{proyecto}/
├── backlog/
│   ├── tasks/          ← tareas activas
│   ├── completed/      ← tareas terminadas (Backlog.md)
│   └── archive/        ← archivadas
└── .ariadne/
    └── bug-queue/      ← paquete de ejecución del runner
        ├── current.json
        └── current.md
```

Ariadne lee las tres carpetas (`tasks`, `completed`, `archive`) al listar tareas via `projectTasks()`.

### 3.2 Formato de archivo Markdown

Cada tarea es un archivo `.md` con frontmatter YAML:

```yaml
---
id: JM-B-1
title: BUG producción · Upload congela
status: Queued
assignee: []
created_date: '2026-07-28 15:00'
updated_date: '2026-07-29 09:45'
labels:
  - bug
priority: Ultra High
type: bug
ordinal: 10
substatus: Pendiente Resultado Prueba
next_action: Reproducir en staging
---
## Description
...

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 El upload no congela con PDFs > 5MB
<!-- AC:END -->
```

**Convención de nombre de archivo:** `{id-minúsculas} - {título-slugificado}.md`

Ejemplo: `jm-b-1 - bug-produccion-upload-congela.md`

### 3.3 Sistema de IDs (`task-ids.js`)

| Tipo | Patrón | Ejemplo |
|------|--------|---------|
| Bug | `{CODE}-B-{n}` | `JM-B-23` |
| Mejora / enhancement | `{CODE}-E-{n}` | `AH-E-7` |

Funciones clave:

- `allocateTaskId()` — asigna el siguiente número de la secuencia B o E
- `createTaskFile()` — crea el archivo en `backlog/tasks/`
- `parseTypedTaskId()` / `formatTaskId()` — parseo y serialización
- `projectTaskCode()` — resuelve código desde `taskCode`, defaults (`ariadne→AH`, `jurismate→JM`) o iniciales del slug

### 3.4 Normalización de IDs (`task-id-normalize.js`)

Detecta y corrige IDs legacy o inconsistentes:

- IDs sin prefijo tipado
- Kind incorrecto (B vs E)
- Código de proyecto distinto al configurado
- Colisiones de rutas al renombrar

Se ejecuta:

- **Automáticamente** al abrir un tablero (`ensureProjectTaskIds()`)
- **Manualmente** via `npm run task:normalize -- {slug} [--apply]`

El mapa de migración se guarda en `backlog/task-id-migration.json`.

### 3.5 Parseo (`parseTask` en server.js)

`parseTask(rutaArchivo)` extrae frontmatter con regex (no parser YAML completo):

| Campo JS | Origen YAML | Notas |
|----------|-------------|-------|
| `id` | `id:` | |
| `title` | `title:` | Soporta multilínea (`>-`, `\|`) |
| `status` | `status:` | Default `To Do`; label `queued` → `Queued` |
| `priority` | `priority:` | Normalizado a Ultra High / High / Medium / Low |
| `type` | `type:` | Default `task` |
| `ordinal` | `ordinal:` | Orden manual en columna Queue |
| `labels` | bloque `labels:` | |
| `substatus`, `nextAction` | vía `enrichTask()` | Inferencia para tareas en Doing |

### 3.6 Estados y prioridades

**Estados internos → etiquetas del tablero (`STATUS_DISPLAY`):**

| Status en archivo | Columna Kanban | Transiciones API |
|-------------------|----------------|------------------|
| `To Do` | To Do | Permitido |
| `Blocked` | To Do (agrupado) | — |
| `Queued` | Queue | Permitido |
| `In Progress` | Doing | Permitido |
| `Done` | Done | Permitido |

**Prioridades** (`PRIORITY_ORDER`):

```
Ultra High (0) → High (1) → Medium (2) → Low (3)
```

**Reglas de ordenamiento:**

- Columnas **To Do / Doing / Done** → `sortTasksByPriority()` (prioridad, luego ordinal)
- Columna **Queue** → `sortQueuedTasks()` (**solo ordinal**, prioridad ignorada para respetar orden manual)

### 3.7 Clasificación bugs vs mejoras

**Bug** (`isBugTask()`):

- `type === 'bug'`, o
- label `bug`, o
- título que coincide con `^(bug|historico-bug|seguridad)`

**Mejora** (`isImprovementTask()`):

- Todo lo que **no** es bug

Esta clasificación es puramente lógica; no mueve archivos entre carpetas.

---

## 4. Servidor HTTP (`server.js`)

### 4.1 Hub — rutas (puerto 4177)

| Método | Ruta | Función |
|--------|------|---------|
| `GET` | `/` | `public/index.html` |
| `GET` | `/app.js`, `/styles.css` | Assets estáticos |
| `GET` | `/api/projects` | Lista proyectos con estadísticas (`summarize()`) |
| `POST` | `/api/projects` | Crea proyecto, opcional `backlog init` |
| `POST` | `/api/projects/:slug/browser` | Devuelve URL del tablero (`openBoard()`) |
| `GET` | `/portfolio.html` | Vista portafolio Gantt multiproyecto |
| `GET` | `/api/gantt/portfolio` | Agregado métricas/hitos/riesgos de todos los proyectos |
| `GET` | `/api/projects/:slug/gantt` | Plan JSON del planificador (`lib/gantt/`) |
| `GET` | `/api/projects/:slug/gantt/metrics` | Métricas Hub dedicadas |
| `POST` | `/api/projects/:slug/gantt/what-if` | Escenarios simulados (sin persistir por defecto) |
| `GET/POST` | `/api/projects/:slug/gantt/baselines` | Líneas base inmutables |

Motor modular en `lib/gantt/*` (scheduler, restrictions, baselines, hub-metrics, portfolio, what-if). Documentación: `docs/GANTT.md`, manual `docs/gantt-operaciones.md`.

`summarize(project)` calcula por proyecto:

- Conteos bugs abiertos / cerrados, progreso %
- Conteos mejoras abiertas / hechas
- `nextBug`, `next` (siguiente mejora)
- `focus`: `bugs` si hay bugs abiertos, si no `mejoras`

### 4.2 Kanban — rutas (puerto 6421)

Todas requieren `?project={slug}` (default: primer proyecto del catálogo).

#### Tareas

| Método | Ruta | Función |
|--------|------|---------|
| `POST` | `/api/tasks/status` | Cambiar estado (`updateTaskStatus`) |
| `POST` | `/api/tasks/content` | Editar Markdown completo |
| `POST` | `/api/tasks/substatus` | Actualizar substatus y next_action |
| `POST` | `/api/tasks/checklist` | Toggle de ítems de checklist |
| `POST` | `/api/tasks/create` | Crear tarea; bugs → auto-cola |
| `POST` | `/api/tasks/delete` | Eliminar archivo (no Done) |
| `POST` | `/api/tasks/normalize` | Normalizar IDs (`?dry=1` preview) |
| `POST` | `/api/tasks/queue-order` | Reordenar cola (ordinales) |

#### Bugs y cola

| Método | Ruta | Función |
|--------|------|---------|
| `POST` | `/api/bugs/create` | Crear bug + encolar + auto-start si cola libre |
| `GET` | `/api/queue/bugs` | Snapshot de cola (`getBugQueueSnapshot`) |
| `POST` | `/api/queue/bugs/claim` | Tomar siguiente bug → In Progress + run packet |
| `GET` | `/api/bugs/stats` | Estadísticas JSON para panel analytics |

#### Páginas HTML

| Ruta | Render |
|------|--------|
| `GET /?project=&view=bugs` | `bugsBoardPage()` |
| `GET /?project=&view=mejoras` | `mejorasBoardPage()` |
| `GET /?project=` (sin view) | Redirect 302 → `bugs` si hay abiertos, si no `mejoras` |
| `GET /?project=&view=queue` | `queueBoardPage()` — tablero mixto legacy |

### 4.3 Integración Backlog.md CLI

Para cambios de estado y ordinal, Ariadne intenta primero el binario local:

```
node_modules/.bin/backlog task edit ...
```

Si el CLI rechaza un estado (p. ej. `Queued`), hace **fallback** escribiendo el archivo directamente y manipulando labels `queued`.

### 4.4 Exportaciones del módulo

`server.js` exporta ~40 funciones para tests y scripts CLI, incluyendo:

`parseTask`, `createTask`, `createBugTask`, `claimNextBug`, `getBugQueueSnapshot`, `bugsBoardPage`, `normalizeProjectTaskIds`, `bugQueueState`, etc.

Los scripts hacen `require('../server')` para reutilizar la misma lógica sin HTTP.

---

## 5. Tableros Kanban

### 5.1 Columnas (`board-columns.js`)

Cuatro columnas fijas:

```
To Do → Queue → Doing → Done
```

`taskMatchesColumn()` decide pertenencia; `Blocked` se muestra en To Do.

### 5.2 Tablero de bugs (`bugs-board.js`)

- **Filtro:** solo `isBugTask()`
- **Tema visual:** rojo / incidentes
- **Analytics:** panel colapsable con `buildBugStats()` — temas inferidos (`inferBugTheme()`), tasa de cierre, distribución por prioridad
- **Creación:** botón `+ New bug` → API con auto-cola
- **Navegación:** tabs segmentados Bugs | Mejoras (`board-chrome.js`)

### 5.3 Tablero de mejoras (`mejoras-board.js`)

- **Filtro:** `isImprovementTask()` (≠ bug)
- **Tema visual:** azul
- **Analytics:** áreas inferidas (`inferImprovementArea()`) — Costo IA, Informes, Hub, etc.
- **Creación:** `+ New enhancement`

### 5.4 Tablero mixto legacy (`queueBoardPage`)

- Muestra **bugs y mejoras juntos**
- Banner "SIGUIENTE A EJECUTAR"
- Reordenamiento de cola con drag intra-Queue
- Sigue exportado y testeado; **no es la landing por defecto**

### 5.5 Interacción de tarjetas

Módulos compartidos:

| Módulo | Responsabilidad |
|--------|-----------------|
| `board-card-interaction.js` | Drag & drop, click → modal |
| `board-column-filter.js` | Matching tarea ↔ columna |
| `board-task-detail.js` | Modal detalle, checklist interactivo, editor Markdown |
| `board-substatus.js` | Substatus en Doing (inferido o explícito) |
| `board-delete.js` | Botón Delete + confirmación |
| `board-create.js` | Alta rápida desde tablero |
| `board-stats.js` | Paneles analytics colapsables |

**Drag & drop:**

1. `dragstart` en tarjeta (`draggable`)
2. `drop` en columna → `POST /api/tasks/status`
3. Drop en Queue con reorden → `POST /api/tasks/queue-order` con array de IDs

**Eliminación:**

- Permitido: To Do, Queue, Doing, Blocked
- Bloqueado: Done
- Implementación: `fs.unlinkSync` del archivo Markdown

---

## 6. Cola de bugs

### 6.1 Máquina de estados (`bug-queue.js`)

`bugQueueState(tasks, isBugTask)` delega en `laneQueueState()`:

```
                    ┌──────────────┐
  Bug creado ──────►│    Queue     │  (ordinal define orden)
                    └──────┬───────┘
                           │ claim / auto-start
                           ▼
                    ┌──────────────┐
                    │ In Progress  │  ← máximo 1 bug activo
                    └──────┬───────┘
                           │ Done
                           ▼
                    ┌──────────────┐
                    │     Done     │
                    └──────────────┘
```

| Campo snapshot | Significado |
|----------------|-------------|
| `active` | Primer bug con status `In Progress` |
| `next` | Primer bug en Queue (menor ordinal) si no hay active |
| `queued` | Lista ordenada de bugs en Queue |
| `queueLength` | Conteo de queued |

### 6.2 Flujo `createBugTask()`

1. `createTask()` → archivo en `backlog/tasks/`
2. Si `queue !== false` → `enqueueTask()` → status `Queued`
3. Si `start !== false` y no hay bug activo y este es `next` → `claimNextBug()` + `writeBugRunPacket()`

### 6.3 Paquete de ejecución

`writeBugRunPacket()` escribe en el **repo del proyecto** (no en Ariadne):

```
{proyecto}/.ariadne/bug-queue/current.json
{proyecto}/.ariadne/bug-queue/current.md
```

Contenido de `current.md` (plantilla `buildBugRunInstruction()`):

```
Atiende JM-B-23: BUG · ...

Corrige el bug en el repositorio del proyecto, prueba los cambios,
audita con Pharos y despliega solo si pasa.
Al terminar: marca la tarea Done en el Kanban
(o ejecuta `npm run queue:complete -- jurismate JM-B-23`).

Proyecto: JurisMate (jurismate)
Ruta: /Users/.../Code/JurisMate
Backlog: backlog/tasks/jm-b-23 - ...
```

### 6.4 Runner (`scripts/bug-queue-runner.js`)

```bash
npm run queue:bugs -- jurismate
# node scripts/bug-queue-runner.js <slug> [--once]
```

Loop principal (`tick()`):

1. `GET /api/queue/bugs?project=`
2. Si hay `active` → espera hasta que salga de In Progress (poll cada 5s)
3. Si no hay `next` → cola vacía, espera
4. `POST /api/queue/bugs/claim` → mueve a In Progress, escribe packet
5. Imprime instrucción en stdout; espera fin de ejecución

**Variables de entorno:**

| Variable | Default |
|----------|---------|
| `ARIADNE_BOARD_HOST` | `127.0.0.1` |
| `ARIADNE_BOARD_PORT` | `6421` |
| `ARIADNE_HUB_URL` | `http://127.0.0.1:6421` |
| `ARIADNE_QUEUE_POLL_MS` | `5000` |

### 6.5 Completar bug (`scripts/queue-complete.js`)

```bash
npm run queue:complete -- jurismate JM-B-23
```

→ `POST /api/tasks/status` con `{ id, status: "Done" }` — libera al runner para el siguiente.

---

## 7. Hub UI (`public/`)

| Archivo | Rol |
|---------|-----|
| `index.html` | Shell: grid de proyectos, diálogo nuevo proyecto |
| `app.js` | Fetch `/api/projects`, render cards, abrir tableros |
| `styles.css` | Tema oscuro, tarjetas dual-lane |

**Cada tarjeta de proyecto muestra:**

- Dos carriles: **Bugs** y **Mejoras** con conteos, barras de progreso y "Siguiente"
- Pill de foco: `Prioridad: bugs` o `Enfoque: mejoras`
- Botones "Abrir bugs" / "Abrir mejoras" → `POST /api/projects/:slug/browser`

**Auto-refresh:** al recuperar foco de ventana y al cambiar visibilidad del tab.

---

## 8. Gobernanza Ariadne

### 8.1 Dos capas de verdad

| Capa | Ubicación | Propósito | Herramienta |
|------|-----------|-----------|-------------|
| **Ledger** | `docs/plans/{slug}.md` | Requisitos, dependencias, decisiones, riesgos, evidencia | `check_plan.py` + skill |
| **Backlog** | `{proyecto}/backlog/tasks/*.md` | Trabajo ejecutable, estados Kanban | Ariadne Hub/Kanban |

El ledger **no reemplaza** las tareas de backlog; las referencia por ID (`JM-B-1`, `AH-E-3`).

### 8.2 Skill del agente (`skills/ariadne/SKILL.md`)

Define el módulo base de gobernanza:

- Estados ledger: `pendiente`, `en_progreso`, `bloqueado`, `hecho`, `diferido`, `cancelado`
- Mapeo board ↔ ledger
- Prioridades: Ultra High → High → Medium → Low
- Máximo 3 tareas en Doing; preferencia por un solo gate activo
- Gates separados: code ready → audited → migrated → deployed → verified
- Convención IDs: `{CODE}-B-{n}` / `{CODE}-E-{n}`
- **No deploy automático** sin autorización explícita

### 8.3 Validador `check_plan.py`

```bash
python3 skills/ariadne/scripts/check_plan.py docs/plans/ariadne-local.md
```

**Validaciones:**

| Categoría | Qué comprueba |
|-----------|---------------|
| Estructura | Headings obligatorios: Control, Alcance, Métricas, Registro maestro, Riesgos, Decisiones, Diferidos, Historial |
| Registro maestro | Tabla 8 columnas; IDs válidos; estados permitidos |
| Evidencia | Tareas `hecho` requieren evidencia |
| Acción | `en_progreso` / `bloqueado` requieren próxima acción |
| Dependencias | IDs inexistentes, ciclos, autodependencia |
| Progreso | `en_progreso` con dependencias no terminadas → error |
| Huérfanas | Tareas pendientes sin referencias → warning |

Tests: `skills/ariadne/scripts/test_check_plan.py` (6 casos).

### 8.4 Ledgers en este repo

| Archivo | Contenido |
|---------|-----------|
| `docs/plans/ariadne-local.md` | Plan maestro del hub local |
| `docs/plans/ariadne-mejoras.md` | Tracking de mejoras del producto Ariadne |

---

## 9. Scripts y comandos npm

| Comando | Script | Descripción |
|---------|--------|-------------|
| `npm start` | `server.js` | Levanta Hub + Kanban |
| `npm test` | `node --test` | Suite completa (~53 tests) |
| `npm run task:create` | `scripts/create-task.js` | Crear bug/mejora por CLI |
| `npm run bug:create` | alias de create-task | Igual que task:create |
| `npm run queue:bugs` | `scripts/bug-queue-runner.js` | Runner de cola |
| `npm run queue:complete` | `scripts/queue-complete.js` | Marcar Done vía API |
| `npm run task:normalize` | `scripts/migrate-task-ids.js` | Normalizar IDs |

**Ejemplos CLI:**

```bash
# Bug con auto-cola y auto-start
npm run task:create -- jurismate --bug "BUG · Upload congela" --priority "Ultra High"

# Mejora sin cola
npm run task:create -- ariadne --mejora "HUB · Auditoría" --priority High

# Normalización dry-run
npm run task:normalize -- jurismate
npm run task:normalize -- jurismate --apply
npm run task:normalize -- --all --apply
```

**Flags de create-task para bugs:**

- `--no-queue` — no encolar
- `--no-start` — no auto-claim aunque la cola esté libre

---

## 10. Despliegue local (macOS)

### 10.1 LaunchAgents

| Plist | Label | Proceso |
|-------|-------|---------|
| `com.ariadne.hub.plist` | `com.ariadne.hub` | `node server.js` |
| `com.ariadne.bug-queue.jurismate.plist` | `com.ariadne.bug-queue.jurismate` | `node scripts/bug-queue-runner.js jurismate` |

**Instalación:**

```bash
cp com.ariadne.hub.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ariadne.hub.plist
launchctl kickstart -k gui/$(id -u)/com.ariadne.hub

cp com.ariadne.bug-queue.jurismate.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.ariadne.bug-queue.jurismate.plist
launchctl kickstart -k gui/$(id -u)/com.ariadne.bug-queue.jurismate
```

**Logs:**

- `/tmp/ariadne-hub.log`
- `/tmp/ariadne-bug-queue-jurismate.log`

**Reinicio rápido:**

```bash
launchctl kickstart -k gui/$(id -u)/com.ariadne.hub
```

### 10.2 Variables de entorno

| Variable | Default | Componente |
|----------|---------|------------|
| `ARIADNE_HUB_PORT` | `4177` | Hub |
| `ARIADNE_BOARD_PORT` | `6421` | Kanban + scripts |
| `ARIADNE_BOARD_HOST` | `127.0.0.1` | Runner |
| `ARIADNE_HUB_URL` | `http://127.0.0.1:6421` | Runner |
| `ARIADNE_QUEUE_POLL_MS` | `5000` | Runner |

### 10.3 Dependencias

- **Node.js 18+** (20 recomendado)
- **Python 3** — validación de ledgers
- **backlog.md** (npm) — CLI para estados y ordinales

---

## 11. Tests

`npm test` ejecuta la suite nativa de Node (`node --test`):

| Archivo | Ámbito |
|---------|--------|
| `server.test.js` | parseTask, prioridades, cola, summarize, queueBoardPage, CRUD |
| `task-ids.test.js` | Allocación IDs, createTaskFile |
| `task-id-normalize.test.js` | Migración legacy, colisiones |
| `bug-queue.test.js` | bugQueueState, buildBugRunInstruction |
| `bugs-board.test.js` | isBugTask, temas, stats, HTML |
| `mejoras-board.test.js` | isImprovementTask, áreas, HTML |
| `board-columns.test.js` | Columnas, STATUS_DISPLAY |
| `board-chrome.test.js` | Nav, conteos |
| `board-delete.test.js` | Reglas de borrado |
| `board-substatus.test.js` | Inferencia substatus |
| `board-task-detail.test.js` | Modal, checklist |
| `test_check_plan.py` | Ledgers, ciclos de dependencias |

---

## 12. Mapa de archivos clave

```
Ariadne/
├── server.js                          # Núcleo: HTTP, APIs, lógica de tareas
├── projects.json                      # Catálogo local (no versionado)
├── projects.example.json              # Plantilla de catálogo
├── package.json                       # Scripts npm
├── backlog.config.yml                 # Config Backlog.md del repo Ariadne
│
├── task-ids.js                        # IDs tipados B/E, creación de archivos
├── task-id-normalize.js               # Migración y auto-fix de IDs
├── bug-queue.js                       # Estado de cola, instrucciones de run
│
├── bugs-board.js                      # Tablero + stats de bugs
├── mejoras-board.js                   # Tablero + stats de mejoras
├── board-columns.js                   # Definición 4 columnas
├── board-column-filter.js             # Matching tarea ↔ columna
├── board-card-interaction.js          # Drag/drop, click
├── board-task-detail.js               # Modal detalle + checklist
├── board-substatus.js                 # Substatus en Doing
├── board-delete.js                    # Borrado de tareas
├── board-chrome.js                    # Nav tabs, banners
├── board-create.js                    # Alta rápida en tablero
├── board-stats.js                     # Paneles analytics
├── board-queue.js                     # Estilos/helpers columna Queue
│
├── public/
│   ├── index.html                     # Hub UI
│   ├── app.js                         # Cliente Hub
│   └── styles.css                     # Estilos Hub
│
├── scripts/
│   ├── create-task.js                 # CLI crear tarea
│   ├── bug-queue-runner.js            # Daemon cola bugs
│   ├── queue-complete.js              # Marcar Done
│   └── migrate-task-ids.js          # Normalización IDs
│
├── skills/ariadne/
│   ├── SKILL.md                       # Skill agente (gobernanza)
│   └── scripts/
│       ├── check_plan.py              # Validador ledger
│       └── test_check_plan.py         # Tests Python
│
├── docs/
│   ├── ARQUITECTURA.md                # Este documento
│   └── plans/
│       ├── ariadne-local.md           # Ledger gobernanza hub
│       └── ariadne-mejoras.md         # Ledger mejoras producto
│
├── backlog/tasks/                     # Tareas del propio hub (prefijo AH)
│
├── com.ariadne.hub.plist              # LaunchAgent Hub
└── com.ariadne.bug-queue.jurismate.plist  # LaunchAgent runner
```

---

## 13. Decisiones de diseño relevantes

1. **Un solo puerto Kanban (`6421`)** — El proyecto se selecciona por query string, no por puerto. El campo `port` en `projects.json` es informativo.

2. **HTML server-side** — Los tableros se generan como strings HTML en Node, no SPA. Reduce complejidad; el JS embebido maneja drag, modal y fetch.

3. **Sin base de datos** — Git + Markdown son la fuente de verdad. Facilita auditoría y trabajo con agentes.

4. **Cola ordinal, no por prioridad** — En Queue el orden manual (drag) manda; la prioridad ordena To Do/Doing.

5. **Un bug activo a la vez** — El runner y `claimNextBug()` garantizan serialización de fixes de bugs.

6. **Gobernanza separada de ejecución** — `check_plan.py` no lee backlog; Ariadne no valida ledgers en runtime. Son capas complementarias.

7. **Reemplazo de JurisMate hub** — Este repo sustituye `JurisMate/tools/ariadne-hub`. El LaunchAgent viejo `com.jurismate.ariadne-hub` debe permanecer apagado para evitar conflicto en puerto 4177.

---

## 14. Flujos de uso típicos

### 14.1 Operador humano

1. Abre Hub → elige proyecto → "Abrir bugs"
2. Arrastra tarjeta To Do → Queue → Doing
3. Click en tarjeta → modal → edita Markdown / checklist
4. Mueve a Done cuando termina

### 14.2 Agente externo vía API

```bash
# Crear bug de producción
curl -X POST 'http://127.0.0.1:6421/api/bugs/create?project=jurismate' \
  -H 'content-type: application/json' \
  -d '{"title":"BUG · ...","priority":"Ultra High"}'

# Consultar cola
curl 'http://127.0.0.1:6421/api/queue/bugs?project=jurismate'

# Marcar terminado
npm run queue:complete -- jurismate JM-B-23
```

### 14.3 Agente con runner automático

1. LaunchAgent `com.ariadne.bug-queue.jurismate` hace poll
2. Al claim, lee `{proyecto}/.ariadne/bug-queue/current.md`
3. Ejecuta fix en el repo del proyecto
4. Marca Done → runner toma el siguiente

### 14.4 Planificación con ledger

1. Editar `docs/plans/ariadne-local.md`
2. Validar: `python3 skills/ariadne/scripts/check_plan.py docs/plans/ariadne-local.md`
3. Crear tareas de backlog referenciadas por ID en el registro maestro
4. Ejecutar en Kanban; actualizar evidencia en ledger al cerrar gates

---

## 15. Limitaciones conocidas

| Limitación | Detalle |
|------------|---------|
| Solo local | Sin auth, sin acceso remoto, sin multi-usuario |
| Parser YAML parcial | Frontmatter parseado con regex; YAML complejo puede fallar |
| Un board port | Todos los proyectos comparten `:6421` |
| Runner mono-proyecto | Un LaunchAgent por slug de proyecto |
| Sin webhook | Integraciones vía polling o CLI |
| `projects.json` local | Cada máquina tiene su catálogo; no se versiona |

---

## 16. Referencias rápidas

| Recurso | URL / comando |
|---------|---------------|
| Hub | http://127.0.0.1:4177 |
| Kanban JurisMate bugs | http://127.0.0.1:6421/?project=jurismate&view=bugs |
| Kanban Ariadne | http://127.0.0.1:6421/?project=ariadne&view=mejoras |
| README usuario | `/README.md` |
| Skill agente | `/skills/ariadne/SKILL.md` |
| Validar ledger | `python3 skills/ariadne/scripts/check_plan.py docs/plans/ariadne-local.md` |
| Tests | `npm test` |
