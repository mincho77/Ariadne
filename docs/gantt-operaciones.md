# Manual operativo Gantt (AH-E-29)

Guía única para operar el Gantt integrado de Ariadne en local.

## Arranque

```bash
npm start
# Hub http://127.0.0.1:4177 · Kanban http://127.0.0.1:6421
```

Variables útiles: `ARIADNE_HUB_PORT`, `ARIADNE_GANTT_BASE_URL`, `ARIADNE_CATALOG_PATH`.

## Checklist diario

1. `npm test` — regresión completa.
2. `npm run gantt:smoke` — contrato Hub ↔ backend.
3. `npm run gantt:audit` — dry-run de readiness del backlog (sin escritura).
4. Hub → tarjeta proyecto → revisar **Seguimiento Gantt** (fin pronóstico, riesgos).
5. Opcional: [Portafolio Gantt](/portfolio.html) para hitos multiproyecto.

## Flujos principales

| Objetivo | Acción |
|----------|--------|
| Ver plan de un proyecto | `GET /api/projects/{slug}/gantt` o botón **Abrir Gantt** |
| Editar fechas/estimaciones | `PATCH /api/projects/{slug}/tasks/{id}` + `If-Match` |
| Congelar línea base | `POST /api/projects/{slug}/gantt/baselines` |
| Comparar vs baseline | `GET …/gantt/baselines/{id}/compare` |
| Simular escenario | `POST …/gantt/what-if` (sin adopt por defecto) |
| Adoptar parches simulados | mismo POST + `confirmAdopt` + `confirmToken: ADOPT` |
| Vista multiproyecto | `GET /api/gantt/portfolio` o `/portfolio.html` |
| Recursos por habilidad | `?resourceAware=1` + `backlog/docs/gantt/resources.config.json` |

## Auditoría y migración (dry-run)

```bash
npm run gantt:audit              # todos los proyectos del catálogo
node scripts/gantt-backlog-audit.js ariadne   # un proyecto
```

Reporta estimaciones faltantes, dependencias inválidas y cross-project sin slug registrado. **No escribe archivos**; corrija manualmente o vía PATCH.

Migración de IDs de tarea (distinto): `node scripts/migrate-task-ids.js --all` (dry-run) / `--apply`.

## Rendimiento

El test `tests/gantt-perf.test.js` programa **1000 tareas** sintéticas y exige completar bajo umbral (~15s). Si falla en hardware lento, revise `capacity` y estimaciones extremas.

## Reversión

- **Baselines:** archivos inmutables; no editar a mano. Cree baseline nueva.
- **Parches what-if adoptados:** revertir con git en `{proyecto}/backlog/tasks/` o PATCH inverso.
- **Dependencias:** `POST …/tasks/dependencies` con lista corregida.

## Documentación por feature

| Tema | Doc |
|------|-----|
| Contrato API | `docs/gantt-planner-contract.md` |
| Temporal / PATCH | `docs/gantt-temporal-model.md` |
| Capacidad | `docs/gantt-capacity-policy.md` |
| Recursos | `docs/gantt-resources.md` |
| Holgura / CP | `docs/gantt-slack.md` |
| What-if | `docs/gantt-what-if.md` |
| Portafolio | `docs/gantt-portfolio.md` |
| Hub métricas | `docs/gantt-hub-metrics.md` |
| UI externa | `docs/gantt-ui-integration.md` |
| Ledger programa | `docs/plans/ariadne-gantt.md` |
| Visión funcional | `docs/GANTT.md` |
| Arquitectura | `docs/ARQUITECTURA.md` |

## Cierre de release (MVP Gantt)

- [ ] `npm test` verde
- [ ] `npm run gantt:smoke` verde
- [ ] `python3 skills/ariadne/scripts/check_plan.py docs/plans/ariadne-gantt.md`
- [ ] Ledger AH-E-9 … AH-E-29 en estado **hecho**
- [ ] Evidencia de perf 1000 tareas en historial del ledger
