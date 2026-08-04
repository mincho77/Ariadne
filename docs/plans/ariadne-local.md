# Plan: Ariadne Local con Backlog.md

## Control
- Estado: en_progreso
- Última actualización: 2026-08-04
- Objetivo: administrar varios proyectos locales con tableros Markdown, reglas Ariadne y recuperación clara de trabajo.
- Gate actual: repo standalone operativo; Kanban con edición, cola manual y módulo de bugs con analytics por tema.
- Próxima acción: integrar route-hint en launcher externo o retomar ARLOCAL-025+ (JurisMate producción).

## Alcance

### Incluye

- Backlog.md como tablero local y almacenamiento Markdown.
- Hub local para registrar varios proyectos y abrir sus tableros.
- Ariadne como capa de gobierno: evidencia, aceptación, bloqueos, dependencias y cierre.
- Integración MCP opcional para Codex.
- Recuperación de sesión, checkpoints, hallazgos y errores.

### No incluye

- Hosting público.
- Usuarios, autenticación multiusuario o colaboración remota.
- Reemplazar los ledgers existentes de `docs/plans` sin migración explícita.

### Restricciones

- Bind local únicamente en `127.0.0.1`.
- No ejecutar comandos destructivos sobre proyectos registrados.
- Preferir CLI/MCP de Backlog para cambios de estado; la edición de Markdown completo desde el Kanban queda permitida cuando el usuario necesita ajustar textos manualmente.
- Los proyectos conservan sus archivos en disco y Git sigue siendo opcional.

## Métricas de éxito

- Crear un proyecto local desde el Hub en menos de un minuto.
- Ver al menos dos proyectos y su progreso en una única página.
- Abrir el Kanban local de cada proyecto.
- Crear y actualizar tareas desde Backlog.md sin perder Markdown.
- Ariadne detecta tareas hechas sin evidencia, bloqueadas sin próxima acción y más de tres tareas activas.
- El flujo reanuda desde proyecto, tarea y próxima acción exactos.

## Registro maestro

| ID | Fase | Tarea | Estado | Depende de | Aceptación | Evidencia / notas | Próxima acción |
|---|---|---|---|---|---|---|---|
| ARLOCAL-001 | 1 Decisión | Comparar herramientas y escoger base | hecho | - | Existe decisión documentada con alternativas y límites | Backlog.md elegido tras revisar GitHub; soporte Markdown, web local, MCP y MIT | Mantener Backlog.md fijado en dependencia |
| ARLOCAL-002 | 1 Plan | Definir integración Hub, Backlog y Ariadne | hecho | ARLOCAL-001 | Existe arquitectura y ledger validable | Este documento; Backlog.md UI, Ariadne governance, Hub multiproyecto | Implementar instalación y prueba |
| ARLOCAL-003 | 2 Instalación | Añadir Backlog.md de forma reproducible | hecho | ARLOCAL-002 | `npm install` y `backlog --version` funcionan sin instalación global obligatoria | `tools/ariadne-hub/package-lock.json`; versión 1.48.0; 0 vulnerabilidades | Mantener dependencia local |
| ARLOCAL-004 | 2 Instalación | Crear proyecto de prueba sin Git | hecho | ARLOCAL-003 | `backlog init --no-git` crea tablero y tareas Markdown | Fixture temporal creado; tarea ARIADNE-1 creada con estado y criterios de aceptación | Automatizar fixture en prueba de integración |
| ARLOCAL-005 | 3 Hub | Registrar varios proyectos locales | hecho | ARLOCAL-004 | Hub lista rutas válidas, nombre, estado y progreso | API probada con dos proyectos temporales; catálogo JSON local | Añadir auditoría agregada |
| ARLOCAL-006 | 3 Hub | Abrir o iniciar tablero Backlog por proyecto | hecho | ARLOCAL-005 | Cada proyecto tiene URL local estable y proceso controlado | API devolvió `http://127.0.0.1:6422`; tablero respondió HTTP 200 | Mejorar cierre explícito de procesos |
| ARLOCAL-007 | 4 Ariadne | Adaptar skill a Backlog MCP y CLI | hecho | ARLOCAL-003 | Ariadne usa operaciones Backlog cuando existen y cae a Markdown solo cuando corresponde | `~/.codex/skills/ariadne/SKILL.md` actualizado | Usar contrato en próximos planes |
| ARLOCAL-008 | 4 Ariadne | Añadir checkpoints, hallazgos, errores y recuperación | hecho | ARLOCAL-007 | Cada fase guarda estado, siguiente acción, evidencia y errores relevantes | Skill actualizado con checkpoint/recover y reglas de evidencia | Implementar comandos dedicados si hacen falta |
| ARLOCAL-009 | 4 Ariadne | Añadir auditoría multiproyecto | hecho | ARLOCAL-005, ARLOCAL-007 | `npm run ariadne:audit` revisa ledgers y backlog Gantt | scripts/ariadne-audit-all.js | — |
| ARLOCAL-010 | 5 Validación | Probar ciclo completo con dos proyectos | hecho | ARLOCAL-006, ARLOCAL-009 | Crear, avanzar, bloquear, reanudar y cerrar tareas sin perder datos | tests/two-project-lifecycle.test.js; npm test 166/166 | Integrar route-hint |
| ARLOCAL-011 | 5 Entrega | Documentar comando de inicio y backup | hecho | ARLOCAL-003 | Usuario puede iniciar Hub y entender ubicación de datos | `tools/ariadne-hub/README.md`; bind local documentado | Añadir backup cuando exista catálogo real |
| ARLOCAL-012 | 5 Operación | Priorizar tareas y distinguir bugs en el tablero | hecho | ARLOCAL-006 | Las prioridades se configuran como Ultra High → High → Medium → Low; tarjetas ordenadas y tipadas | Backlog `JM-18` (Done); `backlog.config.yml`; `tools/ariadne-hub/server.js`; `npm test` 3/3 | Atender JM-17 |
| ARLOCAL-013 | 5 Operación | Mantener registro de bugs resueltos | hecho | ARLOCAL-012 | Existe registro con regla de entrada y evidencia obligatoria | `docs/plans/bugs-resueltos.md` | Añadir cada bug únicamente al cerrar su tarea |
| ARLOCAL-014 | 5 Operación | Hacer visibles buscador, JM, prioridad y tipo en Kanban | hecho | ARLOCAL-012 | La vista directa del Kanban permite buscar por JM/título/tipo/prioridad y muestra prioridad/tipo en cada tarjeta | `tools/ariadne-hub/server.js`; `tools/ariadne-hub/server.test.js`; pruebas 5/5; HTML activo verificado en `127.0.0.1:6421` | Mantener el proceso local actualizado tras cambios |
| ARLOCAL-015 | 5 Operación | Añadir cola de ejecución priorizada | hecho | ARLOCAL-014 | Tareas pasan de To Do a En cola y regresan; la siguiente se elige por prioridad/ordinal; existe instrucción copiable para Codex | Backlog `JM-20`; transición HTTP real To Do → Queued → To Do verificada; pruebas 6/6; HTML activo verificado | El usuario agrega a cola las tareas que autoriza para ejecución |
| ARLOCAL-016 | 5 Operación | Rediseñar detalle, arrastre y cola ordenada | hecho | ARLOCAL-015 | Detalle estructurado; drag and drop persistente entre estados; cola diferenciada con posiciones visibles | Backlog `JM-22` Done; pruebas 8/8; transición real In Progress → Queued → In Progress; HTML activo verificado en `127.0.0.1:6421` | Mantener el Hub activo y usar la cola operativa |
| ARLOCAL-017 | 6 Producción | Corregir extracción de pretensiones por sujeto | hecho | ARLOCAL-015 | Justo conserva concepto, valor, solicitante/titular/afectado y fuente; declara ambigüedad cuando aplique | Backlog `JM-19` Done; pruebas 45/45; evaluación Vertex con 5 sujetos y total `$429.853.765`; `generarInformeIA` versión 245 `ACTIVE` | Regenerar el informe histórico afectado y vigilar la primera ejecución real |
| ARLOCAL-018 | 6 Seguridad | Rotar credenciales expuestas por salida verbosa de despliegue | hecho | ARLOCAL-017 | Credenciales rotadas; valores anteriores revocados; despliegues sin secretos en consola | Backlog `JM-23` Done; Secret Manager actualizado; credencial anterior rechazada; despliegue productivo de funciones críticas completado sin imprimir valores sensibles | Mantener despliegues sin `DEBUG`/`FIREBASE_DEBUG` |
| ARLOCAL-019 | 6 Producción | Corregir búsqueda numérica de despachos | hecho | ARLOCAL-015 | El número buscado coincide exactamente; ordinales y ceros iniciales son equivalentes; búsquedas sin número no se degradan | Backlog `JM-24` Done; causa raíz y corrección documentadas; pruebas 6/6 y relacionadas 8/8; Hosting versión `2506e13c5649eba2`, release `1785170866156000`; producción sirve autocomplete v5.4 y resolver v6 | Vigilar búsquedas reales; reabrir solo con evidencia de regresión |
| ARLOCAL-020 | 6 Producción | Corregir permisos al editar despachos personalizados | hecho | ARLOCAL-015 | Admin de la firma actualiza; otra firma es rechazada; Firestore y Postgres quedan sincronizados sin ampliar reglas | Backlog `JM-25` Done; causa raíz y corrección documentadas; pruebas dirigidas 11/11; `apiV2` versión 421 `ACTIVE`; Hosting versión `2506e13c5649eba2`; producción sirve admin-juzgados v20260727c sin escrituras directas | Validación humana residual con María Paula; reabrir solo con evidencia |
| ARLOCAL-021 | 6 Histórico | Registrar informe truncado y pretensiones escaneadas | hecho | ARLOCAL-017 | Informe completa el molde y Justo recupera pretensiones OCR con evidencia de commit, pruebas y deploy | Backlog `JM-26` Done; commit `cdcc0a8`; referencia `docs/CAMBIOS-2026-07-27.md` | Vigilar regresiones |
| ARLOCAL-022 | 6 Histórico | Registrar serie de autorización 403 de informes | hecho | ARLOCAL-017 | Firma 1, casing y resolución autorizada de tenant quedan cubiertos y desplegados | Backlog `JM-27` Done; commits `5d08430`, `8c9f127`, `14aaf2d` | Vigilar rechazos 403 reales |
| ARLOCAL-023 | 6 Histórico | Registrar estabilización de Justo y reproceso OCR | hecho | ARLOCAL-017 | Neon, evidencia OCR de identidad y bucket explícito funcionan en producción | Backlog `JM-28` Done; commits `eb2fb48`, `8aa74fb` | Vigilar errores de callable y OCR |
| ARLOCAL-024 | 6 Histórico | Registrar flujo tomador/asegurado de Justo al informe | hecho | ARLOCAL-017 | Guardado, hidratación, panel, póliza y cache bust quedan implementados, probados y desplegados | Backlog `JM-29` Done; commits `ac8ec7b`, `587ff47`, `9a5a77c`, `a1c277d`; changelog reporta 34/34 | Completar validación humana y E2E |
| ARLOCAL-025 | 7 Validación | Confirmar datos del caso Allen de Jesus Meza | pendiente | ARLOCAL-024 | Abogado confirma tomador y asegurado y cualquier corrección queda documentada | Backlog `JM-30` To Do, Medium | Obtener confirmación del abogado |
| ARLOCAL-026 | 7 Validación | Ejecutar E2E Justo → informe | pendiente | ARLOCAL-024, ARLOCAL-025 | Guardado persiste sin pérdida y el HTML regenerado muestra datos confirmados con evidencia | Backlog `JM-31` To Do, High; depende de `JM-29`, `JM-30` | Ejecutar después de JM-30 |
| ARLOCAL-027 | 7 Cobertura | Añadir prueba explícita de tomador/asegurado en report_context | pendiente | ARLOCAL-024 | Prioridad de informeCampos queda probada para ambos campos y suite verde | Backlog `JM-32` To Do, Low | Implementar cuando no desplace incidentes productivos |
| ARLOCAL-028 | 8 Producción | Evitar que un radicado definitivo vuelva a temporal al guardar | hecho | ARLOCAL-015 | Guardar conserva radicado definitivo; solo una decisión explícita crea temporal; escrituras tardías no lo degradan | Backlog `JM-33` Done; artefacto aislado; `apiV2` v424; hashes públicos idénticos; sin errores nuevos | Vigilar el próximo guardado real de María Paula |
| ARLOCAL-029 | 8 Producción | Recuperar carga y edición de usuarios por administradora de firma | hecho | ARLOCAL-028 | Usuarios cargan con estado visible; admin edita su firma; otra firma sigue bloqueada | Backlog `JM-34` Done; pruebas de rol/tenant; `apiV2` v424; artefacto público idéntico; 401 controlado | Validar aceptación con la sesión de María Paula |
| ARLOCAL-030 | 8 Producción | Permitir consulta de ranking al Superadmin global con firma explícita | hecho | ARLOCAL-029 | Superadmin consulta la firma seleccionada; sin firma o firma no participante sigue bloqueado; roles de firma no se amplían | Backlog `JM-35` Done; pruebas relacionadas 40/40; `apiV2` v425 ACTIVE; Hosting sirve cache-bust del panel y long-polling; sonda pública 401; sin errores posteriores | Confirmar visualmente después de `Ctrl+F5` |
| ARLOCAL-031 | 8 Producción | Mostrar Racha Forense en la pista de Operaciones | hecho | ARLOCAL-030 | Alexandra Rua/Operaciones ve racha actual y mejor racha; producción carga módulo actualizado; no se oculta racha 0 | Backlog `JM-37` Done; pruebas `streak-forense` y `lawyer_ranks` 25/25; Hosting release `1785233827091000`; producción importa `lawyer-rank-ui.js?v=20260728-ops-streak` y contiene `Racha Forense` / `Mejor racha` | Confirmación visual con modal recargado |
| ARLOCAL-032 | 5 Operación | Corregir filtro visual del Kanban local | hecho | ARLOCAL-016 | Buscar por JM/título/tipo/prioridad oculta no coincidentes, actualiza contadores por columna y resalta matches | Backlog `JM-38` Done; pruebas Hub 9/9; verificación HTTP local confirma `.task[hidden]`, `search-match`, `search-empty`, `search-no-results` y actualización de `column-count` | Usar buscador en el Hub activo |
| ARLOCAL-033 | 8 Producción | Corregir guardado de transcripción manual de audiencia | hecho | ARLOCAL-015 | Transcripción manual de audiencia persiste; usuarios autorizados no reciben `internal`; error real queda visible; prueba focalizada existe | Backlog `JM-39` Done, Ultra High; causa raíz: instancia abortaba al cargar Secret Manager `DATABASE_URL` versión 9 deshabilitada; redeploy de `guardarTranscripcionConEmbeddings`; función `ACTIVE`, sonda sin auth devuelve 401 controlado | Confirmar aceptación real; reabrir solo si reaparece `internal` |
| ARLOCAL-034 | 9 Informes | Auditar y organizar plantillas de informes | en_progreso | ARLOCAL-017 | Inventario local, matriz comparativa, decisión por plantilla y plan de ejecución documentados | Backlog `JM-40` In Progress, Ultra High; matriz creada en `docs/plans/matriz-plantillas-informes.md` con 4 plantillas globales y ruta para plantillas Prisma/Firestore vivas | Separar ejecución por plantilla o migración conjunta |
| ARLOCAL-035 | 10 Producto | Centro de actividad diario para radicados con problemas | en_progreso | ARLOCAL-015 | Campanita con resumen diario, modal maestro-detalle, acciones leer/limpiar/borrar y navegación directa al caso | Backlog `JM-41` In Progress; servicio/API/UI detrás del beta `activity-center-radicado-health`; Pharos corrigió gate backend, cache diario y uso exclusivo de tenant autenticado; pruebas 6/6; migración prod aplicada; `apiV2` v427 ACTIVE; Hosting publicado desde paquete aislado; JS público 200 y endpoint sin auth 401; UX ajustada para minimizar/restaurar selección y scroll; fix de `caso-firebase.html` publicado para inicializar Justo con evento `jm:justo-module-ready` y retry 60s; retorno a actividad corregido y desplegado: `activity-center.js?v=5` reabre el modal automáticamente al detectar `jmActivityCenterState.minimized` | Validar visualmente con sesión real que el retorno reabra el modal; cerrar JM-41 después de confirmación |
| ARLOCAL-036 | 11 Ariadne | Crear proyecto de mejoras internas de Ariadne | hecho | ARLOCAL-007 | Existe ledger propio y tarea Backlog para mejoras de costo/modelo de Ariadne | Backlog `JM-42` To Do, Low; proyecto Hub `Ariadne Mejoras` registrado en `tools/ariadne-hub/projects.json`; tarea `AM-1`; ledger `docs/plans/ariadne-mejoras.md` creado para evaluar `ariadne-lite` y wrapper de modelo barato | Retomar cuando el usuario quiera optimizar Ariadne |
| ARLOCAL-037 | 8 Producción | Evitar que Subir archivo congele el navegador | pendiente | ARLOCAL-015 | Abrir el modal no crea recursión ni refrescos beta duplicados; selector y modal permanecen interactivos | Backlog `JM-43` Queue, Ultra High; causa raíz corregida; pruebas relacionadas 23/23; Hosting versión `9c4d4693f5c24c4d`, release `1785254066941000`; SHA-256 local/público idéntico `25077dbd...ea1dd1` | Validar interacción real autenticada y cerrar solo con aceptación |
| ARLOCAL-038 | 8 Producción | Recuperar documentos detenidos porque onFileUpload no inicia | hecho | ARLOCAL-037 | Trigger procesa eventos sin 500; seis PDF del caso quedan resueltos sin duplicados; se auditan todos los casos y cargas del día | Backlog `JM-44` Done; revisión `onfileupload-00163-zhr` con `DATABASE_URL` v10 y 100% del tráfico; desde 00:00 Colombia: 246 eventos, 2 casos creados, 6 cargas; seis archivos `PROCESADO`/OK; segundo caso sin archivos; borrador temporal eliminado | Vigilar nuevos errores de inicio; mantener secretos vigentes en próximos despliegues |
| ARLOCAL-039 | 8 Producción | Recuperar ZIP detenidos porque onZipBatchUpload no inicia | hecho | ARLOCAL-038 | Trigger inicia con secreto vigente; lotes pendientes se procesan; no quedan ZIP temporales abandonados | Backlog `JM-45` Done; revisión `onzipbatchupload-00027-pjf` con `DATABASE_URL` v10 y 100% del tráfico; seis lotes recuperados; consulta final `_batch/*.zip` sin objetos | Confirmar que los documentos extraídos aparecen en los casos y vigilar errores nuevos |
| ARLOCAL-040 | 8 Producción | Eliminar referencias globales a DATABASE_URL v9 deshabilitada | hecho | ARLOCAL-038, ARLOCAL-039 | Inventario completo en v10; cero funciones en v9; secretos y variables Firebase preservados; todas las funciones ACTIVE sin errores de arranque | Backlog `JM-46` Done; 49 funciones en v10, 0 en v9; 39 Gen1 con GCLOUD_PROJECT/GCP_PROJECT/FIREBASE_CONFIG restaurados; todas ACTIVE; cero errores nuevos desde 19:46Z | En la próxima rotación, conciliar secretos y variables de plataforma antes de deshabilitar una versión |
| ARLOCAL-041 | 12 Repo | Extraer Ariadne a repositorio standalone | hecho | ARLOCAL-011 | Existe repo propio con Hub, skill, planes y GitHub publicado | Backlog `AH-1` Done; commit `af2bdeb`; https://github.com/mincho77/Ariadne | Mantener JurisMate como proyecto externo en `projects.json` |
| ARLOCAL-042 | 12 Hub | Editar Markdown de tareas desde el Kanban | hecho | ARLOCAL-041 | Modal permite editar y guardar Markdown completo con validación de frontmatter e `id` | Backlog `AH-2` Done; commit `657782e`; API `/api/tasks/content`; pruebas 13/13 | Usar para ajustes manuales puntuales |
| ARLOCAL-043 | 12 Hub | Igualar altura de columnas del tablero | hecho | ARLOCAL-041 | Todas las columnas comparten altura y la zona inferior acepta drop | Backlog `AH-3` Done; commit `657782e`; CSS `align-items:stretch` | Mantener al cambiar layout |
| ARLOCAL-044 | 12 Hub | Repriorizar cola manualmente | hecho | ARLOCAL-016, ARLOCAL-041 | Queue ordena por `ordinal`; arrastre actualiza turnos y persiste en Backlog | Backlog `AH-4` Done; commit `71f19d1`; API `/api/tasks/queue-order`; pruebas 14/14 | Usar turno 1 como siguiente a ejecutar |
| ARLOCAL-045 | 12 Hub | Evaluar modo liviano de Ariadne | hecho | ARLOCAL-007 | Decisión `ariadne-lite` documentada | docs/ariadne-lite.md; AH-E-5 Done | Integrar route-hint |
| ARLOCAL-046 | 12 Hub | Módulo de bugs con analytics por tema | hecho | ARLOCAL-041 | Vista bugs filtra incidencias, muestra KPIs, barras y tabla comparativa por tema | Backlog `AH-6` Done; `bugs-board.js`; `view=bugs`; API `/api/bugs/stats` | Refinar reglas de tema según uso real |

## Riesgos

| ID | Severidad | Riesgo | Mitigación | Estado |
|---|---|---|---|---|
| ARLRISK-001 | alta | Backlog.md trabaja por carpeta y no ofrece Hub multiproyecto nativo | Hub delgado con registro de rutas y enlaces | abierto |
| ARLRISK-002 | alta | Dos escritores modifican el mismo Markdown simultáneamente | Usar CLI/MCP de Backlog y detectar cambios externos antes de mutar | abierto |
| ARLRISK-003 | media | Skill de terceros incluye hooks y comandos no compatibles con Codex | Tomar patrones, auditar scripts y mantener Ariadne independiente | activo |
| ARLRISK-004 | media | Lanzar muchos tableros puede consumir puertos o procesos | Pool controlado, puertos asignados y cierre explícito | abierto |
| ARLRISK-005 | alta | Una tarea crítica queda enterrada por orden de creación | Ordenar siempre por prioridad y mostrar Ultra High de forma visible | mitigado |

## Decisiones

| Fecha | ID | Decisión | Motivo | Impacto |
|---|---|---|---|---|
| 2026-07-26 | ARLDEC-001 | Usar Backlog.md como base | Ya resuelve Kanban local, Markdown, aceptación, dependencias y MCP | Menos código propio y mejor interoperabilidad |
| 2026-07-26 | ARLDEC-002 | Mantener Ariadne como capa de reglas | Backlog gestiona tareas, pero no garantiza nuestros gates de evidencia y cierre | Se conserva rigor transversal |
| 2026-07-26 | ARLDEC-003 | Hub local delgado, no segundo gestor de tareas | El tablero ya existe; Hub solo debe reunir proyectos | Menor duplicación y menor mantenimiento |
| 2026-07-26 | ARLDEC-004 | No instalar skill de terceros sin auditar scripts | planning-with-files usa hooks shell y superficies específicas de Claude | Se reutilizan ideas, no código ciego |
| 2026-07-27 | ARLDEC-005 | Adoptar `Ultra High` como prioridad operativa máxima | Los incidentes de producción necesitan atención inmediata y visible | JM-17 queda por delante de tareas High, Medium y Low |
| 2026-07-27 | ARLDEC-006 | Registrar bugs resueltos en un ledger separado | El tablero conserva el flujo activo; el registro conserva la memoria de cierres | Cada entrada exige evidencia y no se crea antes de `Done` |
| 2026-07-27 | ARLDEC-007 | Separar `Queued` de `In Progress` | Estar autorizado para ejecución no equivale a estar ejecutándose | La cola expresa intención y prioridad; Doing conserva el trabajo realmente activo |
| 2026-07-27 | ARLDEC-008 | Mostrar la cola como una secuencia numerada y permitir movimiento entre todos los estados | El usuario necesita expresar orden operativo y corregir el flujo sin editar Markdown | Cola violeta con turnos; arrastre y botones alternativos persisten mediante Backlog |
| 2026-07-27 | ARLDEC-009 | No crear tarea por Firestore Listen 404 | El changelog lo identifica como comportamiento benigno de WebChannel SDK | Se conserva como nota operativa, no como bug accionable |
| 2026-07-28 | ARLDEC-010 | Separar mejoras internas de Ariadne en un proyecto propio | El enrutamiento de modelo y ahorro de tokens es infraestructura de trabajo, no bug productivo de JurisMate | Se crea `docs/plans/ariadne-mejoras.md` y `JM-42` |
| 2026-07-29 | ARLDEC-011 | Publicar Ariadne como repo standalone | Facilita clonar el Hub en otra máquina sin arrastrar JurisMate | Repo `mincho77/Ariadne`; backlog propio con prefijo `AH` |
| 2026-07-29 | ARLDEC-012 | La cola operativa usa orden manual por `ordinal` | El usuario necesita decidir turnos explícitos, no solo prioridad automática | Queue deja de reordenar por prioridad al mostrar turnos |
| 2026-07-29 | ARLDEC-013 | Unificar Ariadne y Ariadne Mejoras en un solo proyecto Hub | Dos entradas apuntaban al mismo trabajo del Hub y confundían el tablero | Un solo slug `ariadne`; backlog en la raíz; `docs/plans/ariadne-mejoras.md` permanece como ledger de gobernanza |

## Diferidos

| ID | Trabajo | Motivo | Condición de reactivación |
|---|---|---|---|
| ARLDEF-001 | Sincronización con Plane | Backlog ya cubre el caso local y MCP | Solo si aparece colaboración multiusuario real |
| ARLDEF-002 | Autenticación | Hub solo local inicialmente | Reactivar antes de exponer red |
| ARLDEF-003 | Migración automática de todos los ledgers Ariadne | Puede dañar formato existente | Después de probar importación reversible |

## Historial

- 2026-08-04: `npm run ariadne:audit:fix` corrige referencias obsoletas en columna Próxima acción (p. ej. ARLOCAL-009 → ARLOCAL-010 ya hecho); lib/ledger-hygiene.js integrado en audit-all.
- 2026-08-04: ARLOCAL-010 cerrado con prueba HTTP multiproyecto (`tests/two-project-lifecycle.test.js`): crear, cola, In Progress, edición Markdown, bloqueo por subestado, reanudación y cierre en `proj-alpha` y `proj-beta` sin pérdida en disco; portafolio Gantt con dos proyectos; `npm test` 166/166.

- 2026-07-26: Se revisaron skills/repositorios de GitHub y herramientas locales.
- 2026-07-26: Backlog.md elegido como base; planning-with-files y save-your-work quedan como referencias de diseño.
- 2026-07-26: Se abrió instalación local reproducible.
- 2026-07-26: Backlog 1.48.0 instalado localmente; `npm test` pasa (2 pruebas).
- 2026-07-26: Hub validado con dos proyectos temporales y tablero Backlog HTTP 200; temporales eliminados del catálogo.
- 2026-07-26: Ariadne actualizado con modo multiproyecto, Backlog CLI/MCP, checkpoints y recuperación.
- 2026-07-27: Se creó JM-17 como bug de producción `Ultra High` por el fallo de limpieza de caché de Justo.
- 2026-07-27: Se creó JM-18 para las capacidades operativas del tablero y `docs/plans/bugs-resueltos.md` como registro durable.
- 2026-07-27: Se corrigió el Kanban directo: buscador visible, prioridad/tipo visibles y títulos YAML multilínea como `JM-19` normalizados; se reinició el proceso local y se verificó HTML activo.
- 2026-07-27: Se implementó JM-20 con columna `En cola`, selección de siguiente tarea por prioridad/ordinal, controles de entrada/salida y copia de instrucción para Codex. La transición real y el servidor activo fueron verificados.
- 2026-07-27: JM-17 pasó a `Done` tras pruebas 4/4, auditoría Pharos, despliegue aislado de tres archivos en Firebase Hosting (`c87935da15de9d24`) y verificación de hashes públicos.
- 2026-07-27: Se abrió JM-22 para corregir el detalle visual, habilitar arrastre persistente entre estados y convertir `En cola` en una secuencia operativa claramente diferenciada.
- 2026-07-27: JM-22 quedó `Done`; pruebas del Hub 8/8, cambio real de estado persistido y versión activa confirmada en el Kanban local.
- 2026-07-27: El usuario autorizó JM-19 desde la cola; pasó a `In Progress` para diagnosticar y corregir la pérdida de asociación entre perjuicio y sujeto.
- 2026-07-27: JM-19 quedó `Done` tras corregir total, prioridad documental y desglose por sujeto/fuente; Pharos validó 45/45 pruebas focalizadas, evaluación Vertex del caso real y despliegue productivo de `generarInformeIA` versión 245.
- 2026-07-27: Pharos detectó que la salida verbosa del despliegue mostró valores sensibles de Runtime Config; se creó JM-23 como bug de seguridad Ultra High en `To Do`, sin copiar credenciales al tablero.
- 2026-07-27: Se abrió JM-24 para corregir el autocompletado de despachos; la causa inicial es que el ranking elimina el token numérico `3` y acepta coincidencias difusas con otros números.
- 2026-07-27: JM-24 quedó code-complete: coincidencia numérica estricta, equivalencias ordinales y cache busting v6; pruebas focalizadas 6/6 y relacionadas 8/8. Permanece en progreso hasta desplegar y verificar producción.
- 2026-07-27: Se abrió JM-25 por `Missing or insufficient permissions` al editar despachos; se conserva el bloqueo de Firestore y se moverá la escritura al backend autenticado.
- 2026-07-27: JM-25 quedó code-complete sin ampliar reglas: la API valida tenant/ownership, sincroniza PG y Firestore con Admin SDK y rechaza otra firma; pruebas dirigidas 11/11. Permanece abierto hasta despliegue y verificación.
- 2026-07-27: JM-24 y JM-25 se desplegaron desde el commit limpio `eab8eac`; `apiV2` versión 421 quedó `ACTIVE` y Firebase Hosting publicó la versión `2506e13c5649eba2`, release `1785170866156000`.
- 2026-07-27: Se verificaron los artefactos públicos de producción: admin-juzgados v20260727c usa `/juzgados/custom` sin `updateDoc/addDoc`; autocomplete v5.4 y juzgado-resolve v6 están activos. Ambos bugs permanecen `In Progress` hasta una prueba autenticada real.
- 2026-07-27: Se importó `docs/CAMBIOS-2026-07-27.md` a Ariadne sin duplicar JM-24/JM-25. Los 17 cambios restantes se consolidaron por incidente en JM-26 a JM-29, todos históricos `Done` con commits y despliegues referenciados.
- 2026-07-27: Los seguimientos del changelog quedaron como JM-30 (validar datos del caso), JM-31 (E2E Justo → informe) y JM-32 (prueba explícita report_context). El 404 de Firestore Listen se conservó como nota no accionable.
- 2026-07-27: Se abrieron JM-33 y JM-34 como bugs de producción Ultra High. JM-33 queda activo por riesgo de integridad del radicado; JM-34 queda primero en cola para carga y edición de usuarios de firma. JM-24/JM-25 pasan a cola mientras esperan validación autenticada.
- 2026-07-27: JM-33 quedó code-complete: se preserva el radicado extraído, no se degrada una entrada no vacía y el backend rechaza definitivo → temporal; pruebas focalizadas 18/18.
- 2026-07-27: JM-34 quedó code-complete: Admin carga usuarios por API y edita mediante backend con roles y tenant; pruebas focalizadas 6/6. Ambos bugs esperan auditoría, despliegue y validación real.
- 2026-07-27: Pharos aprobó JM-33/JM-34; se desplegaron únicamente sus cambios desde un artefacto aislado basado en `8dfdacb`. `apiV2` v424 quedó `ACTIVE`, Hosting finalizó y los tres hashes públicos coinciden.
- 2026-07-27: La salida DEBUG de Firebase CLI volvió a enumerar valores sensibles durante el despliegue. Se actualizó JM-23 sin copiar secretos; la rotación y la eliminación del modo verboso siguen pendientes.
- 2026-07-28: Se abrió JM-35 como bug Ultra High porque el guard de `GET /usuario/lawyer-ranking` devolvía 403 a Superadmin global aunque el panel enviaba una firma seleccionada.
- 2026-07-28: JM-35 quedó code-complete con acceso de solo lectura condicionado a `x-empresa-id` explícito; firma no participante y ausencia de firma continúan bloqueadas. Pruebas relacionadas 40/40.
- 2026-07-28: Pharos aprobó el parche aislado basado en el artefacto productivo de JM-33/JM-34. `apiV2` versión 425 quedó `ACTIVE`; sonda sin autenticación devolvió 401 controlado y no hubo errores posteriores.
- 2026-07-28: La sesión de Superadmin mostró artefactos antiguos (`SUPERADMIN_GLOBAL_ONLY` y WebChannel). Se añadió cache-bust al import de `firebase-config.js` en `admin/admin-activity-logs.html`; Hosting publicó la versión y la verificación pública confirmó long-polling activo.
- 2026-07-28: JM-23 quedó cerrado: contraseña Neon rotada para el rol runtime, `DATABASE_URL` y `DIRECT_URL` actualizados en Secret Manager, versiones anteriores deshabilitadas y funciones críticas redeployadas sin exponer valores.
- 2026-07-28: Se registró JM-37 por racha no visible en la pista de Operaciones de Alexandra Rua. La causa fue cache-bust faltante del módulo `lawyer-rank-ui`; se publicó Hosting release `1785233827091000` y producción sirve `lawyer-rank-ui.js?v=20260728-ops-streak`.
- 2026-07-28: Se registró y cerró JM-38 por el buscador del Kanban local: el contador encontraba resultados pero `.task{display:block}` impedía que `[hidden]` ocultara tarjetas. Se añadió CSS explícito, contadores filtrados por columna, estado vacío y resaltado de coincidencias; Hub activo verificado.
- 2026-07-28: Se abrió JM-39 como bug de producción Ultra High por fallo `internal` al guardar una transcripción manual de audiencia; se atendió de inmediato. Logs mostraron aborto de instancia por `DATABASE_URL` versión 9 deshabilitada; se redeployó `guardarTranscripcionConEmbeddings`, quedó `ACTIVE` y la sonda sin autenticación responde 401 controlado.
- 2026-07-28: Se abrió JM-40 como tema urgente de plantillas de informes. Se creó `docs/plans/matriz-plantillas-informes.md` con inventario local, matriz comparativa, decisiones por plantilla y orden recomendado de ejecución.
- 2026-07-28: Se abrió JM-41 como novedad de producto para convertir la campanita en centro de actividad diario de radicados con inconsistencias, archivos problemáticos o sin archivos. Se definió plan UX/UI y técnico en `docs/plans/campanita-actividad-radicados.md`.
- 2026-07-28: JM-41 quedó code-complete local: `activity-notifications.service`, rutas `/activity/notifications`, modal `activity-center`, cache-bust de `index-main`; luego se corrigió para quedar detrás del beta `activity-center-radicado-health` con migración Prisma. Pruebas focalizadas 5/5 y sintaxis OK.
- 2026-07-28: Se corrigieron bloqueantes Pharos de JM-41: las rutas `/activity/notifications` validan el beta en backend y `ensureDailyRadicadoHealthNotification` lee cache diario antes de escanear. Pruebas focalizadas suben a 6/6.
- 2026-07-28: Se corrigió segunda observación Pharos de JM-41: Activity Center dejó de usar `x-empresa-id` crudo como fallback; solo usa `req.tenantFirestoreId` validado por middleware.
- 2026-07-28: Se corrigió el retorno desde un caso abierto en la campanita: el dock regresaba a la pantalla principal pero no reabría el modal. `activity-center.js?v=5` detecta el estado minimizado y llama `open()` al cargar el índice; producción verificada con HTTP 200 y contenido publicado.
- 2026-07-28: Se normalizaron las columnas visibles del Kanban a `To Do`, `Queue`, `Doing` y `Done`; se conserva la persistencia interna `Queued`/`In Progress` para no romper tareas existentes. Pruebas del Hub 9/9.
- 2026-07-28: Se agregó botón `Refresh` al Kanban local; recarga los Markdown fuente para reflejar cambios actuales y muestra estado de actualización. Pruebas del Hub 9/9 y sintaxis de `tools/ariadne-hub/server.js` OK.
- 2026-07-28: Se crea `docs/plans/ariadne-mejoras.md`, `JM-42` y el proyecto separado `Ariadne Mejoras` en el Hub local con tarea `AM-1`, para dejar pendiente la mejora de costo/modelo de Ariadne: posible `ariadne-lite` y wrapper externo que enrute tareas simples a modelo barato.
- 2026-07-28: Se abrió JM-43 Ultra High por congelamiento al intentar subir documentos. La causa raíz fue una recursión entre `refreshUploadBetaBadge` y `setUploadModalMode`, agravada por un segundo refresco al abrir el modal. Se eliminó el ciclo y el refresco duplicado; pruebas documentales relacionadas 23/23.
- 2026-07-28: JM-43 se desplegó en Hosting release `1785254066941000`; el HTML público coincide por SHA-256 con la corrección local y no contiene la llamada recursiva. Permanece en Doing hasta la validación interactiva autenticada.
- 2026-07-28: Se abrió JM-44 Queue Ultra High por seis documentos atascados en `PROCESANDO` en el radicado `05697-31-12-001-2025-00040-00`. Los PDF existen en Storage; `onFileUpload` devuelve 500 porque su revisión aún usa `DATABASE_URL` v9 deshabilitada mientras v10 está activa. La recuperación debe ser idempotente y abarcar otros archivos subidos durante la caída.
- 2026-07-28: JM-44 quedó resuelto sin publicar código: `onfileupload-00163-zhr` usa `DATABASE_URL` v10 y sirve 100% del tráfico. Los seis PDF se recuperaron idempotentemente y quedaron `PROCESADO`; la conciliación de `activity_logs` y Storage no encontró otros objetos persistentes sin cierre. Los intentos fallidos y la limitación del índice global quedaron documentados en la tarea.
- 2026-07-28: A solicitud del usuario se reabrió JM-44 y se amplió la auditoría a todo el día desde 00:00 Colombia. Se conciliaron 246 eventos, 2 casos creados y 6 cargas: los seis archivos pertenecían al caso reportado y terminaron `PROCESADO`; el segundo caso no tenía archivos. Un reintento tardío de la demanda se dejó terminar sin duplicarlo.
- 2026-07-28: Se abrió y cerró JM-45 Ultra High por ZIP detenidos en `pending`. Logs confirmaron que `onZipBatchUpload` abortaba por `DATABASE_URL` v9 deshabilitada. Se actualizó únicamente el binding a v10; la revisión `onzipbatchupload-00027-pjf` recibió los eventos con HTTP 200, recuperó los seis lotes y no quedaron objetos `_batch/*.zip` en Storage.
- 2026-07-28: Se abrió y cerró JM-46 Ultra High para auditar todos los consumidores de `DATABASE_URL`. Se encontró `onFileDeleted` y 39 funciones antiguas aún en v9; se migraron preservando los demás secretos y reutilizando los artefactos desplegados. Conciliación final: 49 funciones en v10, cero en v9, todas ACTIVE y sin nuevos abortos por la versión deshabilitada.
- 2026-07-28: Pharos reabrió JM-46 antes del despliegue final: el PATCH directo de Gen1 conservó secretos pero perdió variables de plataforma Firebase. `syncCasoToPostgres`, `processDocumentImages`, `warmupApiV2` y `refreshLawyerStatsHourly` registraron errores reales. Se inició recuperación global agregando GCLOUD_PROJECT, GCP_PROJECT y FIREBASE_CONFIG sin alterar código.
- 2026-07-28: Pharos cerró JM-46 después de corregir el bloqueante: las 39 funciones Gen1 recuperaron GCLOUD_PROJECT/GCP_PROJECT/FIREBASE_CONFIG, conservaron DATABASE_URL v10 y quedaron ACTIVE. No hay consumidores en v9 ni errores nuevos de variables Firebase desde 19:46Z. El HTML público de carga coincide por SHA-256 con el local, por lo que no se hizo un Hosting no-op.
- 2026-07-28: Se extrajo el Hub a `/Users/TU_USUARIO/Code/Ariadne` y se publicó en GitHub como `mincho77/Ariadne` (`af2bdeb`). JurisMate quedó registrado como proyecto externo.
- 2026-07-29: Se añadió edición de Markdown completo desde el modal del Kanban (`657782e`, `AH-2`).
- 2026-07-29: Se igualó la altura de columnas para facilitar drag-and-drop entre columnas de distinta carga (`657782e`, `AH-3`).
- 2026-07-29: Se habilitó repriorización manual de la cola con turnos visibles y persistencia por `ordinal` (`71f19d1`, `AH-4`).
- 2026-07-29: Se creó backlog propio del repo (`backlog/tasks/ah-1` a `ah-5`) para ver el avance del Hub en `http://127.0.0.1:6422/?project=ariadne`.
- 2026-07-29: Se añadió módulo de bugs por proyecto con Kanban filtrado, estadísticas por tema y tabla comparativa (`AH-6`, `bugs-board.js`, `/?project=<slug>&view=bugs`).
- 2026-07-29: Se unificaron `Ariadne` y `Ariadne Mejoras` en un solo proyecto Hub; tareas AM-* absorbidas por backlog `AH-*` en la raíz del repo.
