# Plan: Gantt integrado Ariadne

## Control
- Estado: en_progreso
- Última actualización: 2026-08-04
- Objetivo: evolucionar el Gantt de Ariadne hacia planificación, ejecución, seguimiento y reprogramación integrados con Kanban, Queue y ledgers, manteniendo Markdown como fuente de verdad.
- Gate actual: AH-E-10 … AH-E-12 cerradas; siguiente AH-E-13 (modelo temporal).
- Próxima acción: iniciar AH-E-13 tras revisar dependencias en Kanban/Gantt.

## Alcance

### Incluye

- Motor de scheduling, APIs, persistencia y gobernanza dentro del repo Ariadne.
- Sincronización Kanban ↔ Gantt (fechas reales, dependencias, restricciones).
- Líneas base, progreso, bloqueos, fases/hitos y métricas en Hub.
- Coordinación con UI Gantt externa (`localhost:63447`) vía contrato API.
- MVP liberable: AH-E-9 … AH-E-24 (T01–T16).

### Fuera de alcance

- Base de datos relacional u otro almacén distinto de Markdown (salvo decisión documentada y aprobada).
- Modificar repositorio del frontend Angular sin confirmación explícita de alcance.
- Despliegue automático o push sin autorización del usuario.
- Portafolio multiproyecto avanzado (AH-E-28) en la primera entrega si no bloquea MVP.

### Restricciones

- Una tarea Markdown, varias vistas (Kanban + Gantt).
- Intención persistida; pronóstico calculado.
- Migraciones explícitas, probadas, reversibles, con `--dry-run` cuando aplique.
- Máximo razonable de tareas en Doing; una tarea grande por cambio.

## Métricas de éxito

- El ledger pasa `check_plan.py` sin errores.
- Las 21 tareas Gantt aparecen en Kanban y son planificables vía `GET /api/projects/ariadne/gantt`.
- MVP (T01–T16): parser YAML, PATCH parcial, fechas reales, restricciones, baseline, UI coordinada, métricas Hub.
- `npm test` verde antes y después de cada gate.
- Cada tarea `hecho` tiene evidencia verificable en este ledger.

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| AH-E-9 | 0 Auditoría | Auditar arquitectura y comportamiento Gantt | hecho | - | Diagnóstico existente/parcial/ausente en ledger; tests baseline; UI ubicada | docs/plans/ariadne-gantt.md §Evidencias; npm test 65/65; docs/ARQUITECTURA.md + GANTT.md | Habilitar AH-E-10 |
| AH-E-10 | 0 Auditoría | Contrato y escenarios de prueba del planificador | hecho | AH-E-9 | Fixtures FS/SS/FF/SF, lags, ciclos, capacidad, CO festivos | tests/fixtures/gantt (8 escenarios); docs/gantt-planner-contract.md; npm test 80/80 | Habilitar AH-E-13 |
| AH-E-11 | 1 Fundamentos | Parser YAML confiable ida y vuelta | hecho | AH-E-9 | Round-trip sin pérdida de Markdown | lib/task-markdown.js; tests/task-markdown.test.js | Habilitar AH-E-13 |
| AH-E-12 | 1 Fundamentos | Modularizar motor de programación | hecho | AH-E-9, AH-E-10 | Extracción progresiva con regresión verde | lib/gantt/*; server.js delega; npm test 80/80 | Habilitar AH-E-13 |
| AH-E-13 | 1 Fundamentos | Modelo temporal y precedencia | hecho | AH-E-11, AH-E-12 | Campos planned/actual/deadline documentados | docs/gantt-temporal-model.md; lib/task-temporal.js; planning-task.js | Habilitar AH-E-16 |
| AH-E-14 | 1 Fundamentos | API PATCH actualización parcial | hecho | AH-E-11 | PATCH atómico con validación | PATCH /api/projects/:slug/tasks/:id; npm test 94/94 | Habilitar AH-E-18 |
| AH-E-15 | 2 Kanban | Fechas reales automáticas desde Kanban | hecho | AH-E-13, AH-E-14 | actual_start/finish en transiciones | updateTaskStatus + applyKanbanTemporalSync; tests | Habilitar AH-E-16 |
| AH-E-16 | 2 Kanban | Restricciones, deadlines y diagnósticos | hecho | AH-E-12, AH-E-13 | Explicabilidad por causa | lib/gantt/restrictions.js; diagnostics/violations en plan JSON | Habilitar AH-E-18 |
| AH-E-17 | 2 Kanban | Unificar Queue, prioridad y capacidad | hecho | AH-E-12, AH-E-13 | Política Doing→Queue→To Do | lib/gantt/capacity-policy.js; docs/gantt-capacity-policy.md; npm test 108/108 | Habilitar AH-E-19 |
| AH-E-18 | 2 Kanban | Dependencias aplicables en Kanban | hecho | AH-E-14, AH-E-16 | Bloqueo FS visible en tablero | lib/dependency-gate.js; badges Kanban; API status | Habilitar AH-E-24 |
| AH-E-19 | 3 Seguimiento | Líneas base del cronograma | hecho | AH-E-13, AH-E-14 | Baselines inmutables en backlog/docs/gantt/ | lib/gantt/baselines.js; docs/gantt-baselines.md; API list/create/read/compare | Habilitar AH-E-20 |
| AH-E-20 | 3 Seguimiento | Progreso y trabajo restante | hecho | AH-E-13, AH-E-15 | Pronóstico usa remaining | lib/gantt/progress.js; docs/gantt-progress.md; npm test | Habilitar AH-E-21 |
| AH-E-21 | 3 Seguimiento | Bloqueos temporales modelados | hecho | AH-E-13, AH-E-16 | blocked_* y confianza baja | lib/gantt/blocks.js; docs/gantt-blocks.md; escenario temporal-block | Habilitar AH-E-24 |
| AH-E-22 | 3 Seguimiento | Fases, entregables e hitos | pendiente | AH-E-11, AH-E-13 | parent_id, hitos duración 0 | - | Tras parser |
| AH-E-23 | 4 Gantt UI | UI editable (coordinación externa) | pendiente | AH-E-14, AH-E-16, AH-E-19, AH-E-20, AH-E-22 | Contrato API + smoke Hub→63447 | UI fuera del repo; ver Evidencias | Confirmar repo frontend |
| AH-E-24 | 4 Hub | Métricas de seguimiento en Hub | pendiente | AH-E-15, AH-E-16, AH-E-19, AH-E-20, AH-E-21 | Tarjeta proyecto con fin plan/pronóstico | - | Tras métricas backend |
| AH-E-25 | 5 Avanzado | Recursos y capacidad por habilidad | pendiente | AH-E-11, AH-E-12, AH-E-13 | assignee, skills, resource_type | Diferido post-MVP | Tras MVP |
| AH-E-26 | 5 Avanzado | Holgura y CP condicionada | pendiente | AH-E-16, AH-E-25 | Slack y CP lógica vs recursos | - | Post-MVP |
| AH-E-27 | 5 Avanzado | Escenarios qué-pasa-si | pendiente | AH-E-19, AH-E-25, AH-E-26 | Simulación sin persistir | - | Post-MVP |
| AH-E-28 | 5 Avanzado | Vista portafolio multiproyecto | pendiente | AH-E-24, AH-E-26, AH-E-27 | Vista cross-project | - | Post-MVP |
| AH-E-29 | 6 Release | Migración y endurecimiento MVP | pendiente | AH-E-9, AH-E-10, AH-E-11, AH-E-12, AH-E-13, AH-E-14, AH-E-15, AH-E-16, AH-E-17, AH-E-18, AH-E-19, AH-E-20, AH-E-21, AH-E-22, AH-E-23, AH-E-24 | Docs, dry-run, perf 1000 tareas | - | Al cerrar MVP |

## Riesgos

| ID | Severidad | Riesgo | Mitigación | Estado |
|---|---|---|---|---|
| AGANTT-R01 | alta | UI Gantt en repo externo no disponible en entorno cloud | Desarrollar API/motor/pruebas en Ariadne; AH-E-23 como coordinadora | activo |
| AGANTT-R02 | alta | Parser YAML rompe frontmatter legacy | Round-trip tests; migración gradual; T03 | abierto |
| AGANTT-R03 | media | server.js crece sin modularizar | AH-E-12 con regresión obligatoria | abierto |
| AGANTT-R04 | media | Ediciones concurrentes en Markdown | PATCH con hash/updated_date; T06 | abierto |
| AGANTT-R05 | baja | Plan AM-E-8…13 en doc antiguo duplica trabajo | Consolidado en AH-E-9…29; referencia cruzada | mitigado |

## Decisiones

| Fecha | ID | Decisión | Motivo | Impacto |
|---|---|---|---|---|
| 2026-08-04 | AGANTT-D01 | Ledger dedicado `ariadne-gantt.md` | Trazabilidad del programa Gantt | Separado de ariadne-local y ariadne-mejoras |
| 2026-08-04 | AGANTT-D02 | IDs backlog AH-E-9 … AH-E-29 para T01–T21 | Convención Ariadne | Kanban y Gantt referencian mismos archivos |
| 2026-08-04 | AGANTT-D03 | MVP = T01–T16; T17–T20 segunda etapa | Entrega incremental | AH-E-25 … AH-E-28 post-MVP |
| 2026-08-04 | AGANTT-D04 | No DB; Markdown sigue siendo verdad | Requisito del usuario | Baselines en backlog/docs/gantt/ |
| 2026-08-04 | AGANTT-D05 | UI :63447 fuera de alcance directo hasta confirmar repo | docs/GANTT.md cita repoxai/frontend-angular | AH-E-23 registra bloqueo |

## Diferidos

| ID | Trabajo | Motivo | Condición de reactivación |
|---|---|---|---|
| AGANTT-DEF-01 | Edición visual completa en :63447 | Repo frontend no clonado en workspace | Usuario confirma ruta y acceso al repo |
| AGANTT-DEF-02 | Portafolio multiproyecto | Prioridad Low; no bloquea MVP | MVP cerrado |

## Historial

- 2026-08-04: Creado ledger, importadas 21 tareas (AH-E-9 … AH-E-29), dependencias en frontmatter, enriquecidas descripciones y AC.
- 2026-08-04: AH-E-10 … AH-E-12 cerradas — fixtures Gantt, parser YAML, motor modular en lib/gantt/.
- 2026-08-04: Añadidos `docs/ARQUITECTURA.md` y `docs/GANTT.md` al repo.

- 2026-08-04: AH-E-13 … AH-E-15 cerradas — modelo temporal, PATCH parcial, sync Kanban→actual_start/finish.

- 2026-08-04: AH-E-16 y AH-E-18 cerradas — restricciones/deadlines con diagnósticos y bloqueo FS en Kanban.

- 2026-08-04: AH-E-17 cerrada — política Doing→Queue→To Do y capacidad por carril.

- 2026-08-04: AH-E-19 cerrada — baselines inmutables, API consulta/comparación vs pronóstico.

- 2026-08-04: AH-E-20 cerrada — progreso/remaining en pronóstico; checklist sugiere % sin mutar remaining.

- 2026-08-04: AH-E-21 cerrada — bloqueos temporales, confianza baja sin fecha de desbloqueo.

## Evidencias

### AH-E-9 — Auditoría inicial (2026-08-04)

**Pruebas baseline:** `npm test` → 65/65 OK (incluye buildProjectGantt, FS/SS/FF/SF, HTTP dependencies, ai-capacity).

**Funcionalidades existentes**

- `buildProjectGantt()` en `server.js`: scheduling hora-a-hora, capacidad 1–12, calendario laboral Colombia, festivos, sábado opcional.
- Dependencias tipadas FS/SS/FF/SF + lag (`d`/`h`); legacy `JM-E-1` → FS.
- `GET /api/projects/:slug/gantt`, `POST /api/tasks/dependencies`, ai-capacity-config APIs.
- Hub: botón **Abrir Gantt**, `GET /api/hub-config`, `ARIADNE_GANTT_BASE_URL`.
- Cola bugs, Kanban bugs/mejoras, normalización IDs, import improvements.

**Funcionalidades parciales**

- Ruta crítica: `criticalPath.route` en JSON; sin holgura ni CP condicionada por recursos.
- Capacidad: `ai-capacity.config.json` + query param; sin split bugs/enhancements en motor.
- Dependencias: persisten en frontmatter; Kanban no bloquea movimiento por FS pendiente.
- Parser frontmatter: regex, no YAML completo (riesgo AGANTT-R02).

**Funcionalidades ausentes (MVP)**

- PATCH parcial por campo; modelo temporal completo; fechas reales auto desde Kanban.
- Baselines; progreso/remaining; bloqueos temporales; fases/hitos; métricas Hub.
- Gantt editable (UI); explicabilidad por tarea en API; escenarios what-if.

**Deuda técnica:** `server.js` monolítico (~2200+ líneas); simulación hora-a-hora (optimizar post-MVP).

**UI externa:** default `http://localhost:63447/`; documentación cita build en `repoxai/frontend-angular` — **no presente en workspace** → bloqueo AGANTT-DEF-01.

**Compatibilidad:** backlogs sin `dependencies` tipadas siguen funcionando; tests de regresión cubren motor actual.

### AH-E-10 — Contrato y fixtures (2026-08-04)

- `docs/gantt-planner-contract.md` documenta shape JSON v1.
- 8 escenarios en `tests/fixtures/gantt/scenarios/` ejecutados por `tests/gantt-scenarios.test.js`.

### AH-E-11 — Parser YAML (2026-08-04)

- `lib/task-markdown.js` con `yaml` npm; round-trip preserva cuerpo y `custom_field`.
- `parseTask()` en `server.js` usa frontmatter YAML.

### AH-E-12 — Motor modular (2026-08-04)

- `lib/gantt/`: calendar, dependencies, planning-task, critical-path, scheduler.
- `server.js` delega en `buildGanttPlan(project, options, projectTasks)`.
- Suite: **80/80** tests OK.
