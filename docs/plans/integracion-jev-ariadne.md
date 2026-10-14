# Plan: Integración de JEV con Ariadne para apoyar decisiones de proyecto

## Control
- Estado: AH-E-37 desplegado en el Hub local; JEV apagado y sin clave hasta rotar la credencial
- Última actualización: 2026-10-05
- Objetivo: ofrecer JEV como evaluador opcional de juicios estructurados para apoyar la auditoría DAFO y decisiones de avance de proyectos en Ariadne, sin requerirlo para instalar o usar Ariadne.
- Gate actual: código de AH-E-37 activo en `/Users/mauriciootalvaro/Code/Ariadne`; Hub arriba con `enabled=false`, `configured=false`; recomendación conversacional sin JEV disponible.
- Próxima acción: cuando haya una credencial nueva de TypeSafe, configurarla sin compartirla en chat y habilitar JEV; mantener permisos 600 y priorizar migración de la clave fuera del plist.

## Alcance
### Incluye
- Integrar la API de JEV desde el backend local de Ariadne, con llamadas al endpoint y formato de preguntas definidos por la documentación oficial de TypeSafe.
- Enviar un resumen acotado que solo puede contener `projectName`, `projectOverview`, `objective`, `intendedUsers`, `successCriteria`, `scope`, `constraints`, `evidence`, `risks` y `dependencies`.
- Evaluar señales de claridad del objetivo, criterios de éxito, validación, alcance/restricciones y preparación ante riesgos/dependencias.
- Usar resultados estructurados, probabilidades y confianza como señales separadas; Ariadne conserva su juicio DAFO basado en evidencia, sin sumas ni recomendación compuesta por JEV.
- Mostrar las señales junto a la dimensión evaluada y el contexto de evidencia disponible, dejando visibles incertidumbres y la necesidad de revisión humana.
- Pedir contexto al usuario cuando falte información material; mantener revisión humana para baja confianza, desacuerdo o datos insuficientes.
- Habilitar JEV solo por opt-in mediante el parámetro de entorno `ARIADNE_JEV_ENABLED=true`; por defecto estará desactivado para toda instalación y clonación desde GitHub.
- Cuando JEV esté habilitado, leer `TYPESAFE_API_KEY` desde configuración local del servidor. Si la opción está desactivada, Ariadne no requiere clave, no contacta TypeSafe y mantiene la DAFO base.
- Documentar ambos parámetros en `.env.example`/guía de configuración sin incluir secretos; ofrecer modo sin JEV cuando no esté configurado o el servicio falle.
- Presentar versión de rúbrica y señales junto a la auditoría en curso; no guardar ni modificar el ledger durante una auditoría de solo lectura.

### No incluye
- Delegar a JEV la conversación con el usuario o la redacción libre del informe.
- Permitir que una respuesta de JEV cambie estados de tareas, autorice cambios o despliegue.
- Enviar el repositorio completo, secretos, archivos ignorados o variables de entorno a TypeSafe.
- Hacer decisiones autónomas de negocio sin criterios, evidencia y aprobación humana.
- Desplegar el Hub fuera del entorno local.
- Activar JEV por defecto para quienes clonen o instalen Ariadne desde GitHub.
- Compartir la clave, cuenta o configuración personal de Mauricio con quienes instalen Ariadne desde GitHub.
- Prometer riesgo absoluto cero; el objetivo verificable será cero riesgos críticos/altos sin mitigación aceptada antes de habilitar una función.

### Supuestos y decisiones por confirmar
- El MVP evalúa el proyecto activo dentro del flujo de auditoría DAFO de Ariadne; no empieza como evaluador general de cualquier decisión.
- La integración corre en el backend local de Ariadne para proteger la clave API; la interfaz recibe solo el resultado necesario.
- El comportamiento por defecto es JEV apagado. Cada usuario que quiera usarlo lo habilita con `ARIADNE_JEV_ENABLED=true` y proporciona su propia `TYPESAFE_API_KEY`; sin ese parámetro Ariadne funciona igual que antes.
- Cada usuario habilita el envío externo explícitamente mediante `ARIADNE_JEV_ENABLED=true`, aporta su propia `TYPESAFE_API_KEY` y revisa los términos de TypeSafe antes de usarlo.
- La viabilidad final conserva las etiquetas `viable`, `viable con condiciones`, `no viable` y `evidencia insuficiente`; JEV aporta señales, no el dictamen por sí solo.
- JEV devuelve señales con confianza; Ariadne no fija un umbral de confianza ni calcula un puntaje global en este MVP. La salida exige decisión humana y no determina por sí sola viabilidad.

## Diseño propuesto
1. Ariadne prepara solo el objeto acotado permitido. El backend limita tamaños y redacta patrones comunes de secretos. Si `ARIADNE_JEV_ENABLED` no es `true`, no realiza llamadas externas.
2. Si faltan objetivo, criterios de éxito o evidencia, la integración devuelve `insufficient_context` y los campos faltantes; Ariadne pregunta al usuario antes de continuar.
3. El backend manda las cinco preguntas de puntuación independientes de `lib/jev.js` a `POST https://api.typesafe.ai/v1/systemone`, con modelo configurable y timeout.
4. Ariadne valida la respuesta y devuelve señales, probabilidades y confianza sin convertirlas en una suma ni en un dictamen autónomo de viabilidad. La decisión final requiere revisión humana.
5. El flujo DAFO presenta evidencia y factores por separado de las señales JEV; una falla del proveedor deja disponible el flujo base.

## Ampliación del alcance (2026-10-05)

### LLM local y aislamiento de JEV
- Ariadne seguirá siendo el Hub y servicio local de esta máquina. La DAFO conversacional debe poder invocarse desde cualquier cliente LLM local que admita una integración documentada con Ariadne (por ejemplo, herramienta/HTTP local o adaptador equivalente); no se afirmará compatibilidad universal sin probar cada vía.
- El Hub expone un contrato local estable para auditoría y contexto. Los adaptadores para distintos clientes LLM son finos y no contienen credenciales de proveedor.
- JEV es un proveedor externo opcional llamado por el backend local. Solo esta instalación local puede usar la clave que su dueño configure. La distribución de GitHub contiene código, documentación y nombres de variables de ejemplo, nunca claves ni valores personales.
- Una instalación desde GitHub arranca con JEV desactivado; para usarlo, cada instalador configura su propia cuenta y clave. No se hereda configuración de esta máquina ni se envían claves durante instalación, publicación o uso del LLM local.
- La clave no se versiona ni se pone en `projects.json`, en el navegador, el ledger o los logs. El mecanismo deseado para el servicio persistente de macOS es Keychain; hasta implementarlo, editar el plist manualmente deja la clave en texto legible y el instalador puede sobrescribirla.

### Acotar oportunidades de mejora
- La DAFO ofrece modo **Acotado** (predeterminado) y **Exploratorio** (opt-in explícito).
- En modo Acotado, limitar el análisis al proyecto activo, su objetivo y el cambio/decisión solicitado; no abrir temas de otros repositorios ni proponer una hoja de ruta general.
- Permitir seleccionar una o varias áreas: producto/usuarios, experiencia y flujo, técnica/deuda, seguridad/privacidad, rendimiento/costo, integraciones y adopción/operación. Ofrecer “solo lo que pedí” como opción más estricta.
- Limitar la salida a un máximo configurable de oportunidades (predeterminado: 3), horizonte (próximo paso / trimestre / futuro) y esfuerzo (pequeño / medio / grande). Si falta alcance, preguntar antes de ampliar; sugerir oportunidades adicionales en una sección colapsada solo si el usuario lo pide.
- Cada oportunidad debe incluir vínculo a evidencia o etiqueta de hipótesis, impacto esperado, esfuerzo, dependencias, horizonte y siguiente validación. No presentar ideas sin evidencia como hallazgos.

### Amenazas y criterio de salida segura
- “Amenazas en cero” se traduce a **cero amenazas críticas/altas abiertas o sin mitigación para habilitar la función**; los riesgos residuales de baja severidad se documentan con su condición y dueño. No se declarará riesgo absoluto cero.
- Con JEV desactivado: no hay llamadas externas ni salida de datos a JEV. Con JEV activo: mostrar el proveedor y el resumen exacto permitido que saldrá, con consentimiento por auditoría; mantener allowlist, mínimo de datos, timeout, no-retry y fallback local.
- Mantener Hub ligado a loopback; revisar CORS/origin/CSRF y controles de acceso del endpoint JEV para reducir llamadas desde páginas locales no confiables. No aceptar argumentos que permitan convertirlo en proxy arbitrario.
- Guardar la clave en macOS Keychain, resolverla solo en backend al iniciar la llamada, no reflejar su valor en status/errores/logs, y probar rotación/revocación. Para clones GitHub, usar únicamente la clave configurada por esa instalación.
- Gate de activación: revisión de amenazas y privacidad, pruebas de modo apagado/activo, verificación de que no hay secretos en salida Git, y lista de riesgos residuales aceptados. Cualquier hallazgo crítico/alto bloquea la habilitación hasta corregirse.

### Tareas nuevas planificadas
| ID | Fase | Tarea | Estado | Depende de | Aceptación | Próxima acción |
|---|---|---|---|---|---|---|
| ARIADNE-JEV-008 | Arquitectura local | Definir contrato de auditoría local y adaptadores para clientes LLM locales | pendiente | ARIADNE-JEV-007 | Un cliente compatible puede iniciar DAFO del proyecto activo sin acoplar el Hub a un LLM o clave concreta; límites de compatibilidad documentados | Diseñar interfaz y matriz de clientes |
| ARIADNE-JEV-009 | Configuración segura | Guardar/leer clave JEV con macOS Keychain para Hub persistente y documentar configuración por instalación | pendiente | ARIADNE-JEV-007 | Ninguna clave en Git/plist/log/UI; el LaunchAgent local usa solo la credencial personal; instalación GitHub desactivada hasta que su dueño configure su propia clave | Implementar almacenamiento seguro y migración desde variables de entorno |
| ARIADNE-JEV-010 | DAFO | Añadir controles Acotado/Exploratorio, áreas, horizonte, esfuerzo y máximo de oportunidades | pendiente | ARIADNE-JEV-005 | Predeterminado Acotado, hasta 3 oportunidades, evidencia/hipótesis etiquetada y preguntas aclaratorias cuando el alcance sea materialmente ambiguo | Diseñar payload y diálogo de alcance |
| ARIADNE-JEV-011 | Seguridad | Revisar amenazas del flujo local/JEV y cerrar hallazgos críticos/altos | pendiente | ARIADNE-JEV-008, ARIADNE-JEV-009, ARIADNE-JEV-010 | Threat model revisado, pruebas de loopback/origin/CSRF, allowlist y secretos; cero hallazgos críticos/altos abiertos para habilitación y residuales registrados | Ejecutar revisión antes de habilitar |
| ARIADNE-JEV-012 | Decisión de inicio | Comparar tareas candidatas del backlog para recomendar por dónde iniciar, usando señales JEV opcionales | hecho | ARIADNE-JEV-005 | Analiza hasta 5 candidatas elegibles; muestra evidencia y señales por dimensión; pregunta por contexto insuficiente; no cambia estado ni encola sin autorización; mantiene modo conversacional sin JEV | AH-E-37; unit, smoke, lifecycle, suite completa y auditoría del plan correctos | Función implementada en esta copia; despliegue local queda separado |

## Métricas de éxito
- La llamada se realiza desde el backend y la clave no aparece en navegador, logs, repositorio, ledger ni respuestas de error.
- El estado enviado contiene solo campos permitidos; no incluye archivos ni el repositorio íntegro.
- Las preguntas son atómicas, tipadas, versionadas y cubren solo dimensiones aprobadas.
- Cada evaluación incluye respuesta estructurada, probabilidades/confianza disponibles y versión de rúbrica; quien la presenta conserva el vínculo entre contexto y evidencia del proyecto.
- Fallos de API, baja confianza y falta de datos no se presentan como aprobación de viabilidad.
- El informe explica qué decisión es regla de Ariadne y qué señales provienen de JEV; no hay mutaciones de tareas ni despliegues automáticos.
- El modo sin clave/API mantiene disponible el flujo actual de DAFO.
- Una instalación nueva o clonada desde GitHub inicia con JEV desactivado, sin necesitar cuenta, clave API ni configuración adicional.
- Activar `ARIADNE_JEV_ENABLED=true` habilita el proveedor solo si existe `TYPESAFE_API_KEY`; quitarlo o establecerlo en `false` devuelve al comportamiento base sin JEV.
- La guía de instalación/configuración deja claro cómo habilitar y deshabilitar JEV y que cada usuario usa su propia clave.
- Contexto insuficiente se detecta antes de llamar a TypeSafe; se devuelven los campos requeridos para que Ariadne pueda preguntar en la conversación.
- Las respuestas de JEV son señales de preparación, no una DAFO generada ni una decisión automática de viabilidad.

## Registro maestro
| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| ARIADNE-JEV-001 | Plan | Aprobar alcance del MVP, DAFO inicial y opt-in por parámetro | hecho | — | Usuario autoriza empezar desarrollo y confirma el opt-in | Solicitud del usuario del 2026-10-03 | Alcance autorizado |
| ARIADNE-JEV-002 | Diseño | Definir rúbrica, preguntas JEV, opciones, criterios y tratamiento de incertidumbre | hecho | ARIADNE-JEV-001 | Preguntas atómicas versionadas; señales separadas del dictamen; confianza expuesta sin puntaje agregado | AH-E-30; contrato/preguntas en `lib/jev.js` | Diseño aplicado |
| ARIADNE-JEV-003 | Datos y seguridad | Definir campos permitidos, redacción de secretos, opt-in y errores seguros | hecho | ARIADNE-JEV-001 | Lista permitida y límites definidos; proveedor apagado por defecto; errores no exponen clave | AH-E-30 y AH-E-31; allowlist y redacción en `lib/jev.js` | Política base aplicada; revisar términos antes de activar |
| ARIADNE-JEV-004 | Integración | Implementar cliente backend JEV y validación del contrato de respuesta | hecho | ARIADNE-JEV-002, ARIADNE-JEV-003 | Timeout, errores, validación de respuestas y modo desactivado; clave solo backend | AH-E-31; implementación en `lib/jev.js`; validación automatizada pendiente en AH-E-35 | Cliente implementado; ejecutar pruebas de contrato |
| ARIADNE-JEV-005 | Flujo DAFO | Exponer evaluación JEV y conectar señales a la auditoría del proyecto activo | hecho | ARIADNE-JEV-004 | Contexto acotado, preguntas si faltan datos, salida explicable y DAFO base disponible | AH-E-32 y AH-E-33 hechos; endpoint en `server.js`; skills de repo y global consultan estado y presentan señales ligadas a evidencia | Flujo conversacional conectado |
| ARIADNE-JEV-006 | Verificación | Verificar seguridad, compatibilidad y escenarios de evaluación | hecho | ARIADNE-JEV-005 | Verificar modo apagado/activo, error de clave, contexto ausente, timeout y protección de secretos | AH-E-35; `npm test` 128/128 con Node 20, UTC y catálogo aislado; smoke cloud 3/3; lifecycle 2/2; JEV 6/6; sync/audit sin errores de ledger/higiene/drift | Gates de código cerrados |
| ARIADNE-JEV-007 | Despliegue local | Desplegar soporte opcional en el Hub local sin opt-in por defecto | hecho | ARIADNE-JEV-006 | LaunchAgent actualizado; status y endpoint responden con el proveedor apagado | AH-E-36; status HTTP 200, `enabled=false`, `configured=false`; POST devuelve `provider_disabled` | Despliegue verificado |
| ARIADNE-JEV-012 | Decisión de inicio | Comparar tareas candidatas del backlog para recomendar por dónde iniciar, usando señales JEV opcionales | en_progreso | ARIADNE-JEV-005 | Analiza hasta 5 candidatas elegibles; muestra evidencia y señales por dimensión; pregunta por contexto insuficiente; no cambia estado ni encola sin autorización; mantiene modo conversacional sin JEV | AH-E-37; en desarrollo | Implementar contrato, endpoint local y guía conversacional |

## Riesgos
| ID | Severidad | Riesgo | Mitigación | Estado |
|---|---|---|---|---|
| ARIADNE-JEV-R-001 | Alta | Contexto del proyecto o código sensible podría enviarse a un proveedor externo | Minimizar estado, aplicar lista permitida y redacción de secretos; exigir decisión explícita sobre datos y revisar términos antes de uso | Abierto |
| ARIADNE-JEV-R-002 | Alta | Probabilidades/confianza podrían confundirse con certeza objetiva de viabilidad | Presentarlas como señales del modelo; validar con ejemplos; mostrar evidencia, incertidumbre y revisión humana | Abierto |
| ARIADNE-JEV-R-003 | Media | Cambios en API/modelo o límites de servicio interrumpen auditoría | Cliente aislado, timeout, errores explícitos y fallback a modo DAFO sin JEV | Abierto |
| ARIADNE-JEV-R-004 | Media | Una rúbrica sesgada o mal definida produce recomendaciones inconsistentes | Versionar criterios, separar preguntas, componer mediante reglas explícitas y revisar resultados con casos de referencia | Abierto |
| ARIADNE-JEV-R-005 | Media | El Hub local activo y esta copia de trabajo pueden no ser el mismo checkout | Los cambios se portaron al checkout exacto del LaunchAgent sin reemplazar sus funciones adicionales | Mitigado |
| ARIADNE-JEV-R-006 | Media | El catálogo personal actual informa 155 incidencias Gantt ajenas a la integración | No modificar otros proyectos; aislar pruebas y mantener su auditoría como trabajo separado | Abierto |
| ARIADNE-JEV-R-007 | Alta | La clave añadida manualmente al plist quedaría en texto legible y el instalador puede reemplazarla | Migrar a Keychain; no comprometer el valor en Git y restringir permisos del plist mientras siga siendo el mecanismo provisional | Abierto; bloquea activar JEV persistente con clave real hasta resolverlo |
| ARIADNE-JEV-R-008 | Alta | Un cliente web local no confiable podría intentar invocar endpoints locales | Revisar CORS, Origin, CSRF y autenticación local del endpoint; mantener bind a loopback y payload estricto | Pendiente de revisión |
| ARIADNE-JEV-R-009 | Media | “Cualquier LLM local” puede interpretarse como compatibilidad automática con clientes sin interfaz de herramientas | Definir contrato HTTP/adapter y declarar por cliente cuáles fueron integrados y verificados | Pendiente |
| ARIADNE-JEV-R-010 | Alta | Una recomendación de primera tarea basada solo en señales del modelo puede ignorar bloqueos reales o prioridad del usuario | Incluir dependencias/gates del backlog y evidencia como reglas; mostrar razones y confianza; no mutar cola ni estado sin autorización | Pendiente |

## Decisiones
| Fecha | ID | Decisión | Motivo | Impacto |
|---|---|---|---|---|
| 2026-10-03 | ARIADNE-JEV-D-001 | JEV será una señal estructurada para preguntas acotadas; Ariadne compone el dictamen y conversa con el usuario | JEV está diseñado para respuestas tipadas, no para redactar ni conducir diálogo | Conserva explicación, reglas y control humano en Ariadne |
| 2026-10-03 | ARIADNE-JEV-D-002 | Al crear la propuesta no se inició implementación hasta recibir autorización | El usuario pidió armar un plan antes de integrar | Supersedida por ARIADNE-JEV-D-006 |
| 2026-10-03 | ARIADNE-JEV-D-003 | El primer alcance propuesto es DAFO del proyecto activo en el Hub local | Da continuidad a la función DAFO conversacional solicitada y a la preferencia local expresada antes | Deja otras decisiones generales para fases futuras |
| 2026-10-03 | ARIADNE-JEV-D-004 | JEV será optativo y estará desactivado por defecto; `ARIADNE_JEV_ENABLED=true` lo habilita y `TYPESAFE_API_KEY` aporta la credencial del usuario | El repositorio de GitHub debe poder usarse completo sin depender de TypeSafe; cada persona decide si activa el proveedor | Sin flag Ariadne no envía datos externos ni exige clave; la DAFO existente sigue funcionando |
| 2026-10-03 | ARIADNE-JEV-D-006 | Iniciar el desarrollo y registrar la integración como trabajo del proyecto Ariadne | Autorización explícita del usuario: «arranquemos con el desarrollo, agrega las tareas nuevas a ariadne para el propio proyecto de ariadne y empecemos a desarrollarlo» | Plan en ejecución; tareas AH-E-30…AH-E-36 creadas en el backlog del repo |
| 2026-10-03 | ARIADNE-JEV-D-005 | El MVP devuelve señales estructuradas de preparación y siempre exige decisión humana; no calcula un dictamen de viabilidad automático | JEV no redacta una DAFO conversacional y la rúbrica no está calibrada para automatizar viabilidad | Evita presentar confianza del modelo como decisión objetiva |
| 2026-10-03 | ARIADNE-JEV-D-007 | En el checkout local activo AH-E-30…36 ya están asignadas; la integración se registró allí como AH-E-52…58 | El LaunchAgent usa `/Users/mauriciootalvaro/Code/Ariadne`, con backlog distinto al checkout de trabajo | Se preservan IDs de ambas copias sin sobrescribir tareas previas |
| 2026-10-05 | ARIADNE-JEV-D-008 | El uso personal corre solo en el Hub local; la publicación de GitHub no incluye credenciales y cada instalación opta por su propia clave | Aislar datos y cuentas por instalación | La clave nunca viaja con el código; JEV permanece apagado de fábrica |
| 2026-10-05 | ARIADNE-JEV-D-009 | “Cualquier LLM local” se soportará mediante contrato/adaptadores; la compatibilidad se afirma solo para clientes integrados | Los clientes locales exponen interfaces distintas | Permite extensibilidad sin prometer integración universal implícita |
| 2026-10-05 | ARIADNE-JEV-D-010 | La DAFO usa alcance Acotado por defecto, máximo 3 oportunidades y Exploratorio opt-in | Evitar recomendaciones dispersas y mantener foco en decisión/proyecto | El usuario controla dominios, cantidad, esfuerzo y horizonte |
| 2026-10-05 | ARIADNE-JEV-D-011 | El gate de amenaza será cero hallazgos críticos/altos abiertos, no cero riesgo absoluto | Ningún sistema local o conexión externa permite demostrar riesgo absoluto cero | Se documentarán y aceptarán riesgos residuales antes de habilitar |
| 2026-10-05 | ARIADNE-JEV-D-012 | Usar macOS Keychain como destino para el secreto del Hub persistente | El LaunchAgent actual persiste en `~/Library/LaunchAgents/com.ariadne.hub.plist`, que es texto y lo regenera el instalador | La clave debe quedar fuera del repo y del plist al completar ARIADNE-JEV-009 |
| 2026-10-05 | ARIADNE-JEV-D-013 | Permitir que JEV ayude a seleccionar con qué tarea iniciar un desarrollo, evaluando opciones acotadas del backlog activo | La selección del primer punto de trabajo es una decisión del proyecto donde señales estructuradas pueden ayudar | JEV puntúa opciones; Ariadne sintetiza evidencia y restricciones; el usuario autoriza cualquier cambio de cola/estado |

## Diferidos
| ID | Trabajo | Motivo | Condición de reactivación |
|---|---|---|---|
| ARIADNE-JEV-DIF-001 | Usar JEV para priorización general, asignación de tareas o decisiones de despliegue | Primero validar el caso acotado de DAFO y la rúbrica | MVP DAFO aceptado y evidencia de calidad suficiente |
| ARIADNE-JEV-DIF-002 | Ejecutar comparativas sistemáticas de JEV contra análisis humano u otros modelos | Requiere conjunto de casos de referencia y criterios acordados | Antes de usar la recomendación como gate de producción |
| ARIADNE-JEV-DIF-003 | Declarar compatibilidad automática con todo LLM local | No hay interfaz universal común a todos los clientes | Un adaptador se implementa y verifica por cliente |

## Historial
- 2026-10-03: creado como propuesta de integración; no se realizaron cambios de código ni llamadas a JEV.
- 2026-10-03: el usuario aclaró que JEV debe ser opcional para quienes clonen/instalen Ariadne desde GitHub; el plan establece opt-in mediante `ARIADNE_JEV_ENABLED=true`, apagado por defecto y funcionamiento base sin JEV.
- 2026-10-03: el usuario autorizó iniciar el desarrollo y registrar trabajo en el backlog de Ariadne. Se crearon AH-E-30…AH-E-36; se completaron el contrato/rúbrica AH-E-30, el cliente AH-E-31 y la documentación AH-E-34; AH-E-32 sigue en progreso.
- 2026-10-03: `node --check` pasó en `server.js` y `lib/jev.js`; `ariadne-sync --fix --json` y `ariadne-audit-all --json` reportaron 0 errores de ledger/higiene/drift. Los comandos `npm run smoke:cloud`, `npm run smoke:lifecycle` y `npm test` no emitieron resultados luego de TAP y se interrumpieron. Se confirmó que el sandbox impide enlazar loopback (`EPERM`), así que esa evidencia no demuestra que las pruebas fallen en una ejecución local normal.
- 2026-10-03: revisión DAFO/código: el cliente (AH-E-31) ya está implementado; el gate se mueve a revisar/probar la ruta (AH-E-32). Se corrigió la descripción del diseño para que JEV aporte señales independientes sin recomendación compuesta. La ruta todavía no está conectada a una interfaz DAFO de Hub (AH-E-33).
- 2026-10-03: pruebas del checkout activo: `npm test` 128/128 (Node 20, UTC y catálogo temporal vacío); smoke cloud 3/3; lifecycle 2/2; JEV 6/6; sync/audit con cero errores de ledger/higiene/drift. El catálogo real presenta 155 incidencias Gantt preexistentes que no se cambiaron.
- 2026-10-03: despliegue local terminado en `/Users/mauriciootalvaro/Code/Ariadne`; LaunchAgent reiniciado con `kickstart` tras confirmar que ya estaba cargado. GET status devolvió `enabled=false`, `configured=false`; POST DAFO devolvió `provider_disabled`. No se agregó clave ni se llamó a TypeSafe.
- 2026-10-03: `npm audit` detectó GHSA-48c2-rrv3-qjmp en `yaml` 2.8.2; se actualizó a `^2.8.3`. `npm audit` quedó en cero vulnerabilidades y las suites 128/128, smoke cloud 3/3 y lifecycle 2/2 pasaron después del cambio.
- 2026-10-05: ampliación del plan: uso local con adaptadores para LLMs compatibles, JEV estrictamente por instalación con clave propia, opciones para acotar oportunidades y gate de cero hallazgos críticos/altos abiertos. No se inició implementación de estas tareas.
- 2026-10-05: inspección local: el Hub activo se lanza desde `/Users/mauriciootalvaro/Code/Ariadne` con `~/Library/LaunchAgents/com.ariadne.hub.plist`; no hay carga automática de `.env`. El plist actual contiene solo puertos, pero cualquier clave añadida allí quedaría en texto plano y el instalador lo regenera.
- 2026-10-05: comparación exploratoria autorizada contra GPT-6 Luna. Se envió a TypeSafe/JEV el mismo resumen no secreto de Ariadne previsto para la línea base; respuesta en 0.793 s de extremo a extremo, modelo resuelto `jev-1.13.0`, rúbrica `dafo-readiness-v1`. Señales: objetivo 1.94 (confianza 0.91), criterios 1.91 (0.86), evidencia/validación 1.13 (0.80), alcance/restricciones 1.98 (0.98), riesgos/dependencias 1.02 (0.74), escala 0–2. No se pudo ejecutar Luna porque `OPENAI_API_KEY` no está configurada en esta sesión. El endpoint Ariadne no conserva el uso de tokens de TypeSafe; costo exacto pendiente. Este es un sondeo preliminar con un resumen compacto, no un benchmark ciego de calidad.
- 2026-10-05: el usuario autorizó desarrollar AH-E-37 para recomendar con qué tarea iniciar; estado movido a In Progress. La implementación ocurre en la copia de trabajo; aún no se despliega al LaunchAgent.
- 2026-10-05: AH-E-37 implementado en esta copia: endpoint local compara hasta cinco tareas abiertas, filtra dependencias bloqueantes, transmite a JEV metadatos permitidos y rúbrica versionada, pregunta si falta contexto, informa uso/latencia cuando TypeSafe lo entrega y nunca cambia la cola. La guía conversacional sintetiza señales con evidencia del backlog, propone orden y próximo paso y deja la decisión al usuario. En esta copia: `node --check`, JEV 9/9, smoke cloud 3/3, lifecycle 2/2, suite 234/234, sync/audit y check_plan sin errores.
- 2026-10-05: despliegue selectivo a `/Users/mauriciootalvaro/Code/Ariadne`, preservando sus cambios locales; respaldo en `/private/tmp/ariadne-ah-e37-backup-2026-10-05T19-50-41-761Z`. Con Node 20: JEV 6/6, smoke cloud 3/3, lifecycle 2/2, suite 128/128. LaunchAgent reiniciado con `kickstart -k`; GET status responde, endpoint nuevo rechaza Origin externo (403), sin invocación a TypeSafe. El plist del LaunchAgent quedó con permisos 600. La configuración local reportó JEV enabled/configured; la salida de inspección incluyó accidentalmente el valor de la credencial. No se reutilizó ni se envió a TypeSafe; rotación pendiente inmediata.
- 2026-10-05: por solicitud del usuario, se eliminó `TYPESAFE_API_KEY` del plist y se fijó `ARIADNE_JEV_ENABLED=false`. `launchctl load -w` recargó la configuración; GET `/api/jev/status` confirma `enabled=false`, `configured=false`. Hub activo; modo base funciona y no llama a TypeSafe. La clave antigua debe rotarse antes de volver a habilitar JEV.
