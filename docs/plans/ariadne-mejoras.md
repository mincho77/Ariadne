# Plan: Mejoras internas de Ariadne

## Control
- Estado: en_progreso
- Última actualización: 2026-08-04
- Objetivo: mantener una cola separada de mejoras para Ariadne, incluyendo ahorro de tokens, variantes livianas y automatizacion operativa sin mezclarlo con bugs productivos de JurisMate.
- Gate actual: launcher in-repo + pipeline `npm run ariadne:sync`; modelo barato sigue diferido.
- Próxima acción: usar `ariadne:sync` en hooks de agente; retomar ARIM-DEF-001 solo si Cursor expone modelo por skill.

## Alcance

### Incluye

- Mejoras del skill Ariadne y su flujo operativo.
- Tareas de costo, compactacion y variantes livianas.
- Mejoras de tablero local que afecten la gestion de Ariadne.
- Documentacion de reglas para uso futuro.
- Pipeline automatizado post-edicion de ledgers (`ariadne:sync`).

### No incluye

- Cambios de produccion de JurisMate.
- Auditorias tecnicas tipo Pharos.
- Despliegues productivos.
- Reglas globales de seleccion de modelo fuera del wrapper o cliente que invoque Codex.

### Restricciones

- Un skill no debe asumir que puede forzar el modelo por si mismo.
- La seleccion automatica de modelo debe vivir en la capa que invoca a Codex, CLI, API o wrapper.
- Cualquier variante liviana debe conservar evidencia minima y validacion del ledger.

## Métricas de éxito

- Existe una variante o modo liviano documentado para actualizaciones simples de Ariadne.
- Tras editar un ledger, un solo comando valida y opcionalmente corrige higiene (`npm run ariadne:sync`).
- El wrapper de modelo barato, si se implementa, enruta lite vs full; hasta entonces el launcher solo exporta skill path.
- `check_plan.py` sigue pasando sobre los ledgers modificados.

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptacion | Evidencia / notas | Proxima accion |
|---|---|---|---|---|---|---|---|
| ARIM-001 | Producto | Definir modo barato para tareas simples de Ariadne | hecho | - | Reglas en docs/ariadne-lite.md | AH-E-5; tabla lite vs full | Mantener |
| ARIM-002 | Implementacion | Crear variante `ariadne-lite` o ajuste equivalente | hecho | ARIM-001 | skills/ariadne-lite/SKILL.md | npm test ariadne-lite | — |
| ARIM-003 | Automatizacion | Cablear launcher route-hint in-repo | hecho | ARIM-001 | JSON/shell exportan skill path y env; sin forzar modelo | scripts/ariadne-launcher.js; docs/ariadne-launcher.md | Mantener |
| ARIM-004 | Validacion | Smoke del launcher y audit lite | hecho | ARIM-002, ARIM-003 | Tests launcher + audit pasan; check_plan verde | tests/ariadne-launcher.test.js; sin medicion de tokens aun | — |
| ARIM-005 | Automatizacion | Pipeline sync post-edicion de ledgers | hecho | ARIM-003 | `npm run ariadne:sync` audita, fix opcional y valida check_plan | scripts/ariadne-sync.js; docs/ariadne-automation.md | Usar en agentes/CI |

## Riesgos

| ID | Severidad | Riesgo | Mitigacion | Estado |
|---|---|---|---|---|
| ARIM-RISK-001 | media | Un modelo barato puede perder contexto y cerrar tareas sin evidencia | Mantener reglas binarias de evidencia y validacion obligatoria | abierto |
| ARIM-RISK-002 | baja | El wrapper no existe o la interfaz no permite escoger modelo por skill | Documentar como mejora diferida y no depender de esto para operar | abierto |

## Decisiones

| Fecha | ID | Decision | Motivo | Impacto |
|---|---|---|---|---|
| 2026-07-28 | ARIM-DEC-001 | Separar mejoras de Ariadne en un ledger propio | Evita mezclar trabajo interno de Ariadne con bugs o features productivos de JurisMate | Ariadne tiene su propio proyecto de mejoras |
| 2026-07-28 | ARIM-DEC-002 | No intentar forzar modelo desde `SKILL.md` | La seleccion de modelo pertenece al cliente, CLI, API o wrapper que invoca Codex | La solucion probable es `ariadne-lite` mas enrutamiento externo |
| 2026-08-04 | ARIM-DEC-003 | Automatizar con `ariadne:sync`, diferir modelo barato | El cliente no expone tier por skill; sync da valor inmediato a agentes | ARIM-DEF-001 sin fecha; ARIM-005 cierra operacion |

## Diferidos

| ID | Trabajo | Motivo | Condicion de reactivacion |
|---|---|---|---|
| ARIM-DEF-001 | Wrapper que elige modelo barato en Cursor/Codex | La CLI no permite forzar tier por skill hoy | Cursor/Codex exponga modelo por regla, hook o API |

## Historial

- 2026-08-04: ARIM-005 — `npm run ariadne:sync` (audit + fix opcional + check_plan); docs/ariadne-automation.md; ARIM-003/004 acotados (launcher in-repo, sin medicion tokens).
- 2026-08-04: ARIM-003/004 — launcher + tests; modelo barato permanece en ARIM-DEF-001.
- 2026-08-05: AH-E-5 — skill `ariadne-lite`, docs/ariadne-lite.md, route-hint CLI; ARIM-001/002 hecho.
