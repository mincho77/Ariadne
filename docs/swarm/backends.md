# Backends por rol (AH-E-51)

Ariadne es dueño de **Queue / Doing / Done / evidencia**. Cursor, Claude CLI y Codex son backends de ejecución opcionales por rol — no sustituyen el Kanban ni el `complete`.

## Tabla

| Rol | Backend primario | Alternativas | modelHint | Notas |
|-----|------------------|--------------|-----------|-------|
| specifier | cursor | claude, codex | strong | AC binarios + aprobación humana |
| coder | cursor | claude, codex | strong | Implementación + tests en worktree |
| cleaner | codex | cursor, claude | cheap | Refactor behavior-preserving |
| architect | claude | cursor, codex | strong | Límites de módulos |
| hardender | codex | cursor, claude | strong | Endurecimiento pre-QA |
| qa | cursor | codex, claude | cheap | lint/test; **no** marca Done solo |

Máquina: `swarm/backends.js` · CLI: `npm run swarm -- backends`.

## Ejemplo (four-pack en Cursor)

```bash
# 1) Autorizar y arrancar (Ariadne)
npm run swarm -- run --project ariadne --task FX-E-1 --role specifier

# 2) Specifier (Cursor Agent, modelHint strong) escribe AC
npm run swarm -- specify --task FX-E-1 --ac "…" --ac "…"
npm run swarm -- handoff --task FX-E-1 --from specifier --to coder --summary "AC ok" --approved

# 3) Coder en worktree (Cursor o Claude)
npm run swarm -- worktree --task FX-E-1 --role coder
# … implementar en .worktrees/fx-e-1-coder …

npm run swarm -- handoff --task FX-E-1 --from coder --to cleaner --summary "tests green"

# 4) Solo Ariadne cierra Done
npm run swarm -- complete --task FX-E-1 --evidence "node --test … ok"
```

## Invariante

| Capa | Quién |
|------|--------|
| Orden Queue, deps, Done | **Ariadne** (`ariadne-swarm` / Hub) |
| Escribir código / revisar | Backend del rol (Cursor / Claude / Codex) |
| Evidencia de cierre | Agente → `complete --evidence`; Hub Done gate |

Export SwarmForge (`export-swarmforge`) puede incluir la tabla en el README del bundle; el runtime de SwarmForge sigue siendo **opt-in**.
