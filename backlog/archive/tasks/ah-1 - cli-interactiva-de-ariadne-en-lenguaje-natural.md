---
id: AH-1
title: CLI interactiva de Ariadne en lenguaje natural
status: In Progress
assignee: []
created_date: '2026-10-14 17:22'
updated_date: '2026-10-14 22:25'
labels: []
dependencies: []
priority: medium
type: enhancement
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Agregar un comando global `ariadne` que permita iniciar la CLI del agente local desde cualquier proyecto, recibir instrucciones en lenguaje natural, mostrar ayuda interactiva sin argumentos y cargar la skill de Ariadne. Debe preservar las aprobaciones/permisos del proveedor seleccionado, usar el proyecto actual como contexto por defecto y permitir elegir entre CLIs locales sin enviar solicitudes a APIs no configuradas.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Comportamiento observable documentado
- [x] #2 Criterios binarios (pass/fail) listados
- [x] #3 Prueba o smoke que demuestre el cambio
- [ ] #4 Evidencia en ## Evidence / ## Closeout al Done
- [x] #5 Ejecutar `ariadne` sin argumentos muestra ayuda/opciones y permite escribir cualquier solicitud en español.
- [ ] #6 Ejecutar `ariadne "..."` inicia el CLI configurado con la petición y con la skill Ariadne disponible.
- [x] #7 Permite elegir explícitamente Codex, Claude, Gemini u OpenCode cuando sus CLIs están instalados; no impone un modelo ni API key.
- [x] #8 Por defecto usa el directorio actual como proyecto; el modelo recibe instrucciones de confirmar proyecto si el contexto es ambiguo.
- [x] #9 No activa modo de aprobación automática, no despliega ni publica por inferencia, y explica errores cuando falta un CLI.
- [x] #10 Documentación explica instalación, selección de agente y ejemplos desde Ariadne y otros proyectos.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Implementar scripts/ariadne.js y paquete `bin`, un menú conversacional y adaptadores interactivos para Codex, Claude, Gemini y OpenCode. Registrar proveedor predeterminado local en variable/config opcional; resolver la skill instalada y preservar prompts/confirmaciones propias. Instalar enlace en ~/.local/bin y documentar ejemplos. Verificar el comando y Hub local sin invocar un modelo remoto.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementación inicial: comando scripts/ariadne.js, selector Codex/Claude/Gemini/OpenCode, menú libre, skill embebida y symlink global ~/.local/bin/ariadne. Handoff real a un modelo aún no ejecutado; validar con el agente que el usuario elija. Evitar activar approval automático.
<!-- SECTION:NOTES:END -->

## Comments

<!-- COMMENTS:BEGIN -->
created: 2026-10-14 22:25
---
Verificado en la implementación inicial: help y listado de agentes desde el comando enlazado, chequeo sintáctico, package.json válido y auditoría de Ariadne sin errores. Falta validar un handoff conversacional real con el agente que el usuario elija; por eso la tarea sigue In Progress.
---
<!-- COMMENTS:END -->
