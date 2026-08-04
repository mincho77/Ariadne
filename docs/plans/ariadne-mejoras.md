# Plan: Mejoras internas de Ariadne

## Control
- Estado: en_progreso
- Última actualización: 2026-08-05
- Objetivo: mantener una cola separada de mejoras para Ariadne, incluyendo ahorro de tokens, variantes livianas y automatizacion operativa sin mezclarlo con bugs productivos de JurisMate.
- Gate actual: AH-E-5 cerrada; skill `ariadne-lite` disponible.
- Próxima acción: integrar `ariadne-route-hint` en launcher externo si el cliente permite elegir modelo.

## Alcance

### Incluye

- Mejoras del skill Ariadne y su flujo operativo.
- Tareas de costo, compactacion y variantes livianas.
- Mejoras de tablero local que afecten la gestion de Ariadne.
- Documentacion de reglas para uso futuro.

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
- Las tareas simples de Ariadne leen menos contexto que el flujo completo.
- El wrapper, si se implementa, enruta `/ariadne` o `ariadne-lite` a un modelo barato y deja `pharos`, auditorias y despliegues en un modelo fuerte.
- `check_plan.py` sigue pasando sobre los ledgers modificados.

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptacion | Evidencia / notas | Proxima accion |
|---|---|---|---|---|---|---|---|
| ARIM-001 | Producto | Definir modo barato para tareas simples de Ariadne | hecho | - | Reglas en docs/ariadne-lite.md | AH-E-5; tabla lite vs full | Mantener |
| ARIM-002 | Implementacion | Crear variante `ariadne-lite` o ajuste equivalente | hecho | ARIM-001 | skills/ariadne-lite/SKILL.md | npm test ariadne-lite | — |
| ARIM-003 | Automatizacion | Evaluar wrapper de seleccion de modelo | diferido | ARIM-001 | Hint CLI listo; modelo lo elige Cursor/Codex | scripts/ariadne-route-hint.js | Integrar en launcher |
| ARIM-004 | Validacion | Medir ahorro y seguridad del flujo | pendiente | ARIM-002, ARIM-003 | Una prueba real actualiza una tarea Ariadne con menos contexto y `check_plan.py` pasa | - | Ejecutar una actualizacion no critica |

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

## Diferidos

| ID | Trabajo | Motivo | Condicion de reactivacion |
|---|---|---|---|
| ARIM-DEF-001 | Implementar wrapper real de modelo | Requiere confirmar desde donde se invoca Codex y que modelos estan disponibles | Hint `npm run ariadne:route-hint` entregado; falta cableado en cliente |

## Historial

- 2026-08-05: AH-E-5 — skill `ariadne-lite`, docs/ariadne-lite.md, route-hint CLI; ARIM-001/002 hecho.
