# Ariadne Gantt — Documento técnico funcional

Guía clara de qué hace el Gantt, cómo se conecta con Ariadne, qué datos usa y cómo operarlo.

**Versión:** post-`33f996a` · **Hub:** `http://127.0.0.1:4177` · **UI Gantt:** `http://localhost:63447`

---

## 1. Qué problema resuelve

El **Kanban** responde: *¿qué hago ahora?* (To Do → Queue → Doing → Done).

El **Gantt** responde: *¿cuándo puedo hacer cada cosa, en qué orden, y cuánto tarda el proyecto completo?*

Concretamente:

- Proyecta fechas de inicio y fin por tarea
- Respeta **dependencias** entre tareas (una no arranca hasta que otra cumpla su restricción)
- Modela **paralelismo** según capacidad (cuántos trabajos simultáneos hay)
- Calcula **ruta crítica** (cadena que más tiempo consume)
- Distingue carriles **bugs** vs **mejoras** en el timeline
- Usa calendario laboral colombiano (festivos, fines de semana)

---

## 2. Arquitectura en dos piezas

```
  Hub (4177)                Backend Ariadne              UI Gantt (63447)
 ┌─────────────┐           ┌──────────────────┐         ┌─────────────────┐
 │ Abrir Gantt │ ──abre──► │ buildProjectGantt│ ◄─fetch─│ Barras, flechas,│
 │ por proyecto│           │ + APIs JSON      │         │ calendario      │
 └─────────────┘           └──────────────────┘         └─────────────────┘
                                    ▲
                                    │ lee
                           backlog/tasks/*.md
                           ai-capacity.config.json
```

| Pieza | Dónde vive | Rol |
|-------|------------|-----|
| **Motor de planificación** | `server.js` → `buildProjectGantt()` | Lee backlog, calcula fechas, dependencias, ruta crítica |
| **API REST** | Hub `:4177` | Entrega JSON al frontend |
| **UI visual** | App externa `:63447` | Dibuja el diagrama de Gantt |
| **Entrada usuario** | Hub → botón **Abrir Gantt** | Abre `http://localhost:63447/?project={slug}` |

> **Importante:** el código del gráfico visual **no está en el repo Ariadne**. Este repo implementa el **cerebro** (scheduling + persistencia). La UI es un frontend separado que consume la API.

Configuración de la URL de la UI:

- Variable de entorno: `ARIADNE_GANTT_BASE_URL` (default `http://localhost:63447/`)
- O consulta: `GET /api/hub-config` → `{ "ganttBaseUrl": "..." }`

---

## 3. Flujo de uso

### 3.1 Desde el Hub

1. Abre `http://127.0.0.1:4177`
2. En la tarjeta del proyecto, pulsa **Abrir Gantt**
3. Se abre una ventana en `:63447/?project=jurismate` (ejemplo)
4. La UI pide el plan a Ariadne y lo renderiza

### 3.2 Desde la API (sin UI)

```bash
curl -s "http://127.0.0.1:4177/api/projects/jurismate/gantt?capacity=2&includeDone=0&startDate=2026-08-04"
```

### 3.3 Editar dependencias de una tarea

```bash
curl -s -X POST "http://127.0.0.1:4177/api/projects/jurismate/tasks/dependencies" \
  -H "content-type: application/json" \
  -d '{
    "id": "JM-E-2",
    "dependencies": [
      { "id": "JM-E-1", "relation": "FS" },
      { "id": "JM-E-10", "relation": "SS", "lagValue": 1, "lagUnit": "d" }
    ]
  }'
```

Los cambios se guardan en el frontmatter YAML del archivo Markdown de la tarea.

---

## 4. Datos de entrada (backlog)

El Gantt lee las mismas tareas que el Kanban, en `{proyecto}/backlog/tasks/` (y también `completed/`, `archive/`).

### 4.1 Campos que usa el planificador

| Campo YAML | Alternativas | Uso |
|------------|--------------|-----|
| `id` | — | Identificador (`JM-E-1`) |
| `title` | — | Etiqueta en barras |
| `status` | — | `Done` se excluye del plan pendiente (salvo `includeDone=1`) |
| `priority` | — | Desempate al asignar slots; default de duración |
| `type` | — | `bug` → carril bugs; resto → mejoras |
| `ordinal` | — | Desempate secundario |
| `dependencies` | — | Lista de predecesoras (ver §5) |
| `estimate_days` | `effort_days`, `duration_days` | Duración en días hábiles |
| `estimate_ia_hours` | `estimate_hours`, `effort_hours` | Duración en horas IA |
| `created_date`, `updated_date`, `due_date`, `started_date` | — | Metadatos opcionales |

### 4.2 Duración si no hay estimación

| Prioridad | Días default |
|-----------|--------------|
| Ultra High | 4 |
| High | 3 |
| Medium | 2 |
| Low | 1 |

Si hay `estimate_ia_hours`, manda sobre días. Si solo hay días, se multiplican por `iaHoursPerDay` (default 8).

### 4.3 Ejemplo de tarea planificable

```yaml
---
id: JM-E-14
title: API de exportación PDF
status: To Do
priority: High
type: feature
estimate_days: 3
dependencies:
  - JM-E-10:FS
  - JM-E-12:SS+1d
---
```

---

## 5. Dependencias tipadas

Formato canónico en frontmatter:

```
TASK_ID:RELATION[+/-][N][d|h]
```

| Token | Significado |
|-------|-------------|
| `JM-E-10` | Legacy: equivale a `JM-E-10:FS` sin lag |
| `JM-E-10:FS` | **Finish-to-Start:** B empieza cuando A termina |
| `JM-E-10:SS+1d` | **Start-to-Start:** B empieza 1 día después de que A arranca |
| `JM-E-10:FF+8h` | **Finish-to-Finish:** B termina 8h IA después de que A termina |
| `JM-E-10:SF-1d` | **Start-to-Finish:** B termina 1 día antes/después del inicio de A |

Unidades de lag:

- `d` — días hábiles (convertidos a horas IA según `iaHoursPerDay`)
- `h` — horas IA directas

### Semántica de scheduling

| Relación | Restricción sobre la sucesora |
|----------|-------------------------------|
| **FS** | `start(B) ≥ end(A) + lag` |
| **SS** | `start(B) ≥ start(A) + lag` |
| **FF** | `end(B) ≥ end(A) + lag` |
| **SF** | `end(B) ≥ start(A) + lag` |

Las relaciones **SS** y **FF** permiten solapamiento (paralelismo parcial). **FS** y **SF** tienden a secuencia.

---

## 6. Motor de planificación (`buildProjectGantt`)

Implementación en `server.js`. Resumen del algoritmo:

```
1. Cargar tareas del proyecto
2. Separar Done vs pendientes
3. Parsear dependencias → grafo dirigido
4. Para cada tarea pendiente:
   - Calcular durationIaHours
   - Filtrar dependencias que apuntan a tareas aún pendientes
5. Simular timeline hora a hora:
   - Máximo `capacity` tareas corriendo a la vez
   - Una tarea solo arranca si:
     a) Hay slot libre
     b) Sus predecesoras ya están planificadas
     c) Se cumple la restricción FS/SS/FF/SF + lag
   - Desempate: prioridad → ordinal → título
6. Convertir horas IA → fechas reales (calendario laboral)
7. Calcular ruta crítica, grupos paralelos, aristas para dibujar flechas
8. Devolver JSON
```

### Calendario laboral

- Base: lunes–viernes
- Festivos Colombia (fijos, Ley Emiliani, Semana Santa)
- Sábado opcional: `?workOnSaturday=1`
- Festivos extra: `?holidays=2026-12-24,2026-12-31`
- Fecha inicio: `?startDate=2026-08-04` (default: hoy)

### Capacidad (paralelismo)

Parámetro `capacity` = cuántas tareas pueden estar **activas simultáneamente**.

- Query: `?capacity=3`
- Si se omite: lee `{proyecto}/backlog/docs/ai-capacity.config.json` y calcula `effectiveCapacityFromConfig()`

Ese archivo puede definir:

- `capacity` — capacidad humana base
- `operators[]` — operadores con `maxParallel`, `hoursPerDay`
- `aiModels[]` — modelos IA con slots paralelos y si requieren operador

El motor toma el **mínimo** entre capacidad humana, slots de modelos activos y operadores disponibles.

---

## 7. API de referencia

Base: `http://127.0.0.1:4177`

### 7.1 Configuración del Hub

```
GET /api/hub-config
```

```json
{
  "ganttBaseUrl": "http://localhost:63447/",
  "hubPort": 4177,
  "boardPort": 6421
}
```

### 7.2 Plan Gantt

```
GET /api/projects/{slug}/gantt
```

| Query | Default | Descripción |
|-------|---------|-------------|
| `capacity` | de config o `2` | Tareas en paralelo (1–12) |
| `includeDone` | `1` | Incluir `doneTimeline` |
| `iaHoursPerDay` | `8` | Horas IA por día hábil |
| `startDate` | hoy | Inicio del calendario (`YYYY-MM-DD`) |
| `workOnSaturday` | `0` | `1` = sábados laborables |
| `holidays` | — | CSV de fechas ISO extra |

### 7.3 Capacidad IA

```
GET  /api/projects/{slug}/ai-capacity-config
POST /api/projects/{slug}/ai-capacity-config
GET  /api/projects/{slug}/ai-operators
POST /api/projects/{slug}/ai-operators
```

Archivo persistido: `{proyecto}/backlog/docs/ai-capacity.config.json`

### 7.4 Dependencias de tarea

```
POST /api/projects/{slug}/tasks/dependencies
```

Body:

```json
{
  "id": "JM-E-2",
  "dependencies": [
    "JM-E-1",
    { "id": "JM-E-3", "relation": "FF", "lagValue": 2, "lagUnit": "d" }
  ]
}
```

Validaciones:

- ID de tarea obligatorio
- No autodependencia
- Relación ∈ {FS, SS, FF, SF}
- Tokens duplicados eliminados
- Predecesora inexistente → error 400

---

## 8. Respuesta JSON del Gantt (estructura)

Fragmento orientativo de `GET .../gantt`:

```json
{
  "project": { "slug": "jurismate", "name": "JurisMate" },
  "parameters": {
    "capacity": 2,
    "includeDone": false,
    "iaHoursPerDay": 8,
    "startDate": "2026-08-04",
    "holidays": ["2026-01-01", "..."],
    "workOnSaturday": false
  },
  "summary": {
    "totalTasks": 86,
    "doneTasks": 81,
    "pendingTasks": 5,
    "completionRate": 94,
    "estimatedPendingIaHours": 40,
    "estimatedPendingDays": 6,
    "blockedByDependencies": 1,
    "unresolvedDependencies": 0,
    "cycleDetected": false
  },
  "criticalPath": {
    "estimatedIaHours": 40,
    "route": [
      { "id": "JM-E-1", "title": "...", "durationIaHours": 16 },
      { "id": "JM-E-2", "title": "...", "durationIaHours": 24 }
    ]
  },
  "parallelGroups": [
    { "startIaHour": 0, "startDate": "2026-08-04", "ids": ["JM-E-5", "JM-E-6"] }
  ],
  "dependencyEdges": [
    {
      "fromId": "JM-E-1",
      "toId": "JM-E-2",
      "relation": "FS",
      "fromAnchor": "end",
      "toAnchor": "start",
      "lagBusinessDays": 0,
      "lagIaHours": 0,
      "sequential": true
    }
  ],
  "tasks": [
    {
      "id": "JM-E-2",
      "title": "API exportación",
      "status": "To Do",
      "priority": "High",
      "lane": "mejoras",
      "durationDays": 3,
      "durationIaHours": 24,
      "startDay": 2,
      "endDay": 5,
      "startDate": "2026-08-06",
      "endDate": "2026-08-08",
      "startIaHour": 16,
      "endIaHour": 40,
      "canRunInParallel": false,
      "pendingDependencies": ["JM-E-1"]
    }
  ],
  "dayMarkers": [ "..." ],
  "monthMarkers": [ "..." ],
  "doneTimeline": [],
  "generatedAt": "2026-08-04T16:00:00.000Z"
}
```

### Campos clave para la UI

| Campo | Uso en el gráfico |
|-------|-------------------|
| `tasks[]` | Barras horizontales por fila |
| `tasks[].lane` | Agrupar bugs vs mejoras |
| `tasks[].startDate` / `endDate` | Posición en eje temporal |
| `dependencyEdges[]` | Flechas entre barras (anclas start/end) |
| `dayMarkers` / `monthMarkers` | Rejilla del calendario |
| `parallelGroups` | Resaltar tareas que arrancan juntas |
| `criticalPath.route` | Resaltar cadena crítica |
| `summary.cycleDetected` | Alerta si hay ciclo o tareas irresolubles |

---

## 9. Gantt vs Kanban vs Cola de bugs

| Dimensión | Kanban | Gantt |
|-----------|--------|-------|
| Pregunta | ¿Qué ejecuto hoy? | ¿Cuándo termina todo? |
| Estado | Manual (drag) | Calculado (proyección) |
| Dependencias | No bloquean movimiento | Bloquean fechas de inicio |
| Paralelismo | Cola ordinal manual | Capacidad + relaciones SS/FF |
| Bugs urgentes | Cola automática (`bug-queue`) | Aparecen en carril `bugs` |
| Persistencia | Cambia archivos al mover | Solo lee + API de dependencias |

Son complementarios: el Gantt **planifica**; el Kanban **ejecuta**.

---

## 10. Operación y diagnóstico

### Arrancar / reiniciar backend

```bash
launchctl kickstart -k gui/$(id -u)/com.ariadne.hub
```

### Smoke test

```bash
# Config
curl -s http://127.0.0.1:4177/api/hub-config

# Plan
curl -s "http://127.0.0.1:4177/api/projects/jurismate/gantt?includeDone=0" \
  | python3 -m json.tool | head -80

# Capacidad IA
curl -s http://127.0.0.1:4177/api/projects/jurismate/ai-capacity-config
```

Script auxiliar: `scripts/check-ai-capacity-config.sh`

### Señales de problemas

| Síntoma | Causa probable | Acción |
|---------|----------------|--------|
| `cycleDetected: true` | Ciclo de dependencias | Revisar `dependencies` en frontmatter |
| `unresolvedDependencies > 0` | ID de predecesora inexistente o typo | Corregir ID o crear tarea |
| UI vacía en :63447 | Frontend Gantt no levantado | Arrancar app en puerto 63447 |
| Fechas extrañas | Sin `estimate_*` | Añadir `estimate_days` o `estimate_ia_hours` |
| Todo serial | `capacity=1` | Subir capacity o configurar ai-capacity |
| Hub devuelve 404 en `/gantt` | Hub viejo corriendo | `launchctl kickstart -k ...` |

### Tests automatizados

```bash
npm test
```

Casos relevantes en `server.test.js`:

- Dependencias antes que dependientes
- Capacidad 1 vs 2 (serial vs paralelo)
- Relaciones FS/SS/FF/SF con lag
- Persistencia HTTP de dependencias
- Capacidad efectiva desde `ai-capacity.config.json`

---

## 11. Documentación relacionada

| Archivo | Contenido |
|---------|-----------|
| `docs/plans/dependency-relations-project-style.md` | Diseño de dependencias tipo MS Project |
| `docs/plans/dependency-relations-migration-ops.md` | Guía operativa y migración legacy |
| `docs/ARQUITECTURA.md` | Arquitectura general de Ariadne |
| `README.md` | Inicio rápido Hub/Kanban |

---

## 12. Resumen en una frase

**El Gantt de Ariadne lee el backlog Markdown de un proyecto, aplica un calendario laboral colombiano, respeta dependencias FS/SS/FF/SF con lag, simula paralelismo según capacidad IA/humana, y expone un plan JSON con fechas, ruta crítica y aristas — que una UI externa en `:63447` convierte en diagrama visual.**
