# Plan: DAFO en la auditoría de Ariadne

## Control
- Estado: hecho
- Última actualización: 2026-09-29
- Objetivo: incorporar a la auditoría de Ariadne un análisis DAFO que ayude a decidir si una iniciativa es viable.
- Gate actual: DAFO conversacional del proyecto activo implementada en la skill instalada y en la copia del repositorio.
- Próxima acción: invocar «Ariadne, audita» desde el proyecto que se quiera evaluar.

## Alcance
### Incluye
- Añadir una sección DAFO al ledger de cada iniciativa que se quiera evaluar: fortalezas y debilidades internas, oportunidades y amenazas externas.
- Hacer que `ariadne audit` valide que la DAFO tenga contenido concreto y evidencia o contexto asociado.
- Ofrecer una modalidad interactiva opcional que formule preguntas cuando el alcance de lo que se desarrollará o sus factores DAFO sean ambiguos o insuficientes.
- Usar las respuestas para completar el contexto del análisis antes de emitir el dictamen, dejando claro qué información provino de respuestas del usuario.
- Mostrar un dictamen comprensible de viabilidad: `viable`, `viable con condiciones`, `no viable` o `evidencia insuficiente`, con motivos y condiciones pendientes.
- Mantener la auditoría de integridad existente y el formato JSON compatibles; documentar cómo interpretar el dictamen.
- Documentar el formato DAFO, los dictámenes, las preguntas y el contrato JSON.
- Permitir que la auditoría conversacional haga preguntas contextuales directamente en el chat sobre el proyecto activo completo, sin exigir `--interactive` en una terminal.

### No incluye
- Generar automáticamente factores DAFO a partir del código o de fuentes externas.
- Convertir la modalidad interactiva en un requisito para ejecutar la auditoría; debe seguir existiendo una ejecución no interactiva.
- Cambiar el estado de tareas, aprobar iniciativas o desplegar cambios a partir del dictamen.
- Dar por hecho que una tarea operativa pequeña necesita DAFO: el análisis se aplica al ledger/iniciativa evaluada.

### Restricciones
- La DAFO debe distinguir factores internos (fortalezas/debilidades) de externos (oportunidades/amenazas).
- El dictamen debe explicar su razonamiento y no basarse en una suma opaca de cuadrantes.
- Si faltan factores relevantes o evidencia para concluir, la salida debe decir `evidencia insuficiente` en vez de asumir viabilidad.
- La auditoría normal será de solo lectura; cualquier reparación requerirá una opción explícita.
- Las preguntas serán concretas y limitadas a dudas que afecten el alcance, la evidencia o la viabilidad; si no hay respuesta, el dictamen debe permanecer como `evidencia insuficiente`.
- No empezar la implementación hasta que el usuario apruebe este plan o sus ajustes.

## Métricas de éxito
- La auditoría detecta las cuatro categorías ausentes o vacías y señala en qué ledger deben completarse.
- Una DAFO completa muestra sus factores y un dictamen acompañado por razones observables.
- Casos con condiciones o evidencia insuficiente no aparecen como `viable` sin explicación.
- En modo interactivo, la auditoría pregunta solo cuando detecta una ambigüedad material, incorpora las respuestas al análisis y permite continuar sin responder con dictamen de evidencia insuficiente.
- La salida JSON conserva sus campos actuales y expone el informe DAFO de forma estructurada.
- La auditoría existente sigue funcionando para repositorios sin DAFO, con estado explícito de pendiente de evaluación en lugar de fallo ambiguo.

## Registro maestro
| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| ARIADNE-E-001 | Plan | Acordar alcance y criterios para evaluar viabilidad con DAFO | hecho | — | Usuario aprueba este plan o solicita cambios | Aprobado por la instrucción del usuario: «imlementalo» | Alcance autorizado |
| ARIADNE-E-002 | Diseño | Definir esquema DAFO, evidencia, preguntas aclaratorias y reglas del dictamen | hecho | ARIADNE-E-001 | Esquema y reglas documentados; preguntas solo ante dudas materiales; casos límite cubiertos | Formato Markdown por ledger documentado en `docs/ariadne-dafo-audit.md` | Diseño aplicado |
| ARIADNE-E-003 | Implementación | Integrar la validación, el informe DAFO y la modalidad interactiva en la auditoría | hecho | ARIADNE-E-002 | Comando y JSON muestran categorías, preguntas/respuestas cuando aplique, hallazgos y dictamen sin mutaciones implícitas | `lib/dafo-audit.js`; integración en `scripts/ariadne-audit-all.js`; respuestas interactivas no se persisten | Implementación terminada |
| ARIADNE-E-004 | Verificación | Revisar sintaxis, ejecución y documentación de la función | hecho | ARIADNE-E-003 | Sintaxis válida; el comando informa categorías y evidencia insuficiente; documentación y ledger validados | `node --check` en ambos archivos; `npm run ariadne:audit -- --json` salió con código 0; `check_plan.py`: 0 errores y 0 advertencias | Completado |
| ARIADNE-E-005 | Integración | Activar DAFO interactiva, a nivel del proyecto activo, desde solicitudes en lenguaje natural en Codex | hecho | ARIADNE-E-003 | «Ariadne, audita» evalúa el proyecto completo, usa preguntas en el chat si falta contexto material y no requiere comandos de terminal; correcciones y despliegues respetan sus gates y autorización | Instrucciones actualizadas en la skill fuente y la instalada; frontmatter YAML validado en ambas; copias coinciden | Completo |

## Riesgos
| ID | Severidad | Riesgo | Mitigación | Estado |
|---|---|---|---|---|
| ARIADNE-R-001 | Alta | Un DAFO genérico puede dar falsa confianza en una decisión de viabilidad | Exigir factores concretos con evidencia/contexto y explicar el dictamen; no usar una puntuación opaca | Abierto |
| ARIADNE-R-002 | Media | Requerir DAFO para cada ledger podría volver pesada la auditoría de planes rutinarios | Evaluar por iniciativa y reportar pendiente explícitamente; confirmar alcance antes de implementar | Abierto |
| ARIADNE-R-003 | Media | Cambiar el contrato JSON puede afectar consumidores existentes | Extender la salida de forma compatible y probar consumidores/campos actuales | Abierto |

## Decisiones
| Fecha | ID | Decisión | Motivo | Impacto |
|---|---|---|---|---|
| 2026-09-29 | ARIADNE-D-001 | DAFO por ledger/iniciativa, con dictamen explicable y sin cambios automáticos de estado | La viabilidad corresponde a una iniciativa y debe distinguirse de la higiene técnica que hoy verifica la auditoría | Aprobado por el usuario; implementado |
| 2026-09-29 | ARIADNE-D-002 | Incluir una opción interactiva para preguntar por contexto ambiguo antes de cerrar el análisis | Las respuestas pueden aclarar qué se desarrollará y mejorar la calidad de la evaluación DAFO | Aprobado por el usuario; implementado con `--interactive` |
| 2026-09-29 | ARIADNE-D-003 | Hacer que la interacción ocurra en el chat cuando el usuario pide auditar con Ariadne | El usuario quiere escribir «Ariadne, audita, corrige, despliega» sin ejecutar opciones de terminal | Implementar en la skill; conservar los gates existentes de corrección y despliegue |
| 2026-09-29 | ARIADNE-D-004 | Hacer la DAFO sobre el proyecto activo completo, no sobre la función o tarea individual | El usuario quiere saber la viabilidad del proyecto en el que está trabajando | Resolver el proyecto por el contexto activo; preguntar si hay ambigüedad |

## Diferidos
| ID | Trabajo | Motivo | Condición de reactivación |
|---|---|---|---|
| ARIADNE-DIF-001 | Generación automática de DAFO mediante IA o fuentes externas | Fuera del alcance inicial; requiere definir fuentes, trazabilidad y revisión humana | Solicitud y diseño posterior |
| ARIADNE-DIF-002 | Agregar y ejecutar pruebas automatizadas específicas para la DAFO interactiva | La solicitud actual fue implementar la función; las pruebas automatizadas quedan para una petición explícita de verificación | Cuando el usuario solicite probar o verificar la implementación |

## Historial
- 2026-09-29: creado el plan antes de modificar la implementación; pendiente de aprobación del alcance.
- 2026-09-29: añadido al plan el modo opcional de preguntas aclaratorias cuando haya dudas materiales sobre el desarrollo o su viabilidad.
- 2026-09-29: usuario autorizó la implementación; se integró informe DAFO en JSON/terminal y captura interactiva no persistente.
- 2026-09-29: sintaxis, auditoría funcional y validador del ledger ejecutados correctamente; pruebas automatizadas específicas diferidas.
- 2026-09-29: el usuario aclaró que el modo interactivo debe conversar en el chat cuando invoque Ariadne, sin depender de una línea de comandos.
- 2026-09-29: usuario confirmó que la DAFO debe ser del proyecto activo completo; skill fuente e instalada actualizadas y validadas.
