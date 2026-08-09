# Ariadne Swarm (módulo opt-in)

Capa de **ejecución multi-agente** inspirada en [SwarmForge](https://github.com/unclebob/swarm-forge), acoplada al gobierno de Ariadne.

Programa: [docs/plans/ariadne-e2e.md](../plans/ariadne-e2e.md).

## Principio

| Capa | Dueño | Responsabilidad |
|------|--------|-----------------|
| **Gobernanza** | Ariadne (Hub, Backlog, ledger) | Qué está autorizado, orden Queue, deps, evidencia, Done |
| **Ejecución** | Este módulo (opt-in) | Cómo roles colaboran en worktrees/handoffs |

Ariadne **no** embebe tmux/Babashka en el Hub. El MVP es un **adapter nativo Cursor/CLI** (`ariadne-swarm`). SwarmForge queda como export opcional (AS-E-11/12).

## Contrato de puente

1. Solo tareas en **Queue** con dependencias **Done** pueden entrar al swarm.
2. Al arrancar un rol, la tarea pasa a **Doing** (máx. 3; preferir 1).
3. Al terminar, el agente escribe evidencia (tests, commit, notes) en la tarea / ledger.
4. **Done** solo con evidencia verificable (regla Ariadne).

## Roles sugeridos (packs)

Ver [constitution.md](./constitution.md).

| Pack | Roles | Uso |
|------|--------|-----|
| two-pack | coder → cleaner | Tareas pequeñas backend |
| four-pack | specifier → coder → refactorer → architect | Spec + implementación |
| six-pack | + hardender + QA | MVP / cambios mayores |

## Roadmap

| Versión | Estado | Entrega |
|---------|--------|---------|
| **v0** | hecho | docs + constitution (este directorio) |
| **v1 nativo** | en curso | CLI `ariadne-swarm` ✅ · packs, worktrees, evidencia, Hub CTA (AS-E-2…5 / AH-E-4…) |
| **v1.1 diario** | pendiente | Hoy, Done gate, pack auto, LaunchAgent (AH-E-31…35, AS-E-6) |
| **v2 calidad** | pendiente | specifier/QA/observabilidad/E2E (AS-E-7…10) |
| **v3 SwarmForge** | diferido | export `swarmforge.conf` + backends (AS-E-11/12) |

## CLI `ariadne-swarm`

```bash
npm run swarm -- status --project ariadne
npm run swarm -- run --project ariadne            # cabeza de Queue → In Progress
npm run swarm -- run --project ariadne --task AH-E-4 --role coder
npm run swarm -- handoff --task AH-E-4 --from coder --to cleaner --summary "tests green"
npm run swarm -- complete --task AH-E-4 --evidence "npm test → ok"
```

Reglas (módulo `swarm/`):

1. `run` solo acepta **Queue** con dependencias FS en **Done** (o reanuda Doing).
2. `handoff` escribe en la tarea bajo `## Swarm handoffs`.
3. `complete` exige `--evidence`, la anota en `## Evidence` y marca **Done**.

## Relación con el Gantt

El Gantt edita **intención** (prioridad, horas, fechas) vía PATCH. El swarm **ejecuta** trabajo Queued; no sustituye el drawer ni el Kanban.
