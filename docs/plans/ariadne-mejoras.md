# Plan: Mejoras internas de Ariadne

## Control
- Estado: pendiente
- Última actualización: 2026-07-28
- Objetivo: mantener una cola separada de mejoras para Ariadne, incluyendo ahorro de tokens, variantes livianas y automatizacion operativa sin mezclarlo con bugs productivos de JurisMate.
- Gate actual: proyecto creado para seguimiento futuro.
- Próxima acción: evaluar si conviene crear `ariadne-lite` y un wrapper de ejecucion que seleccione modelo barato cuando el pedido sea solo registrar, mover o actualizar tareas.

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
| ARIM-001 | Producto | Definir modo barato para tareas simples de Ariadne | pendiente | - | Queda definida la regla exacta de cuando usar modelo barato y cuando no | Pedido del usuario: Ariadne es principalmente leer/escribir/actualizar y debe poder costar menos tokens | Disenar `ariadne-lite` o wrapper |
| ARIM-002 | Implementacion | Crear variante `ariadne-lite` o ajuste equivalente | pendiente | ARIM-001 | El flujo limita lecturas a ledger principal y JM relevante; no audita codigo ni despliega | - | Comparar editar skill actual vs crear skill nuevo |
| ARIM-003 | Automatizacion | Evaluar wrapper de seleccion de modelo | pendiente | ARIM-001 | El wrapper detecta `/ariadne`, `$ariadne`, `agrega a ariadne` y usa modelo barato; mantiene modelo fuerte para Pharos/despliegue | - | Implementar solo si el entorno de ejecucion permite escoger modelo |
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
| ARIM-DEF-001 | Implementar wrapper real de modelo | Requiere confirmar desde donde se invoca Codex y que modelos estan disponibles | El usuario decida automatizar el flujo de ejecucion |

## Historial

- 2026-07-28: Se crea proyecto interno de mejoras de Ariadne para registrar el requerimiento de usar un modelo mas barato en tareas simples de lectura/escritura y dejarlo pendiente para evaluar luego.
