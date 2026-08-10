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
| four-pack | specifier → coder → cleaner → architect | Spec + implementación (**specifier obligatorio**) |
| six-pack | + hardender → qa | MVP / cambios mayores (**specifier obligatorio**) |

Prompts: [prompts.md](./prompts.md). Specifier gate: [specifier.md](./specifier.md). Backends: [backends.md](./backends.md). Brief CLI: `npm run swarm -- brief --task ID --pack four`.

## Roadmap

| Versión | Estado | Entrega |
|---------|--------|---------|
| **v0** | hecho | docs + constitution (este directorio) |
| **v1 nativo** | hecho (Fase 0 core) | CLI · packs · worktrees · closeout · Hub CTA/API (AH-E-31…35) |
| **v1.1 diario** | hecho (AH-E-36…44) | Hoy, Done gate, LaunchAgent, digest, plantillas AC |
| **v2 calidad** | hecho (AH-E-45…49) | policy · specifier · QA · observabilidad · fixture E2E |
| **v3 SwarmForge** | hecho (AH-E-50/51) | export conf opcional · backends por rol documentados |

## CLI `ariadne-swarm`

```bash
npm run swarm -- status --project ariadne
npm run swarm -- run --project ariadne
npm run swarm -- packs
npm run swarm -- pack --task AH-E-45   # pack + modelHint (cheap|strong)
npm run swarm -- brief --task AH-E-32 --pack four
npm run swarm -- handoff --task AH-E-32 --from coder --to cleaner --summary "tests green"
npm run swarm -- complete --task AH-E-32 --evidence "npm test → ok"
```

Reglas (módulo `swarm/`):

1. `run` solo acepta **Queue** con dependencias FS en **Done** (o reanuda Doing).
2. `brief` incluye AC, deps, paths y prompts del pack.
3. `worktree` crea/reusa `.worktrees/<task>-<role>` (gitignore).
4. `handoff` escribe en la tarea bajo `## Swarm handoffs`.
5. `complete` exige `--evidence`, marca AC, escribe `## Closeout` y (por defecto) checkpoint en el ledger E2E (`--no-ledger` para omitir). En six-pack corre lint+test ([qa-gate.md](./qa-gate.md)).

## Worktrees

```bash
npm run swarm -- worktree --task AH-E-33 --role coder --project ariadne
```

Crea `.worktrees/ah-e-33-coder` en una rama `swarm/ah-e-33/coder`. El directorio `.worktrees/` está en `.gitignore`.

## Relación con el Gantt

El Gantt edita **intención** (prioridad, horas, fechas) vía PATCH. El swarm **ejecuta** trabajo Queued; no sustituye el drawer ni el Kanban.
