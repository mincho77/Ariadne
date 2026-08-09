# Plan: Ariadne E2E — herramienta imprescindible de inicio a fin

## Control
- Estado: en_progreso
- Última actualización: 2026-08-09
- Objetivo: cerrar el loop Intent → Queue → Swarm (nativo Cursor/CLI) → evidencia → Done, y endurecer el Hub actual para uso diario.
- Gate actual: Fase 0 Swarm — CLI `ariadne-swarm` Done (AH-E-31).
- Próxima acción: Packs two/four/six (AH-E-32, Queued).

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

## Métricas de éxito
- Hub → Hoy → Run swarm → Done con evidencia en una tarea Queued de Ariadne.
- `npm test` + `check_plan.py` verdes en el camino feliz.
- Agente con `ariadne` / `ariadne-lite` + `ariadne-swarm` no pierde el hilo entre sesiones.

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| ASE2E-001 | 0 Kickoff | Ledger + backlog sembrado | hecho | - | Ledger + AH-E-31+ | Este archivo | — |
| ASE2E-002 | 0 Swarm | CLI ariadne-swarm (AH-E-31) | hecho | ASE2E-001 | status/run/handoff/complete | `swarm/` + `npm run swarm` | — |
| ASE2E-003 | 0 Swarm | Packs + prompts (AH-E-32) | pendiente | ASE2E-002 | two/four/six + brief | `AH-E-32` Queued | Implementar |
| ASE2E-004 | 0 Swarm | Worktrees | pendiente | ASE2E-002 | `.worktrees/` gitignore | — | Tras packs |
| ASE2E-005 | 0 Swarm | Evidencia cierre | pendiente | ASE2E-002 | AC+tests → tarea+ledger | — | — |
| ASE2E-006 | 0 Swarm | Hub Run swarm | pendiente | ASE2E-002 | CTA + API status | — | — |

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
