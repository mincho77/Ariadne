---
name: kanoa-parity-autopilot
description: Framework de autopiloto de pruebas para Kanoa en cualquier proyecto: crea plan y tareas tipo T, ejecuta pruebas completas, sincroniza Ariadne, abre/actualiza bugs, genera plan de correcciones y prepara ciclo de fix tras confirmacion del usuario.
---

# Kanoa Test Autopilot Skill

## Objetivo

Ejecutar de forma no interactiva cualquier plan de pruebas (no solo paridad), con trazabilidad completa en Ariadne/Backlog:

1. Crear/actualizar plan de pruebas.
2. Crear tareas tipo T automaticamente.
3. Ejecutar toda la suite sin pedir "continua".
4. Marcar tareas una a una segun resultado.
5. Crear/actualizar bugs para fallos.
6. Generar informe final y plan de correcciones priorizado.
7. Continuar con tareas de correccion cuando el usuario confirme.

## Precondiciones

- Proyecto usa Backlog/Ariadne con carpeta `backlog/`.
- Existe un runner de pruebas que genera reporte JSON por casos (`T-###`).
- El plan de pruebas se define en un archivo JSON de configuracion.

## Modo generico por proyecto

Este skill no esta amarrado a un solo proyecto. Se parametriza por `projectKey`:

- `KA` para Kanoa.
- `JV` para otro proyecto.
- `AB` para cualquier otro.

Las tareas y bugs se generan con ese prefijo:

- `<PROJECT>-T-###` para casos de test.
- `<PROJECT>-B-###` para bugs.

## Configuracion del plan de pruebas

Crear un JSON basado en:

- `skills/kanoa-parity-autopilot/templates/test-plan.template.json`

Campos obligatorios:

1. `projectKey`: prefijo del proyecto.
2. `runCommand`: comando que ejecuta la suite.
3. `reportGlob`: patron del reporte JSON generado.
4. `cases[]`: lista de casos con `id`, `title`, `priority`.

Campos recomendados:

1. `preflightUrls[]`: health checks previos.
2. `tasksDir`: por defecto `backlog/tasks`.

## Ejecucion unica (autopiloto generico)

Desde la raiz del repo ejecutar:

`node scripts/ariadne/test-plan-autopilot.mjs --config <ruta-config.json>`

Este comando realiza en orden:

1. Crea tareas tipo T faltantes del plan.
2. Ejecuta health checks del plan.
3. Ejecuta el comando de pruebas completo.
4. Detecta el ultimo reporte JSON.
5. Sincroniza estado de todas las tareas T.
6. Crea/actualiza bugs B para cada FAIL.
7. Genera plan de correcciones en Markdown.

## Artefactos producidos

- Reporte fuente de pruebas (JSON) generado por tu runner.
- Tareas tipo T sincronizadas en `backlog/tasks`.
- Bugs tipo B auto-creados/actualizados en `backlog/tasks`.
- Plan de correcciones en `backlog/docs/reports/<project>-corrections-*.md`.

## Scripts que usa

- `scripts/ariadne/test-plan-autopilot.mjs` (motor generico).
- `skills/kanoa-parity-autopilot/templates/test-plan.template.json` (plantilla).
- Runner de pruebas definido en `runCommand` del plan.

Para Kanoa (atajo existente):

- `scripts/ariadne/run-parity-autopilot.sh`

## Semaforo de estados

- PASS -> task status Done.
- FAIL -> task status In Progress + bug KA-B actualizado/creado.
- PENDING/BLOCKED -> task status Queued.

Nota: el prefijo `KA-B` cambia automaticamente segun `projectKey`.

## Protocolo de correccion continua

1. Ejecutar autopiloto del plan.
2. Revisar lista final de FAIL y plan de correcciones generado.
3. Confirmar con usuario cuales fixes ejecutar primero.
4. Corregir por prioridad (P0 -> P1 -> P2).
5. Re-ejecutar autopiloto.
6. Repetir hasta FAIL=0.

## Politica de cierre

- No cerrar equivalencia sin P0 y P1 en PASS.
- Cada FAIL debe tener bug con evidencia y reproduccion.
- Todo cambio debe terminar con una nueva corrida automatizada.
- No iniciar fixes automaticos sin confirmacion del usuario.

## Troubleshooting rapido

- Si falla Playwright por navegador faltante:
  - cd frontend
  - npx playwright install chromium
- Si falla health check:
  - levantar backend (8000), V3 (5173) y V4 (4200) antes de correr skill.
- Si hay falsos negativos de UI:
  - revisar evidencia en parity-audit-*.json y ajustar selector en frontend/scripts/parity-audit.mjs.

## Flujo operativo recomendado para el agente

1. Crear/actualizar config del plan.
2. Ejecutar `test-plan-autopilot`.
3. Entregar informe consolidado (PASS/FAIL/PENDING + bugs + correction plan).
4. Pedir confirmacion de usuario para fase de fixes.
5. Ejecutar fixes priorizados.
6. Re-correr autopiloto y cerrar tareas/bugs.

## Extension recomendada

- Integrar `node scripts/ariadne/test-plan-autopilot.mjs --config <plan>.json` en CI para ejecutar en cada PR y publicar artefactos.
