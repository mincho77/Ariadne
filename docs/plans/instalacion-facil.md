# Plan: instalación sencilla de Ariadne

## Control
- Estado: implementación en curso
- Última actualización: 2026-11-09
- Objetivo: permitir que una persona instale, configure y abra Ariadne en macOS, Windows o Linux sin conocer comandos internos ni editar archivos de servicio a mano; preparar el proyecto para una futura distribución con `npx`.
- Gate actual: setup y doctor implementados; suite, auditoría y matriz CI pasan. AH-E-39 y AH-E-40 están cerradas; AH-E-41 sigue en progreso hasta probar instalación/desinstalación real del servicio en una sesión nativa; AH-E-42 depende de confirmar el nombre npm.
- Próxima acción: publicar PR para ejecutar la matriz multiplataforma y revisar cambios.

## Alcance
### Incluye
- Asistente `npm run setup` que verifica Node.js/dependencias, configura el catálogo local de proyectos y explica cómo abrir el Hub.
- Registro guiado de proyectos existentes, conservando las entradas existentes y sin versionar rutas locales.
- `npm run doctor` con diagnóstico comprensible y pasos concretos para reparar problemas comunes.
- Inicio automático opcional para el usuario actual en macOS, Windows y Linux, con inicio manual como alternativa.
- Guías breves en inglés y español, pruebas automatizadas y preparación del ejecutable/paquete para `npx`.
- `npm pack --dry-run` y verificación reproducible de los archivos del paquete.

### No incluye
- Publicar el paquete en npm en esta entrega. La publicación requiere una decisión explícita posterior, confirmar la cuenta/nombre y revisar el paquete final.
- Instalar Node.js por el usuario, solicitar permisos de administrador, escribir secretos o enviar datos a servicios externos.
- Cambiar el funcionamiento de JEV o el ciclo de mejora autónoma AH-E-38.
- Prometer soporte nativo de autoinicio cuando el sistema operativo no tenga el servicio requerido; en ese caso se explica el inicio manual.

### Restricciones
- Mantener `projects.json` local y fuera de Git; respetar `ARIADNE_CATALOG_PATH`.
- No reemplazar un catálogo inválido, agregar una ruta duplicada ni sobrescribir la configuración del proyecto sin confirmación.
- Usar dependencias actuales del proyecto cuando sea posible y no ejecutar comandos mediante un shell construido desde texto del usuario.
- La versión de Node requerida debe coincidir con `package.json` y la guía de instalación.
- Validar scripts y definiciones para los tres sistemas operativos; el desarrollo de esta sesión se realiza en macOS.
- El paquete sigue sin publicarse hasta la aprobación explícita de la persona propietaria.

## Métricas de éxito
- Una persona con Git y Node.js instalados llega al Hub siguiendo una guía breve de cinco acciones, sin editar plist, variables de entorno ni archivos JSON manualmente.
- `npm run setup` termina sin pérdida de datos y registra un proyecto por ruta absoluta, con duplicados y rutas inválidas identificados claramente.
- `npm run doctor` termina con código cero cuando la instalación está sana y señala exactamente cómo corregir cada problema cuando no lo está.
- El inicio manual funciona en los tres sistemas; el autoinicio es opcional, por usuario y reversible.
- Pruebas automatizadas cubren el asistente, el catálogo, el diagnóstico y simulaciones de configuración de los tres sistemas.
- `npm pack --dry-run` incluye los archivos de runtime y excluye catálogos locales, credenciales, pruebas y sandboxes.
- Las instrucciones de uso quedan disponibles en inglés y español; el paquete solo queda marcado como publicable cuando su nombre y metadatos se hayan verificado.

## DAFO del proyecto Ariadne

Contexto: evaluación del producto Ariadne completo, con foco en que personas nuevas lo instalen y usen localmente. Evidencia revisada: `README.md`, `package.json`, `docs/launchagent-hub.md`, `docs/cloud-dev-environment.md`, `scripts/install-hub-launchagent.js`, `server.js` y el ledger AH-E-38.

### Fortalezas
- Hub local multiproyecto: el usuario conserva proyectos y tareas en su disco; no necesita alojar sus datos en Ariadne.
- Tareas y planes en Markdown/YAML con Git, lo que permite auditoría y colaboración sin una base de datos propietaria.
- El producto reúne tablero Kanban, planificación Gantt, DAFO y flujos de ejecución; el README y el servidor muestran rutas locales y API documentada.
- El ciclo autónomo de mejoras ya tiene límites, árbitro, registro y uso explícito de CLIs configurados por el usuario.

### Debilidades
- La guía actual requiere que la persona descubra `npm install`, `npm start` y la URL local; no hay una verificación guiada posterior.
- El catálogo `projects.json` es específico de cada equipo/máquina y el primer registro no está resuelto en el recorrido de instalación.
- El autoinicio documentado se limita al LaunchAgent de macOS.
- El nombre actual del paquete es `ariadne` y `private: true`; todavía no constituye una distribución ejecutable de npm.
- La amplitud de funciones puede abrumar a la persona que solo quiere abrir un tablero y conectar un proyecto.

### Oportunidades
- Un asistente de primera ejecución, registro de proyectos y comando de diagnóstico pueden convertir una instalación técnica en un flujo guiado.
- Servicios de usuario para macOS, Windows y Linux reducen el trabajo repetido de arrancar el Hub.
- Un paquete npm verificable puede habilitar `npx` y bajar la barrera de instalación después de revisar nombre, permisos y archivos incluidos.
- Guías breves bilingües, con el camino básico separado de opciones avanzadas, pueden ayudar a que más perfiles adopten Ariadne.

### Amenazas
- Diferencias entre gestores de servicios y versiones de Node pueden dejar el Hub sin arrancar en una plataforma concreta.
- Un catálogo malformado o una ruta registrada incorrectamente podría ocultar proyectos o modificar el sitio equivocado.
- El nombre `ariadne-cli` ya identifica en npm otro producto no relacionado; `ariadne-hub` es solo candidato y su disponibilidad/propiedad no se pudo confirmar porque la consulta al registro npm agotó el tiempo.
- Publicar un paquete con archivos locales, permisos excesivos o una dependencia comprometida puede afectar instalaciones de usuarios.
- La demanda de descarga y la curva de aprendizaje del producto no están medidas todavía; no hay evidencia suficiente para afirmar adopción de mercado.

### Viabilidad
- Estado: viable con condiciones
- Razones: la arquitectura existente ya tiene Hub HTTP, catálogo local y un instalador de macOS, así que el trabajo es incremental. El plan tiene una ruta de entrega comprobable y mantiene la operación local.
- Condiciones: preservar datos locales; cubrir cada sistema en CI; entregar fallback manual; inspeccionar el tarball; verificar disponibilidad y propiedad del nombre npm; mantener la publicación npm como gate separado.
- Evidencia: README, package.json, server.js, scripts/install-hub-launchagent.js, pruebas focalizadas 13/13, suite 267/267 y comprobación del tarball.
- No se evalúa como probada la viabilidad comercial ni la adopción externa: faltan entrevistas, métricas de instalación y uso.

## Registro maestro
| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| AH-E-39 | Implementación | Asistente de primera instalación y registro guiado | hecho | — | Setup funciona en macOS/Windows/Linux; valida requisitos; registra rutas locales sin pérdida de catálogo; no requiere editar archivos a mano | Tarjeta cerrada con Backlog CLI; setup temporal, pruebas por SO y suite completa pasan | Completado; CI nativo también corre en el PR |
| AH-E-40 | Diagnóstico | Comando doctor y diagnóstico accionable | hecho | AH-E-39 | Comando devuelve estado y solución concreta para requisitos, dependencias, catálogo, rutas, puertos y salud del Hub | Tarjeta cerrada por Backlog CLI; pruebas temporales, doctor secuencial y auditoría global sin problemas | Completado |
| AH-E-41 | Operación | Autoinicio sin privilegios para macOS, Windows y Linux | en_progreso | AH-E-39 | Instalación, inspección, desinstalación y fallback manual en los tres sistemas | Matriz CI pasa en macOS/Windows/Linux; 13/13 focalizadas con install/uninstall nativo en dry-run. No se alteró el inicio real de los runners | Verificar instalación/desinstalación real en sesiones limpias por SO |
| AH-E-42 | Distribución | Preparación npm/npx y guías bilingües | en_progreso | AH-E-39, AH-E-40 | Ejecutable empaquetado, tarball inspeccionado, guía EN/ES y publicación npm pendiente de autorización | `package:check` pasa; `ariadne-cli` está ocupado; `ariadne-hub` no se pudo verificar por timeout del registro | Verificar nombre/propiedad con npm y revisar CI |

## Riesgos
| ID | Severidad | Riesgo | Mitigación | Estado |
|---|---|---|---|---|
| INST-R-001 | Alta | El autoinicio deja procesos duplicados o configuraciones huérfanas | Operaciones por usuario, inspección antes de escribir, idempotencia y uninstall por sistema | Abierto |
| INST-R-002 | Alta | El asistente altera un catálogo existente o registra el proyecto incorrecto | Copia de seguridad antes de cambios, escritura atómica, comparación de ruta real y no sobrescribir entradas | Abierto |
| INST-R-003 | Alta | El tarball npm incluye información local o scripts no requeridos | `files` allowlist, `.npmignore`/`.gitignore` revisado, inspección de tarball y prueba de paquete | Abierto |
| INST-R-004 | Media | CI local no puede ejecutar los tres sistemas | Matriz GitHub Actions con macOS/Windows/Linux y simulaciones locales | Mitigado: matriz verde; los servicios reales no se activaron en runners |
| INST-R-005 | Media | Nombre o scope npm elegido no está disponible o no pertenece a la cuenta | Verificar disponibilidad antes de finalizar el paquete; publicación queda separada | Abierto |
| INST-R-006 | Media | Primera instalación sigue pareciendo compleja por exceso de opciones | Camino recomendado con valores seguros, detalles avanzados opcionales y guías cortas | Abierto |

## Decisiones
| Fecha | ID | Decisión | Motivo | Impacto |
|---|---|---|---|---|
| 2026-11-09 | INST-D-001 | Cubrir macOS, Windows y Linux en la misma entrega | El usuario lo especificó al aprobar el alcance | Pruebas y servicios nativos para los tres sistemas |
| 2026-11-09 | INST-D-002 | Preparar npx, sin publicar en npm hasta aprobación final | El usuario pidió “preparar npx”; publicar un paquete es una acción externa separada | Paquete revisable y ejecutable; publish separado |
| 2026-11-09 | INST-D-003 | Mantener catálogo de proyectos y configuración de inicio por usuario, fuera de Git | Evita compartir rutas personales y evita permisos de administrador | El asistente valida escritura y no toca el código del proyecto que se registra |
| 2026-11-09 | INST-D-004 | Evaluar viabilidad como “viable con condiciones” | Base técnica suficiente, pero falta verificación real en los tres SO, disponibilidad del nombre y evidencia de adopción | No presentar demanda de mercado como probada |

## Diferidos
| ID | Trabajo | Motivo | Condición de reactivación |
|---|---|---|---|
| INST-DIF-001 | Publicar paquete en npm | Requiere nombre confirmado, revisión final del tarball, credenciales de la cuenta y aprobación explícita | Gates de AH-E-42 completos y autorización del propietario |
| INST-DIF-002 | Instalar o actualizar Node.js automáticamente | Evitar ejecutar instaladores del sistema y pedir permisos por defecto | Solicitud explícita, diseño por plataforma y política de firma/actualización |
| INST-DIF-003 | Medición de adopción y facilidad con usuarios externos | No hay sesiones de prueba ni datos de uso adjuntos | Probar instalación guiada con usuarios y registrar fricciones |

## Historial
- 2026-11-09: auditoría de instalación iniciada. Confirmado: el repo GitHub `mincho77/Ariadne` está en `1c4613a`; el checkout local parte de `9972228` y contiene cambios sin publicar. Esos cambios se preservan y no forman parte de este plan.
- 2026-11-09: el usuario aclaró cobertura para macOS, Windows y Linux y preparación de `npx`; se separó la publicación npm como gate explícito.
- 2026-11-09: DAFO del proyecto completo documentada con evidencia del README, servidor, catálogo y guías existentes; viabilidad condicional por cobertura multiplataforma, seguridad del tarball y falta de evidencia de adopción.
- 2026-11-09: Backlog CLI creó AH-E-39..42 en un directorio temporal con el prefijo tipado AH-E y referencia al máximo remoto AH-E-38; las tarjetas se copiaron al backlog local como archivos nuevos. Solo AH-E-39 está en progreso.
- 2026-11-09: siguiente gate: implementar el asistente seguro y probar su registro contra catálogos temporales; después revisar el flujo con árbitro adversarial, auditoría y publicación en branch/PR.
- 2026-11-09: smoke inicial encontró que el entorno restringe la comprobación de puertos (`EPERM`); se corrigió para informar una advertencia cuando no es posible probar un puerto y reservar el error para `EADDRINUSE` confirmado.
- 2026-11-09: consulta a npm para `ariadne-hub` agotó el tiempo; el nombre permanece como candidato sin verificación de disponibilidad/propiedad. No publicar hasta confirmarlo.
- 2026-11-09: verificación final local: `npm test` 266/266; `smoke:cloud` 3/3; `smoke:lifecycle` 2/2; `lint` 76 archivos; `test:install` 12/12; `package:check` y `check_plan.py` pasan. `ariadne:audit` informa 0 problemas.
- 2026-11-09: auditoría adversarial corrigió dos asuntos: doctor ahora distingue puertos ocupados de comprobaciones restringidas, y el ID local del ledger autónomo se alineó con la migración documentada (AH-E-38 → AH-E-9). Backlog doctor reparó una colisión local de ID en una tarjeta archivada; referencias de las nuevas tareas se revisaron y apuntan al AH-E-39 activo.
- 2026-11-09: primera matriz CI del PR detectó rutas Windows con separadores del anfitrión; se corrigió con `path.win32`/`path.posix`. La segunda matriz pasó en macOS/Windows/Linux; luego pasó de nuevo con la prueba de instalación/desinstalación nativa en dry-run. No se alteró el inicio real de los runners.
- 2026-11-09: verificación actualizada: `npm test` 267/267, `test:install` 13/13, `smoke:cloud` 3/3, `smoke:lifecycle` 2/2, `lint` 76 archivos, `package:check`, `ariadne:audit` 0 problemas y matriz CI verde.
- 2026-11-09: inicio automático, asistente y empaquetado están listos para revisión. No se ejecutó publicación en npm.
