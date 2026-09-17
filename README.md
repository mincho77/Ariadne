# Ariadne

**Hub local multiproyecto** con Kanban, Gantt y auditoría Git. **Diseñado para agentes IA**: tu LLM puede crear tareas, leer queue, ejecutar en orden y marcar done automáticamente.

**Ideal para:**
- Equipo humano + agentes IA trabajando juntos
- Monitoreo automático → creación de bugs
- Planes de IA que se sincronizan a Gantt
- Auditoría completa (todo en Git)

## Requisitos

- Node.js 18+ (recomendado 20)
- Python 3 (para `skills/ariadne/scripts/check_plan.py`)

## Inicio rápido

```bash
npm install
npm start
```

- **Hub:** http://127.0.0.1:4177
- **Kanban demo:** http://127.0.0.1:6421/?project=demo
- **Kanban Ariadne (este repo):** http://127.0.0.1:6422/?project=ariadne

En el detalle de cualquier tarea del Kanban, usa **Editar texto** para modificar el Markdown completo y **Guardar cambios**.

**Tablero de bugs:** http://127.0.0.1:6421/?project=demo&view=bugs  
**Tablero de mejoras:** http://127.0.0.1:6421/?project=demo&view=mejoras  

El Hub muestra dos carriles separados por proyecto. Al abrir un tablero sin `view`, redirige a bugs si hay abiertos; si no, a mejoras. Ya no hay vista mixta por defecto.

---

## 🤖 Integración con Agentes IA

Ariadne está diseñado para trabajar con agentes IA (LLMs, código gen, análisis automático). El flujo típico es:

1. **IA genera plan** (del análisis de logs, PRs, issues)
2. **Crea tareas en Ariadne** via API
3. **Ariadne ejecuta queue automáticamente**
4. **IA lee estado** y ejecuta tareas en orden
5. **Todo queda auditado** en Git

### Arquitectura: IA + Ariadne

```
┌─────────────────────────────────────────┐
│  Agente IA (GitHub Copilot, Claude, etc)
│  - Analiza código/logs
│  - Genera plan de tareas
│  - Ejecuta tareas en orden
└──────────────┬──────────────────────────┘
               │ HTTP/REST API
               ▼
┌─────────────────────────────────────────┐
│  Ariadne Server (localhost:6421)
│  - Queue de tareas
│  - Validación Gantt
│  - Ledger (auditoría)
│  - UI Kanban
└──────────────┬──────────────────────────┘
               │ Lee/escribe archivos
               ▼
┌─────────────────────────────────────────┐
│  Markdown + Git
│  - backlog/tasks/
│  - .ariadne/ledger/
│  - projects.json
│  (versionable, auditable)
└─────────────────────────────────────────┘
```

### APIs Disponibles para IA

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/queue/bugs?project=X` | GET | Ver estado de queue |
| `/api/tasks/{id}` | GET | Obtener detalles de tarea |
| `/api/bugs/create?project=X` | POST | Crear bug |
| `/api/tasks/create?project=X` | POST | Crear tarea genérica |
| `/api/tasks/{id}/update` | POST | Actualizar tarea |
| `/api/projects/{slug}/gantt` | GET | Ver plan Gantt |

**Casos de uso completos con código:** Ver sección "Casos 1-4" más abajo en README.

---

## 🎯 ¿Cómo Funciona?

### Arquitectura General

Ariadne es un **Hub local multiproyecto** que:

1. **Lee archivos Markdown** del disco (no usa base de datos)
2. **Sirve una UI web** (Kanban + Hub + Portafolio) via Node.js
3. **Permite editar tareas** directamente en la UI
4. **Guarda cambios en Markdown** (versionable con Git)
5. **Calcula calendarios Gantt** y restricciones temporales

**Ventajas:**
- ✅ Todo es Git-versionable (auditoría completa)
- ✅ Funciona offline (no requiere cloud)
- ✅ Portable (clona el repo en otra máquina y funciona)
- ✅ Extensible (puedes agregar scripts custom)

### Flujo de Datos

```
Markdown Files (disco)
    ↓
    ├─ projects.json       (meta de proyectos)
    ├─ backlog/*.md        (tareas y planes)
    └─ projects/*/        (proyectos específicos)
    ↓
server.js (Node.js)
    ├─ Parsea YAML frontmatter
    ├─ Calcula Gantt + restricciones
    ├─ Resuelve dependencias
    └─ Sirve APIs REST
    ↓
public/ (UI)
    ├─ Hub (visión 30k pies)
    ├─ Kanban (boards por proyecto)
    ├─ Portfolio (Gantt visual)
    └─ Editor de tareas
    ↓
Usuario edita en UI → Guardado en Markdown
                  ↓
            Git commit
        (auditoría permanente)
```

### Conceptos Clave

#### 1. **Proyectos**
- Definidos en `projects.json`
- Cada proyecto tiene un código (ej: `jm`, `ah`)
- Pueden ser locales o externos (reference)

#### 2. **Tareas (Tasks)**
- Formato: Markdown + YAML frontmatter
- Tipos: `bug`, `enhancement`, `milestone`
- Estados: `Queue` → `Doing` → `Done`
- Ubicación: `backlog/tasks/` o `projects/{project}/`

**Ejemplo de tarea:**
```markdown
---
type: bug
priority: High
status: Doing
estimate_days: 2
not_before: 2026-09-20
dependencies:
  - AH-E-5
---

# PD-B-23: Upload congela en producción

Cuando subes un archivo > 100MB, el servidor se congela por 30 segundos.

## Steps to reproduce
1. Abre Dashboard
2. Click en "Upload"
3. Sube archivo > 100MB
```

#### 3. **Kanban Board**
- **Queue:** Tareas entrantes, sin asignar
- **Doing:** Tarea actual en ejecución
- **Done:** Completadas (no se elimina, se archiva)

**Automático:**
- Runner de cola (`npm run queue:bugs`) mueve tareas automáticamente
- Al completar, libera slot para siguiente

#### 4. **Gantt (Planificación)**
- Calcula fechas start/finish basado en:
  - `not_before` (restricción mínima)
  - `blocked_until` (fechas bloqueadas)
  - `dependencies` (tareas previas)
  - `estimate_days` (duración)
- Respeta calendario colombiano (holidays, weekends)
- Valida conflictos y proyecta finish reales

#### 5. **Ledger (Auditoría)**
- Registro inmutable de cambios
- Ubicación: `<proyecto>/.ariadne/ledger/`
- Formatos: JSON + Markdown para legibilidad

### Ciclo de Vida de un Bug

```
1. ENTRA (vía Kanban o API)
   └─ Se crea tarea en backlog/tasks/
   └─ Se asigna ID automático (PD-B-24)
   └─ Estado: Queue (sin asignar)

2. QUEUE (en cola)
   └─ Espera que runner la procese
   └─ Runner de cola la detecta

3. DOING (en ejecución)
   └─ Runner mueve a Doing
   └─ Escribe instrucción en .ariadne/bug-queue/current.md
   └─ Desarrollador ejecuta pasos

4. DONE (completada)
   └─ `npm run queue:complete -- demo PRJ-B-24`
   └─ Se archiva en Done
   └─ Ledger registra fin de ejecución
   └─ Runner toma siguiente bug de Queue

5. LEDGER (auditoría)
   └─ Cada cambio queda registrado
   └─ Git commit con evidencia
```

### Rol del Server

**server.js** hace:

1. **Parse de tareas** — Lee Markdown + YAML, valida estructura
2. **API REST** — Endpoints para crear/actualizar/completar tareas
3. **UI Server** — Sirve Kanban, Hub, Portfolio
4. **Gantt Engine** — Calcula fechas, restricciones, conflictos
5. **Queue Manager** — Coordina tareas en Queue/Doing/Done

**Puertos:**
- `4177` — Hub (visión general)
- `6421` — Kanban de demo
- `6422` — Kanban Ariadne
- (configurables en `server.js`)

### Flujo de Edición

```
Usuario en Kanban
    ↓ Click "Editar texto"
    ↓ Modal abre con Markdown + YAML
    ↓ Edita frontmatter (meta) y contenido
    ↓ Click "Guardar cambios"
    ↓ POST a /api/tasks/update
    ↓ Server valida YAML
    ↓ Escribe en disco (Markdown file)
    ↓ Recalcula Gantt
    ↓ Refresh UI (WebSocket o polling)
    ↓ Todo versionable en Git ✓
```

---

## 📝 IDs de Tareas

Cada proyecto usa un código de dos letras en `projects.json` (`taskCode`). Las tareas nuevas siguen la convención:

- **Bug:** `{CODE}-B-{n}` → `PD-B-1`, `AH-B-3` (errores de producción)
- **Mejora:** `{CODE}-E-{n}` → `PD-E-1`, `AH-E-2` (features nuevas)

**Ejemplo:**
```json
// projects.json
{
  "demo": {
    "code": "PRJ",         // Código del proyecto
    "taskCode": "demo",    // Lowercase para URLs
    "name": "Proyecto Demo",
    "slug": "demo"
  }
}
```

Cuando creas un bug en el proyecto demo, automáticamente obtiene `PRJ-B-1`, `PRJ-B-2`, etc.

### Normalización de IDs

Si heredas tareas con IDs inconsistentes (legacy, código incorrecto, etc), Ariadne puede limpiarlos:

```bash
# Modo dry-run (solo muestra qué cambiaría)
npm run task:normalize -- demo

# Aplica los cambios
npm run task:normalize -- demo --apply

# Normaliza todos los proyectos
npm run task:normalize -- --all --apply
```

**Qué normaliza:**
- Corrige código de proyecto incorrecto
- Cambia B/E incorrecto (PD-1 → PD-B-1)
- Llena huecos en secuencia (si faltan números)
- Valida formato YAML

---

## 🚀 Crear y Editar Tareas

### Opción 1: Desde la UI Kanban

1. Abre el Kanban: `http://127.0.0.1:6421/?project=demo`
2. Click en **+ New bug** o **+ New enhancement**
3. Llena titulo, descripción, prioridad
4. En "Editar texto" puedes agregar YAML completo

**Ventaja:** Visual, rápido.

### Opción 2: Comando CLI (Local)

```bash
# Crear bug
npm run task:create -- demo --bug "BUG producción · Upload congela"

# Crear mejora con plantilla
npm run task:create -- demo --mejora "Mejora de ranking" --template enhancement

# Crear con plantilla swarm (workflows)
npm run task:create -- ariadne --enhancement "HUB · Auditoría" --template swarm
```

Las plantillas se define en `docs/ac-templates.md`.

### Opción 3: Desde Afuera (API + Curl)

Crear bug que entra directo a Queue:

```bash
curl -X POST 'http://127.0.0.1:6421/api/bugs/create?project=demo' \
  -H 'content-type: application/json' \
  -d '{
    "title": "BUG producción · Upload congela",
    "priority": "Ultra High",
    "description": "El servidor se congela 30s al subir archivos > 100MB"
  }'
```

Respuesta: `{ "id": "PRJ-B-42", "status": "Queue" }`

Crear tarea genérica:

```bash
curl -X POST 'http://127.0.0.1:6421/api/tasks/create?project=demo' \
  -H 'content-type: application/json' \
  -d '{
    "title": "Mejora dashboard",
    "type": "enhancement",
    "priority": "High"
  }'
```

**Ventaja:** Automático, ideal para webhooks o integraciones.

### Opción 4: Editar YAML Completo

En el Kanban, click **Editar texto** de cualquier tarea:

```markdown
---
type: bug
priority: Ultra High
status: Queue
estimate_days: 2
not_before: 2026-09-20
blocked_until: 2026-09-18
dependencies:
  - PRJ-E-5
  - AH-B-2
---

# PRJ-B-42: Upload congela en producción

Problema: El servidor se congela 30 segundos.

## Steps to reproduce
1. Abre Dashboard
2. Click en "Upload"
3. Sube archivo > 100MB

## Expected
Upload debe completar en < 10 segundos

## Actual
Servidor congela, timeout en cliente
```

Los cambios se guardan al click en "Guardar cambios".

---

## 🔄 Queue & Runner (Ejecución Automática)

### Qué es la Queue

- **Queue:** Cola de bugs/tareas esperando ser ejecutados
- **Doing:** Tarea actual en progreso (máximo 1 por proyecto)
- **Done:** Completadas (archivo, no se eliminan)

El **Runner** es un script que automáticamente mueve tareas de Queue → Doing cuando no hay otra en progreso.

### Iniciar el Runner de Bugs

```bash
# Terminal 1 (siempre activa)
npm run queue:bugs -- demo
```

Esto:
1. Detecta bugs nuevos en **Queue**
2. Si no hay un bug en **Doing**, mueve el primero de Queue a Doing
3. Escribe instrucción en `projects/demo/.ariadne/bug-queue/current.md`
4. Espera a que marques el bug como completo

**Output:**
```
🔵 Queue Runner for demo started
⏰ Polling every 5s...
→ Detected PRJ-B-42 in Queue
→ No bug in Doing, moving PRJ-B-42 to Doing
✅ PRJ-B-42 ready at /projects/demo/.ariadne/bug-queue/current.md
⏳ Waiting...
```

### Marcar Tarea como Completa

Una vez que resuelves el bug:

```bash
npm run queue:complete -- demo PRJ-B-42

```

Esto:
1. Mueve PRJ-B-42 a estado **Done**
2. Registra en ledger
3. Runner toma siguiente de Queue automáticamente

### Consultar Cola (API)

```bash
# Ver todos los bugs en Queue
curl -s 'http://127.0.0.1:6421/api/queue/bugs?project=demo' | jq

# Respuesta:
# {
#   "project": "demo",
#   "queue": ["PRJ-B-43", "PRJ-B-44"],
#   "doing": "PRJ-B-42",
#   "done": ["PRJ-B-1", "PRJ-B-2", ...]
# }
```

### Ciclo Completo Ejemplo

```
1. Bug entra:
   curl -X POST 'http://127.0.0.1:6421/api/bugs/create?project=demo' \
     -d '{"title":"Error login","priority":"Ultra High"}'
   → Respuesta: PRJ-B-50 creado en Queue

2. Runner activo:
   npm run queue:bugs -- demo
   → Detecta PRJ-B-50 en Queue
   → Mueve a Doing
   → Escribe instrucción en .ariadne/bug-queue/current.md

3. Desarrollador ejecuta:
   cat projects/demo/.ariadne/bug-queue/current.md
   → Ver descripción del bug
   → Resolver localmente

4. Marcar done:
   npm run queue:complete -- demo PRJ-B-50
   → PRJ-B-50 → Done
   → Ledger registra conclusión
   → Runner toma PRJ-B-51 de Queue si existe

5. Auditoria:
   git log (todos los cambios en ledger)
   cat projects/demo/.ariadne/ledger/PRJ-B-50.json (evidencia)
```

---

## 🤖 Casos de Uso: IA + Ariadne

### Caso 1: IA Analiza Logs → Crea Bugs Automáticamente

**Escenario:** Un agente IA monitorea logs de producción cada 5 minutos y crea bugs automáticamente cuando detecta errores.

```python
#!/usr/bin/env python3
# ai-monitor-logs.py
import requests
import json
from datetime import datetime

ARIADNE_API = "http://127.0.0.1:6421/api"

def analyze_logs():
    """IA lee logs de producción"""
    # Aquí iría llamada a tu modelo IA
    # Por ejemplo: llamar a Claude API o local LLM
    critical_errors = [
        {"title": "Upload timeout en S3", "priority": "Ultra High", "description": "Error 504 en 2% de requests"},
        {"title": "Memory leak en worker", "priority": "High", "description": "RSS crece 50MB/hora"}
    ]
    return critical_errors

def create_bug_in_ariadne(title, priority, description):
    """Crea bug en Ariadne via API"""
    payload = {
        "title": title,
        "priority": priority,
        "description": description,
        "type": "bug"
    }
    
    response = requests.post(
        f"{ARIADNE_API}/bugs/create?project=project-demo",
        json=payload
    )
    
    result = response.json()
    print(f"✅ Creado {result['id']}: {title}")
    return result['id']

def main():
    errors = analyze_logs()
    for error in errors:
        create_bug_in_ariadne(
            title=error['title'],
            priority=error['priority'],
            description=error['description']
        )

if __name__ == "__main__":
    main()
```

**Resultado:** Todos los bugs críticos automáticamente en Queue de Ariadne → El runner los mueve a Doing → El equipo ve en Kanban.

### Caso 2: IA Lee Queue → Ejecuta Tareas en Orden

**Escenario:** El agente IA continuamente lee la queue, toma la siguiente tarea y la ejecuta (gen de código, análisis, refactor).

```javascript
// ai-task-executor.js
const axios = require('axios');

const API = 'http://127.0.0.1:6421/api';
const PROJECT = 'ariadne';

async function getQueueStatus() {
  const response = await axios.get(`${API}/queue/bugs?project=${PROJECT}`);
  return response.data;
}

async function getCurrentTask(doing_id) {
  const response = await axios.get(`${API}/tasks/${doing_id}`);
  return response.data;
}

async function updateTask(task_id, status, result) {
  const payload = {
    status: status,
    evidence: result,
    completed_at: new Date().toISOString()
  };
  
  await axios.post(`${API}/tasks/${task_id}/update`, payload);
}

async function executeAITask(task) {
  console.log(`📋 Ejecutando ${task.id}: ${task.title}`);
  
  try {
    // Aquí va la lógica de IA
    // Ejemplo: si es refactor, llamar a Claude API para generar mejoras
    const result = await runAIAnalysis(task.content);
    
    // Marcar como Done y guardar resultado
    await updateTask(task.id, 'Done', result);
    console.log(`✅ ${task.id} completada`);
    
  } catch (error) {
    console.error(`❌ Error en ${task.id}:`, error.message);
    await updateTask(task.id, 'Error', error.message);
  }
}

async function aiLoop() {
  console.log('🤖 IA Task Executor iniciado');
  
  while (true) {
    try {
      const queue = await getQueueStatus();
      
      // Si hay tarea en Doing y no está en progreso, ejecutarla
      if (queue.doing) {
        const task = await getCurrentTask(queue.doing);
        if (task.status === 'Doing') {
          await executeAITask(task);
        }
      }
      
      // Esperar 30 segundos antes de siguiente check
      await new Promise(resolve => setTimeout(resolve, 30000));
      
    } catch (error) {
      console.error('❌ Loop error:', error.message);
      await new Promise(resolve => setTimeout(resolve, 60000));
    }
  }
}

async function runAIAnalysis(content) {
  // Aquí llamarías a tu modelo IA (Claude, GPT, local LLM, etc)
  // Ejemplo placeholder:
  return `IA Analysis: ${content.substring(0, 100)}... processed`;
}

aiLoop();
```

**Flujo:**
```
1. IA ejecuta aiLoop()
2. Cada 30s chequea: ¿hay tarea en Doing?
3. Si sí, obtiene detalles y ejecuta análisis
4. Guarda resultado en Ariadne
5. Marca como Done → Runner toma siguiente
6. Loop continúa
```

### Caso 3: IA Genera Plan Multiproyecto → Sincroniza Gantt

**Escenario:** IA analiza todo el codebase, genera plan de refactor con dependencias y automáticamente lo sincroniza con el Gantt de Ariadne.

```python
#!/usr/bin/env python3
# ai-plan-generator.py
import requests
import json
from datetime import datetime, timedelta

ARIADNE_API = "http://127.0.0.1:6421/api"

def generate_plan_with_ai():
    """IA genera plan de mejoras con dependencias"""
    # Aquí iría análisis de IA sobre el codebase
    # Retorna estructura con tareas y dependencias
    
    plan = {
        "title": "Performance Optimization Sprint",
        "tasks": [
            {
                "id_hint": "E-1",
                "title": "Audit database queries",
                "type": "enhancement",
                "priority": "High",
                "estimate_days": 2,
                "description": "Find N+1 queries and slow indexes"
            },
            {
                "id_hint": "E-2",
                "title": "Implement query caching",
                "type": "enhancement",
                "priority": "High",
                "estimate_days": 3,
                "depends_on": ["E-1"],  # Depende del E-1
                "description": "Add Redis layer after audit"
            },
            {
                "id_hint": "E-3",
                "title": "Benchmark improvements",
                "type": "enhancement",
                "priority": "Medium",
                "estimate_days": 1,
                "depends_on": ["E-2"],
                "description": "Measure before/after"
            }
        ]
    }
    
    return plan

def sync_plan_to_ariadne(plan, project="ariadne"):
    """Sincroniza plan de IA a Ariadne"""
    
    print(f"📋 Sincronizando plan: {plan['title']}")
    
    task_ids = {}
    
    # Crear todas las tareas
    for task in plan['tasks']:
        payload = {
            "title": task['title'],
            "type": task['type'],
            "priority": task['priority'],
            "estimate_days": task['estimate_days'],
            "description": task['description'],
            "ai_generated": True,
            "generated_at": datetime.now().isoformat()
        }
        
        # Agregar dependencias si existen
        if 'depends_on' in task:
            # Necesitaremos obtener los IDs reales una vez creadas
            payload['dependencies'] = task['depends_on']
        
        response = requests.post(
            f"{ARIADNE_API}/tasks/create?project={project}",
            json=payload
        )
        
        result = response.json()
        task_ids[task['id_hint']] = result['id']
        print(f"  ✅ {result['id']}: {task['title']}")
    
    # Ahora actualizar dependencias con IDs reales
    for task in plan['tasks']:
        if 'depends_on' in task:
            # Mapear hints a IDs reales
            real_deps = [task_ids[dep] for dep in task['depends_on']]
            
            task_id = task_ids[task['id_hint']]
            payload = {
                "dependencies": real_deps
            }
            
            requests.post(
                f"{ARIADNE_API}/tasks/{task_id}/update",
                json=payload
            )
    
    print(f"✅ Plan sincronizado con {len(task_ids)} tareas")
    
    # Retornar en orden de ejecución (respetando dependencias)
    return task_ids

def main():
    plan = generate_plan_with_ai()
    sync_plan_to_ariadne(plan)

if __name__ == "__main__":
    main()
```

**Resultado:** El plan se crea en Ariadne con dependencias → Gantt calcula fechas respetando orden → Queue ejecuta en orden correcto.

### Caso 4: Webhooks - Ariadne Notifica a IA

**Escenario:** Cuando un bug se marca como Done en Ariadne, automáticamente notifica al agente IA para que continúe con siguiente tarea.

```bash
# Configurar webhook en Ariadne (pseudocódigo)
# En .ariadne/hooks/on-task-done.js

module.exports = async (task, ariadne) => {
  // Cuando tarea → Done, notificar a IA
  
  const payload = {
    event: 'task_done',
    task_id: task.id,
    task_title: task.title,
    completed_at: new Date().toISOString(),
    evidence: task.evidence
  };
  
  // Enviar a webhook (servidor de IA)
  await fetch('http://localhost:3000/ariadne-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  console.log(`🔔 Notificado: ${task.id} completada`);
};
```

**Flujo:**
```
Queue Runner detecta tarea Done
         ↓
Llama hook: on-task-done.js
         ↓
Webhook POST a servidor de IA
         ↓
IA recibe notificación
         ↓
IA ejecuta siguiente tarea de Queue
```

### APIs Disponibles para IA

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/queue/bugs?project=X` | GET | Ver estado de queue |
| `/api/tasks/{id}` | GET | Obtener detalles de tarea |
| `/api/bugs/create?project=X` | POST | Crear bug |
| `/api/tasks/create?project=X` | POST | Crear tarea genérica |
| `/api/tasks/{id}/update` | POST | Actualizar tarea |
| `/api/projects/{slug}/gantt` | GET | Ver plan Gantt |
| `/api/queue/bugs?project=X` | GET | Ver cola |

### Seguridad en Integración IA

⚠️ **Recomendaciones:**

1. **Localhost only:** Las APIs escuchan en `127.0.0.1` por defecto (no exponen internet)
2. **Validar entrada:** IA puede generar payloads malformados; validar antes de aceptar
3. **Limits:** Implementar rate limits en endpoints si IA hace muchos requests
4. **Logs:** Todas las creaciones/actualizaciones vía IA se registran en ledger (auditable)
5. **Aprobación:** Para cambios críticos, requiere revisión humana antes de ejecutar

### Ejemplo Completo: IA que Monitorea + Ejecuta

```bash
# Terminal 1: Ariadne server
npm start

# Terminal 2: Runner de queue
npm run queue:bugs -- project-demo


# Terminal 3: IA executor (Node)
node ai-task-executor.js

# Terminal 4: IA monitor de logs (Python)
python3 ai-monitor-logs.py
```

**Resultado:** Sistema completamente automatizado:
- ✅ IA detecta errores → Crea bugs
- ✅ Bugs entran a Queue
- ✅ Runner mueve a Doing
- ✅ IA executor toma tarea y la ejecuta
- ✅ Marca Done → Runner toma siguiente
- ✅ Todo auditado en Git (ledger)

---

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

**Un solo Hub:** `com.ariadne.hub`. Guía: [`docs/launchagent-hub.md`](docs/launchagent-hub.md).

```bash
npm run hub:launchagent
# equivalente: node scripts/install-hub-launchagent.js
```

El instalador escribe `~/Library/LaunchAgents/com.ariadne.hub.plist`, reinicia el servicio y levanta el Hub (sirve Gantt en `:4177`). El log se guarda en `/tmp/ariadne-hub.log`.

Para ejecutar una cola concreta sin instalar otro LaunchAgent:

```bash
npm run queue:bugs -- project-demo
```

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

## Swarm CLI (opt-in)

Adapter nativo Queue → Doing → evidencia (`docs/swarm/`, ledger `docs/plans/ariadne-e2e.md`):

```bash
npm run swarm -- status --project ariadne
npm run swarm -- run --project ariadne
npm run swarm -- pack --task AH-E-32 --pack four
npm run swarm -- brief --task AH-E-32 --pack four
npm run swarm -- handoff --task AH-E-32 --from coder --to cleaner --summary "…"
npm run swarm -- complete --task AH-E-32 --evidence "npm test → ok"
```

## Seguridad npm (ChainDrop)

`.npmrc` fuerza `ignore-scripts=true`. CI usa `npm ci --ignore-scripts`. Detalle: [`docs/npm-supply-chain.md`](docs/npm-supply-chain.md). Auditoría: `npm run security:npm-audit-worm`.

Cloud agents: `AGENTS.md` y `docs/cloud-dev-environment.md`.

Auditoría multiproyecto (ledgers + backlog Gantt):

```bash
npm run ariadne:sync -- --fix    # post-edit: audit + higiene + check_plan
npm run ariadne:audit
npm run ariadne:digest             # Doing/Queue/riesgos → .ariadne/digests/ (docs/daily-digest.md)
npm run ariadne:route-hint -- "mueve tarea a cola"
npm run ariadne:launcher -- "actualiza el ledger"
eval "$(./scripts/ariadne-launcher.sh 'mueve a cola')"
```

Modo liviano y automatización: `docs/ariadne-lite.md` · `docs/ariadne-automation.md` · launcher `docs/ariadne-launcher.md`.

Los proyectos externos se registran únicamente en el archivo local `projects.json`, que Git ignora.

---

## 🐛 Reportar Issues

¿Encontraste un bug?

1. **Abre una issue en GitHub**: https://github.com/mincho77/Ariadne/issues/new
2. Incluye:
   - Descripción clara del problema
   - Pasos para reproducirlo
   - Versión de Node.js y npm
   - Stack trace si hay error

Ver [CONTRIBUTING.md](CONTRIBUTING.md) para más detalles.

## 🤝 Contribuir

Ariadne está abierto a contribuciones. Este es el flujo:

1. **Descarga y usa** sin restricciones (licencia MIT)
2. **Reporta bugs** vía GitHub Issues
3. **Sugiere mejoras** con el tag `enhancement`
4. **Contribuye código** via Pull Request (requiere fork + branch)

Detalles completos en [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 Licencia

Ariadne está bajo licencia **MIT**. Ver [LICENSE](LICENSE) para detalles.
