# Constitution · Ariadne Swarm

Artículos de conducta para agentes que ejecutan trabajo bajo gobierno Ariadne.
Inspirados en SwarmForge; adaptados a Markdown backlog + ledger.

## Artículo 1 — Fuente de verdad

1. La tarea Markdown (`backlog/tasks/`) y el ledger `docs/plans/<slug>.md` son la fuente de verdad.
2. No inventar estados fuera de To Do / Queue / Doing / Done / Blocked.
3. No avanzar a Done sin evidencia (tests, diff, log, aceptación humana).

## Artículo 2 — Autorización

1. No tocar tareas en To Do: no están autorizadas.
2. Tomar solo la cabeza de Queue (ordinal más bajo) o la tarea explícitamente asignada.
3. Respetar dependencias: si un `depends-on` no está Done, detenerse y reportar.

## Artículo 3 — Handoffs

1. Entre roles, el handoff nombra: `task-id`, `commit` (si aplica), `next-role`, una línea de resumen.
2. No editar a ciegas el mismo archivo en dos roles a la vez; preferir worktrees o turnos.
3. El receptor confirma con evidencia mínima (comando + resultado) antes de pasar al siguiente.

## Artículo 4 — Ingeniería

1. Preferir cambios quirúrgicos; no refactors oportunistas fuera de alcance.
2. TDD cuando el pack lo exija (coder); tests deben correr en verde antes del handoff a cleaner/QA.
3. No commitear secretos, `.env`, ni estado runtime (`.swarmforge/`, worktrees).

## Artículo 5 — Cierre

1. Actualizar acceptance criteria (`check-ac`) cuando correspondan.
2. Anotar evidencia en la tarea y en el ledger (checkpoint).
3. Liberar Doing: Done o devolver a Queue/Blocked con motivo explícito.

## Roles (prompts cortos)

### specifier
Traduce la solicitud / AC de la tarea a criterios binarios y, si aplica, escenarios Gherkin. En packs **four/six** es obligatorio antes de `coder` (`docs/swarm/specifier.md`). Pide aprobación humana (`--approved` / summary `AC ok`) antes del handoff.

### coder
Implementa el slice aprobado con tests. No cambia alcance. Handoff a cleaner/refactorer con commit corto.

### cleaner / refactorer
Limpieza behavior-preserving, DRY, cobertura. Sin features nuevas.

### architect
Revisa límites de módulos y dirección de dependencias. Puede pedir cambios al coder.

### hardender / QA
Endurecimiento y verificación final (scripts, humo UI). Emite la evidencia de cierre. En six-pack, `complete` exige `npm run lint` + `npm test` verdes ([qa-gate.md](./qa-gate.md)).

## Integración Cursor

Usar `npm run swarm -- status|run|handoff|complete` al tomar una tarea Queued. Un agente Cursor puede además adoptar esta constitution leyendo este archivo al iniciar.

Backends opcionales por rol (Claude / Codex / Cursor): [backends.md](./backends.md). **Solo Ariadne** autoriza Done.
