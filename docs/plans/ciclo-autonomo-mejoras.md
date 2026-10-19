# Plan: Ciclo autónomo de desarrollo para mejoras Ariadne

## Control
- Estado: implementación en curso
- Última actualización: 2026-10-14
- Objetivo: ofrecer un ciclo reusable para desarrollar tareas Enhancement (E), con planificación, construcción, pruebas, revisión adversarial, iteración correctiva y selección del modelo según complejidad.
- Gate actual: AH-E-38 In Progress; implementación local en la ruta del LaunchAgent; smoke y suite verdes; pendiente un ciclo real con los modelos locales configurados.
- Próxima acción: configurar roles CLI locales en `.ariadne/enhancement-cycle.json`, ejecutar AH-E-38 en un árbol limpio y auditar su bitácora; no marcar Done hasta revisar esa evidencia.

## Alcance
### Incluye
- Activación conversacional para una tarea de mejora `E`, usando su descripción, criterios, dependencias, plan y contexto del proyecto.
- Plan previo a editar; pregunta solo por decisiones materiales que cambien alcance, arquitectura, diseño o aceptación.
- Construcción autónoma dentro del alcance acordado, ejecución de pruebas y correcciones iterativas.
- Revisión visual y de interacción si se toca una interfaz, en los tamaños y dispositivos aplicables; revisión funcional para todo cambio.
- Un árbitro adversarial que busque fallos de aceptación, regresiones, casos límite, brechas de seguridad/accesibilidad, errores de diseño y falta de evidencia, y que entregue hallazgos reproducibles.
- Enrutamiento por tiers de complejidad: modelo económico para tareas acotadas y modelo más capaz para arquitectura, ambigüedad, riesgo, fallo persistente de pruebas y arbitraje final.
- Preferencia/override manual de modelo y registro transparente de backend, modelo y motivo de selección cuando la integración los exponga.
- El runner exige CLIs/modelos locales configurados por rol; si falta la configuración, se detiene antes de invocar proveedores. JEV es opcional y no participa en este ciclo.
- Evidencia por iteración en backlog/ledger: plan, cambios, pruebas, crítica, correcciones, dictamen y pendientes.

### No incluye
- Desplegar, publicar, mergear o ejecutar cambios externos sin autorización explícita.
- Cambiar automáticamente el modelo de una sesión de ChatGPT/Codex si la aplicación no ofrece esa capacidad.
- Agregar o activar una API/clave de proveedor por defecto, ni enviar código o datos a backends no configurados.
- Permitir que el árbitro amplíe el alcance sin aprobación; cambios de alcance se devuelven como pregunta o tarea separada.
- Marcar como aprobado un ciclo que agotó el límite de iteraciones con hallazgos pendientes.

## Diseño y políticas propuestas
1. **Enrutamiento inicial local y explicable.** Calcular una clase de trabajo usando señales visibles: cantidad de componentes afectados, riesgo, novedad arquitectónica, ambigüedad de criterios y requisitos de diseño/seguridad. No hacer una llamada adicional a un modelo solo para clasificar.
2. **Tiers configurables.** `económico` para cambios pequeños y reversibles; `capaz` para cambios transversales, diseño/arquitectura inciertos o riesgo alto. El usuario puede fijar un tier/modelo para toda la ejecución.
3. **Escalamiento.** Subir de tier si el agente reporta incertidumbre relevante, no puede resolver hallazgos, o las pruebas/árbitro detectan problemas persistentes. Si el backend seleccionado no está disponible, mantener el modelo activo y decirlo; no cambiar silenciosamente a APIs.
4. **Construcción y validación.** Crear un plan verificable; implementar; ejecutar primero pruebas focalizadas y luego las suites/gates pertinentes; reparar fallos atribuibles al cambio; inspeccionar diff y experiencia resultante.
5. **Arbitraje separado.** Pasar a un contexto de revisión separado el objetivo, criterios, diff y evidencia mínima necesaria. Pedir hallazgos con severidad, ubicación, reproducción y criterio incumplido. El árbitro no modifica código ni decide el alcance.
6. **Iteración limitada.** Repetir corrección y arbitraje hasta `PASS`, con límite configurable (propuesta inicial: 5 ciclos). En cada ciclo persistir el resultado; si llega al límite o aparece bloqueo externo/material, detenerse con estado `BLOCKED`, hallazgos abiertos y siguiente acción concreta.
7. **Independencia honesta.** Preferir otro modelo/backend para el árbitro si está configurado. Si usa el mismo modelo, mismo backend o contexto compartido, etiquetar la revisión como no independiente; no presentar la evaluación como garantía objetiva.
8. **Cierre.** `PASS` requiere aceptación cubierta, pruebas ejecutadas con resultado, diff revisado y cero hallazgos bloqueantes. Los hallazgos no bloqueantes quedan documentados. El cierre no autoriza despliegue.

## Integración actual y límites conocidos
- Ariadne ya ofrece backends por rol con primario y alternativas en `swarm/backends.js`, e indicaciones de modelo/tier por paquete en `swarm/packs.js`.
- `swarm/enhancement-cycle.js` ahora expone un ejecutor inyectable que planifica antes de editar, pregunta por ambigüedades, corre los checks locales fijados en configuración, envía el diff a un árbitro identificado por separado, itera y falla cerrado.
- `scripts/ariadne-enhancement-cycle.js` ejecuta comandos CLI locales con argumentos sin shell, exige configuración local ignorada por Git, tarea E en In Progress, dependencias FS Done, checks explícitos y un árbol de trabajo limpio salvo la tarjeta activa. Guarda snapshots acumulativos de plan, tiers/modelos, resumen de cambios con hash, verificaciones, dictámenes y hallazgos en la tarjeta. No marca Done ni despliega.
- La plantilla `docs/enhancement-cycle-config.example.json` muestra Codex para planificador, tiers económico/capaz y árbitro; cada usuario puede configurar CLI/modelos ya instalados. El árbitro debe declarar identidad distinta, pero compartir proveedor/backend no garantiza independencia intelectual. Ariadne no agrega claves ni selecciona una API de fallback.
- El gate de QA de Swarm ejecuta una lista secuencial de comandos y falla ante el primer comando fallido (`swarm/qa-gate.js`); no implementa por sí solo arbitraje adversarial ni iteración correctiva.
- El autopilot de prueba existente es una instrucción específica de Kanoa (`lib/test-plan-prompt.js`), no un ciclo general para mejoras.
- Los comandos/modelos son por instalación y deben configurarse explícitamente en `<proyecto>/.ariadne/enhancement-cycle.json`; una identidad distinta declarada no demuestra por sí sola independencia intelectual del modelo.
- La revisión visual pasa solo con evidencia PNG/JPEG/WebP local, legible y adjunta al contexto del árbitro; los checks de terminal por sí solos no demuestran calidad responsive.
- Variables de entorno sensibles no pasan a los procesos por defecto; `allowEnv` exige listar nombres explícitamente. Diffs omiten archivos con nombre de credencial, artefactos no inspeccionables, redacciones de tokens comunes y bloquean si el contexto de revisión queda incompleto.
- La CLI de ciclo permite invocación optativa desde el flujo conversacional; no puede cambiar el modelo de una sesión de ChatGPT/Codex que no se ejecute mediante un CLI configurado.

## Métricas de éxito
- La activación identifica una tarea `E` y nunca comienza a editar si faltan decisiones que cambian el resultado.
- Cada ciclo deja una bitácora breve y verificable en la tarjeta y el ledger.
- El árbitro informa hallazgos concretos; cada corrección enlaza el hallazgo con la prueba o evidencia que lo cierra.
- Ningún ciclo termina `PASS` con un criterio obligatorio sin verificar o un hallazgo bloqueante abierto.
- El modelo seleccionado y la razón se muestran cuando el backend lo informa; el override manual prevalece.
- Si falta la configuración local del tier o del árbitro, la ejecución se detiene sin hacer llamadas a modelos.
- JEV apagado/no configurado no reduce las funciones de planificar, construir, probar, auditar o iterar.
- No se realiza despliegue o publicación como consecuencia implícita de `PASS`.

## Registro maestro
| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| AH-E-38 | Diseño e implementación | Ciclo autónomo adversarial y enrutamiento de modelos para mejoras E | en_progreso | ninguna | Flujo conversacional, iterativo, arbitraje adversarial, tiers de modelo explícitos, configurables y sin llamadas no autorizadas | Runner local integrado; suite 253/253, smoke cloud 3/3, lifecycle 2/2, lint 70 archivos y auditoría sin errores; Hub LaunchAgent apunta al workspace y `/api/projects` responde; falta ciclo real con modelos locales | Configurar roles locales, asegurar árbol Git limpio, ejecutar el primer ciclo real y auditar su bitácora |

## Decisiones
| Fecha | ID | Decisión | Motivo | Impacto |
|---|---|---|---|---|
| 2026-10-14 | AUTOMEJ-D-001 | El flujo debe ser opt-in por solicitud y usar solamente modelos/backends ya configurados | El usuario quiere automatización sin llamadas implícitas a servicios externos | Ariadne no cambia modelo ni envía datos si no tiene una ruta local autorizada |
| 2026-10-14 | AUTOMEJ-D-002 | Proponer un tope inicial de cinco ciclos, configurable | Evitar iteración infinita y hacer visibles los bloqueos | Un ciclo que no logra PASS se detiene con hallazgos abiertos; nunca se declara aprobado por agotamiento |
| 2026-10-14 | AUTOMEJ-D-003 | La primera entrega recomienda el tier, pero no invoca ni cambia modelos automáticamente | La integración inicial solo listaba backends sugeridos | Decisión histórica de la primera entrega; el runner local descrito abajo la reemplaza para CLIs explícitamente configurados |
| 2026-10-14 | AUTOMEJ-D-004 | El ciclo invoca únicamente CLIs/modelos locales definidos por instalación y requiere un árbitro con identidad declarada distinta | Permitir planificación, construcción y revisión adversarial sin habilitar proveedores o claves por defecto | No hay fallback silencioso; identidad distinta no prueba independencia cuando se comparte backend |

## Diferidos
| ID | Trabajo | Motivo | Condición de reactivación |
|---|---|---|---|
| AUTOMEJ-DIF-001 | Selección autónoma de modelo dentro de la sesión de ChatGPT/Codex | Depende de que el host permita cambiar el modelo en tiempo de ejecución | Si el host ofrece un control de selección de modelo utilizable por Ariadne |

## Riesgos
| Riesgo | Mitigación |
|---|---|
| El clasificador asigna un modelo barato a trabajo difícil | Reglas conservadoras; escalamiento ante incertidumbre, cambios transversales, riesgo o fallo; override manual |
| El árbitro se limita a confirmar el trabajo | Contexto separado y guion adversarial; modelo distinto si está configurado; declarar cuando no sea independiente |
| El ciclo modifica fuera del alcance o repite indefinidamente | Scope firmado por criterios, 5 iteraciones iniciales configurables y parada explícita con pendientes |
| Modelos disponibles no permiten selección desde la sesión actual | Separar recomendación conversacional de ejecución por backends de Swarm; no prometer control universal |
| Código o datos llegan a un proveedor inesperado | Seleccionar solo backends configurados localmente; mostrar ruta/modelo; no activar proveedores o APIs por defecto |
| La recomendación se confunde con un cambio real de modelo | La salida registra tier e identidad del CLI configurado; sin configuración, el runner se detiene |

## Historial
- 2026-10-14: el usuario autorizó proceder con la formalización del ciclo autónomo para cualquier mejora `E`, definir selección de modelos baratos/capaces por complejidad y comenzar el desarrollo.
- 2026-10-14: AH-E-38 pasa a In Progress; tope inicial propuesto de cinco ciclos, override de tier y backend exclusivamente configurado.
- 2026-10-14: primera implementación en `swarm/enhancement-cycle.js`, integrada al run packet de mejoras y al API/CLI para override de tier y tope de ciclos. La skill Ariadne describe el ciclo conversacional.
- 2026-10-14: verificación: `node --test bug-queue.test.js improvement-queue.test.js` (7/7), `npm run lint` (69 archivos), `npm test` (236/236), `npm run smoke:cloud` (3/3), `npm run smoke:lifecycle` (2/2), `npm run ariadne:sync -- --fix` y `npm run ariadne:audit` (0 errores).
- 2026-10-14: checkpoint: el loop se expresa como contrato de ejecución con máximo 5 por defecto (configurable hasta 20), veredicto adversarial y condición estricta de PASS. El selector todavía no puede invocar/cambiar modelos en este runtime; diseño del adaptador local y árbitro automatizado sigue abierto.
- 2026-10-14: el usuario autorizó actualizar el Hub local. LaunchAgent ahora ejecuta `Documents/ChatGPT/Ariadne/server.js`; `ARIADNE_CATALOG_PATH` mantiene `Code/Ariadne/projects.json`, cuya entrada `ariadne` apunta al workspace actual. Se conservó la lista de los otros proyectos y JEV continúa `enabled=false, configured=false`. Respaldo previo en `/private/tmp/ariadne-hub-config-backup-20261014`.
- 2026-10-14: validación end-to-end del Hub: `/api/projects` devuelve Ariadne en el workspace con AH-E-38 activa; `npm run queue:packet -- ariadne AH-E-38` genera `.ariadne/run-packets/AH-E-38.md` y `.json`, recomienda `strong` y contiene el límite/revisión adversarial. La generación de paquete no constituye ejecución del árbitro ni cambio real de modelo.
- 2026-10-14: Backlog CLI generó una tarjeta temporal `AH-1`; se movió a borradores y se registró la tarea tipada `AH-E-38` mediante el generador Ariadne. No queda ninguna tarea activa duplicada.
- 2026-10-14: `check_plan.py` advierte que `AH-E-38` podría ser huérfana porque es un trabajo nuevo e independiente, sin dependencias ni tareas posteriores enlazadas todavía. Es intencional mientras se revisa el plan; el aviso no indica un ID faltante ni trabajo abierto sin tarjeta.
- 2026-10-14: runner implementado en `swarm/enhancement-cycle.js` y `scripts/ariadne-enhancement-cycle.js`: planeación previa obligatoria y preguntas materiales, ejecución local configurada por tier, escalamiento de barato a capaz si quedan hallazgos (el override manual prevalece), checks fijos por config validados antes de editar, árbitro con identidad distinta y modo solo lectura comprobado para Codex/Claude/Gemini, PASS condicionado por criterios/checks/hallazgos y captura visual cuando aplique, tope configurable, bitácora acumulativa en la tarjeta y sin cierre/despliegue automático. Config ejemplo en `docs/enhancement-cycle-config.example.json`; activación conversacional documentada en skill/README y skill personal.
- 2026-10-14: endurecimiento: comandos sin shell; entorno de agentes sin variables sensibles por defecto; `allowEnv` explícito; omisión/redacción de credenciales comunes en diffs, salidas y bitácoras; diff incompleto, symlinks, checks fallidos, árbitro mal formado o captura visual ausente bloquean PASS.
- 2026-10-14: verificación del runner con procesos CLI simulados y fixtures Git: 17/17 focalizadas; `npm test` 253/253 pasó con acceso local a loopback; `npm run lint` (70 archivos), `ariadne:sync -- --fix`, `ariadne:audit` (0 errores) y `git diff --check` correctos. La skill personal de Codex ya activa el runner desde solicitudes conversacionales. Sigue pendiente configurar los modelos locales de Mauricio y validar la crítica real en una tarea; AH-E-38 continúa In Progress.
- 2026-10-14: auditoría/corrección/despliegue local solicitados. `npm test` 253/253, `smoke:cloud` 3/3, `smoke:lifecycle` 2/2, lint (70 archivos), `ariadne:sync -- --fix`, `ariadne:audit` y `git diff --check` pasaron; la primera ejecución de pruebas dentro del sandbox falló por `listen EPERM` y se repitió con loopback autorizado. `launchctl` confirma `com.ariadne.hub` ejecutando `Documents/ChatGPT/Ariadne/server.js`; `/api/projects` responde y cataloga Ariadne en este workspace. No se necesitó reiniciar el Hub porque esta entrega añade runner CLI/documentación/skill, sin cambios al servidor cargado. Se corrigió la discrepancia del ledger sobre el árbitro de ejemplo. El endpoint JEV sigue fuera de uso en esta ejecución; no se invocaron modelos. No hay push ni despliegue externo.
