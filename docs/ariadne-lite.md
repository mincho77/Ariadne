# Ariadne Lite — modo liviano

Decisión **AGANTT-DEC-003 / AH-E-5**: tareas simples de gobernanza y backlog usan el skill **`ariadne-lite`**; el skill **`ariadne`** completo sigue siendo obligatorio para auditorías, código, Gantt profundo y despliegues.

## Cuándo usar `ariadne-lite`

| Sí (lite) | No (full `ariadne`) |
|-----------|---------------------|
| Crear/mover/cerrar tareas en Backlog | Auditar código (Pharos, seguridad) |
| Actualizar ledger + `check_plan.py` | Implementar features o refactors grandes |
| Repriorizar cola (`ordinal`) | Desplegar a producción |
| Registrar decisión/riesgo breve | Programa Gantt (motor, APIs, fixtures) |
| Status / resume / checkpoint texto | Migraciones de datos o infra |
| Marcar Done **con evidencia ya adjunta** | Cerrar fase sin evidencia verificable |

## Triggers de lenguaje natural

Invocar lite cuando el pedido sea similar a:

- «mueve JM-E-3 a Queue»
- «marca AH-E-5 Done con evidencia X»
- «actualiza el ledger y valida»
- «¿cuál es la próxima acción del plan?»

Escalar a **`ariadne` full** cuando aparezca:

- `Pharos`, `despliega`, `deploy`, `audita código`, `migración`, `refactor`, `Gantt`, `producción`, `security`

## Implementación elegida

| Opción | Decisión |
|--------|----------|
| Skill separado `ariadne-lite` | **Sí** — menos contexto cargado por defecto |
| Editar solo `SKILL.md` principal | No — mezclaría reglas pesadas en pedidos simples |
| Wrapper que fuerza modelo | **Diferido** — la CLI/Cursor elige el modelo; entregamos **hint** |

### Hint de enrutamiento (wrapper externo)

```bash
node scripts/ariadne-route-hint.js "mueve la tarea a cola"
# → { "mode": "lite", "skill": "ariadne-lite", ... }

node scripts/ariadne-route-hint.js "audita con Pharos y despliega"
# → { "mode": "full", "skill": "ariadne", ... }
```

Integrar el hint en tu launcher de Codex/Cursor **fuera** de este repo cuando el cliente permita elegir modelo por invocación.

## Validación

```bash
python3 skills/ariadne/scripts/check_plan.py docs/plans/ariadne-mejoras.md
npm run ariadne:audit
```

## Referencias

- Skill: `skills/ariadne-lite/SKILL.md`
- Ledger mejoras: `docs/plans/ariadne-mejoras.md`
- Backlog: `backlog/tasks/ah-e-5 - hub-modo-liviano-y-enrutamiento-de-modelo-barato.md`
