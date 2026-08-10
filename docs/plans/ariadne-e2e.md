# Plan: Ariadne E2E — herramienta imprescindible de inicio a fin

## Control
- Estado: hecho
- Última actualización: 2026-08-10
- Objetivo: cerrar el loop Intent → Queue → Swarm (nativo Cursor/CLI) → evidencia → Done, y endurecer el Hub actual para uso diario.
- Gate actual: Programa E2E AH-E-31…51 cerrado (Fase 0–3).
- Próxima acción: — (programa E2E completo)


## Alcance

### Incluye
- Adapter nativo `ariadne-swarm` (packs, worktrees, handoffs) sin exigir tmux/SwarmForge en MVP.
- Hub CTA / Hoy / Done gate / run packets mejoras / Queue desde Gantt / sync ledger.
- Cableado de route-hint/launcher y LaunchAgent único.
- Fase posterior: export SwarmForge opcional.

### No incluye
- Base de datos, cloud multi-tenant, Electron.
- Embeber tmux en `server.js`.
- Mutación/CRAP dogfooding estilo SwarmForge en MVP.

### Principios
- Markdown = fuente de verdad; swarm no escribe `forecast_*`.
- Solo Queue con deps Done entra al swarm; Doing al arrancar; Done con evidencia.
- Runtime: **nativo Cursor/CLI primero**; SwarmForge diferido.
- **Kanban ≥ plan abierto:** si el Registro/Control cita `AH-E-*` / `*-B-*` en estado pendiente, la tarjeta debe existir en `backlog/tasks/`. Inventar trabajo solo en el ledger es un bug (`ariadne:audit` → drift).

## Métricas de éxito
- Hub → Hoy → Run swarm → Done con evidencia en una tarea Queued de Ariadne.
- `npm test` + `check_plan.py` verdes en el camino feliz.
- Agente con `ariadne` / `ariadne-lite` + `ariadne-swarm` no pierde el hilo entre sesiones.

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| ASE2E-001 | 0 Kickoff | Ledger + backlog sembrado | hecho | - | Ledger + AH-E-31+ | Este archivo | — |
| ASE2E-002 | 0 Swarm | CLI ariadne-swarm (AH-E-31) | hecho | ASE2E-001 | status/run/handoff/complete | `swarm/` + `npm run swarm` | — |
| ASE2E-003 | 0 Swarm | Packs + prompts (AH-E-32) | hecho | ASE2E-002 | two/four/six + brief | `swarm/packs.js` + `docs/swarm/prompts.md` | — |
| ASE2E-004 | 0 Swarm | Worktrees (AH-E-33) | hecho | ASE2E-002 | `.worktrees/` gitignore + CLI | `swarm/worktrees.js` | — |
| ASE2E-005 | 0 Swarm | Evidencia cierre (AH-E-34) | hecho | ASE2E-002 | AC+tests → tarea+ledger | `swarm/closeout.js` | — |
| ASE2E-006 | 0 Swarm | Hub Run swarm (AH-E-35) | hecho | ASE2E-002 | CTA + API status | `GET/POST .../swarm/*` + Hub buttons | — |
| ASE2E-007 | 1 Diario | Hub Hoy (AH-E-36) | hecho | ASE2E-006 | Doing/Queue/riesgos/CTA | `hub-hoy.js` + `/api/hoy` | — |
| ASE2E-008 | 1 Diario | Done gate (AH-E-37) | hecho | ASE2E-007 | No Done sin evidencia | `done-gate.js` + 409 + UI warn | — |
| ASE2E-009 | 1 Diario | Run packet mejoras (AH-E-38) | hecho | ASE2E-008 | Packet API/CLI + swarm path | `/api/queue/mejoras` + `run-packets/` | — |
| ASE2E-010 | 1 Diario | ariadne-route Cursor (AH-E-39) | hecho | ASE2E-009 | Skill/hook lite vs strong | `.cursor/rules/ariadne-route.mdc` | — |
| ASE2E-011 | 1 Diario | LaunchAgent único (AH-E-40) | hecho | ASE2E-009 | Solo com.ariadne.hub | `hub:launchagent` + docs/launchagent-hub.md | — |
| ASE2E-012 | 1 Diario | Sync ledger checkpoint (AH-E-41) | hecho | ASE2E-009 | CLI/UI + check_plan | Kanban AH-E-41 Done · checkpoint | — |
| ASE2E-013 | 1 Diario | Queue desde Gantt (AH-E-42) | hecho | ASE2E-009 | status+ordinal | Kanban AH-E-42 Done · checkpoint | — |
| ASE2E-014 | 1 Diario | Plantillas AC (AH-E-43) | hecho | ASE2E-009 | template al crear | Kanban AH-E-43 Done · checkpoint | — |
| ASE2E-015 | 1 Diario | Digest diario (AH-E-44) | hecho | ASE2E-007 | script local | Kanban AH-E-44 Done · checkpoint | — |
| ASE2E-016 | 2 Swarm | Pack policy + modelHint (AH-E-45) | hecho | ASE2E-003 | pack por tipo/prio | Kanban AH-E-45 Done · checkpoint | — |
| ASE2E-017 | 2 Swarm | Specifier four/six (AH-E-46) | hecho | ASE2E-016 | AC antes de coder | Kanban AH-E-46 Done · checkpoint | — |
| ASE2E-018 | 2 Swarm | Hardener QA (AH-E-47) | hecho | ASE2E-005 | lint+test gate | Kanban AH-E-47 Done · checkpoint | — |
| ASE2E-019 | 2 Swarm | Observabilidad Hub (AH-E-48) | hecho | ASE2E-006 | handoffs visibles | Kanban AH-E-48 Done · checkpoint | — |
| ASE2E-020 | 2 Swarm | Fixture E2E adapter (AH-E-49) | hecho | ASE2E-005 | Queued→Done tests | Kanban AH-E-49 Done · checkpoint | — |
| ASE2E-021 | 3 Opcional | Export SwarmForge (AH-E-50) | hecho | ASE2E-020 | conf opcional | Kanban AH-E-50 Done · checkpoint | — |
| ASE2E-022 | 3 Opcional | Backends por rol (AH-E-51) | hecho | ASE2E-021 | docs backends | Kanban AH-E-51 Done · checkpoint | — |

## Decisiones

| Fecha | ID | Decisión | Motivo | Impacto |
|---|---|---|---|---|
| 2026-08-09 | ASE2E-DEC-001 | Runtime nativo Cursor/CLI primero | Flujo real es Cursor+Hub | AH-E-31 antes que SwarmForge |
| 2026-08-09 | ASE2E-DEC-002 | IDs swarm en serie AH-E-31+ (no AS-E) | Evitar colisión con Gantt AH-E-9…30 en master | Numeración estable |

## Riesgos

| ID | Severidad | Riesgo | Mitigación | Estado |
|---|---|---|---|---|
| ASE2E-RISK-001 | media | CLI sin Hub CTA aún | AH-E-32… packs; CTA en fase siguiente | abierto |
| ASE2E-RISK-002 | baja | SwarmForge distrae MVP | Export diferido | abierto |

## Diferidos

| ID | Trabajo | Motivo | Condición de reactivación |
|---|---|---|---|
| ASE2E-DEF-001 | tmux / SwarmForge completo | No bloquea Cursor diario | Tras packs + evidencia + demanda |

## Historial
- 2026-08-09: Ledger E2E; AH-E-31 CLI Done; AH-E-32 packs en Queue.
- 2026-08-09: AH-E-32 Done — packs/brief/prompts; CI npm ignore-scripts + docs/npm-supply-chain.md.
- 2026-08-09: AH-E-33 Done — worktrees por rol (`.worktrees/`, CLI `worktree`).
- 2026-08-09: AH-E-34 (SWARM · Evidencia de cierre a tarea y ledger) Done — swarm.test.js 15/15 closeout+ledger · AH-E-34
- 2026-08-09: AH-E-35 (SWARM · Hub CTA Run swarm y API status) Done — GET/POST /api/projects/:slug/swarm/status|run + Hub CTA buttons · AH-E-35
- 2026-08-09: AH-E-36 (HUB · Command center Hoy) Done — hub-hoy.test.js + GET /api/hoy + Hub Hoy panel CTA · AH-E-36
- 2026-08-09: AH-E-37 (HUB · Done gate sin evidencia) Done — done-gate.js + 409 MISSING_EVIDENCE; UI assertClientDoneEvidence; done-gate.test.js + lifecycle 409→evidence→Done
- 2026-08-09: AH-E-38 (HUB · Run packet unificado para mejoras) Done — GET/POST /api/queue/mejoras(+claim) + POST /api/queue/packet; .ariadne/mejoras-queue + run-packets/; npm run queue:packet; bug-queue+improvement-queue tests
- 2026-08-09: Sembradas AH-E-39…51 (Fase 1 hub + Fase 2/3 swarm); Queue head = AH-E-40 LaunchAgent
- 2026-08-09: Bugfix — invariante Kanban≥plan abierto; `ariadne:audit` reporta `LEDGER_WITHOUT_KANBAN` (`lib/ledger-backlog-drift.js`)
- 2026-08-10: AH-E-40 (HUB · LaunchAgent único com.ariadne.hub) Done — npm run hub:launchagent; bootout+rm com.jurismate.ariadne-hub; com.ariadne.hub running pid via launchctl; /api/gantt/portfolio + /portfolio.html 200; docs/launchagent-hub.md; tests/launchagent-hub.test.js
- 2026-08-10: AH-E-39 (HUB · Cablear ariadne-route en Cursor) Done — .cursor/rules/ariadne-route.mdc alwaysApply; skills ariadne+lite route section; docs/ariadne-launcher ejemplo; route-hint lite/full CLI
- 2026-08-10: AH-E-41 (HUB · Sync ledger y Backlog checkpoint) Done — npm run ariadne:checkpoint + POST /api/checkpoint + Hub Checkpoint button; check_plan 0 errors; tests/ledger-checkpoint.test.js
- 2026-08-10: AH-E-42 (GANTT · Autorizar a Queue desde Gantt) Done — POST /api/projects/:slug/tasks/:id/queue; status Queued + ordinal order; ui-contract taskQueueAuthorize; docs/gantt-ui-integration; tests/queue-authorize.test.js + gantt:smoke
- 2026-08-10: AH-E-43 (HUB · Plantillas de AC al crear tarea) Done — lib/ac-templates.js + GET /api/tasks/ac-templates + board Plantilla AC prompt + create-task --template; node --test tests/ac-templates.test.js bugs-board.test.js mejoras-board.test.js → 12 pass; docs/ac-templates.md
- 2026-08-10: AH-E-44 (HUB · Digest diario local) Done — lib/daily-digest.js + scripts/ariadne-digest.js; npm run ariadne:digest → .ariadne/digests/; docs/daily-digest.md; tests/daily-digest.test.js 2/2; local-only no cloud
- 2026-08-10: AH-E-45 (SWARM · Política pack automática y modelHint) Done — recommendPackPolicy bug→two/cheap, mejora High→four/strong, MVP/Ultra→six/strong; modelHint in route-hint+launcher+brief; docs/swarm/pack-policy.md; swarm.test + ariadne-lite tests
- 2026-08-10: AH-E-46 (SWARM · Specifier obligatorio en four y six) Done — swarm/specifier-gate.js: four/six specifier first; handoff→coder needs AC+--approved; CLI specify; docs/swarm/specifier.md; tests specifier gate 3/3
- 2026-08-10: AH-E-47 (SWARM · Hardener QA lint y npm test) Done — swarm/qa-gate.js + npm run lint (node --check); complete blocks Done on QA_GATE_FAILED; handoff hardender→qa; docs/swarm/qa-gate.md; tests packRequiresQa+runQaGate
- 2026-08-10: AH-E-48 (SWARM · Observabilidad handoffs en Hub) Done — swarm/observability.js + GET /swarm/observe + Hub Handoffs button + handoffs.jsonl; docs/swarm/observability.md; tests/swarm-fase2-3
- 2026-08-10: AH-E-49 (SWARM · Fixture E2E y tests del adapter) Done — tests/swarm-fase2-3.test.js Queued→run→handoff→Done; docs/swarm/e2e-fixture.md; npm test incluye fixture
- 2026-08-10: AH-E-50 (SWARM · Export swarmforge.conf opcional) Done — swarm/swarmforge-export.js; export-swarmforge → .ariadne/swarmforge-export; optionalRuntime; docs/swarm/swarmforge-export.md; tests export
- 2026-08-10: AH-E-51 (SWARM · Backends por rol documentados) Done — swarm/backends.js + docs/swarm/backends.md tabla+ejemplo; Ariadne dueño Done; CLI backends; tests role backends
