# JEV opcional en Ariadne

JEV aporta señales tipadas a la evaluación de preparación del proyecto. No genera la DAFO ni determina si el negocio o proyecto es viable. El dictamen se mantiene explicable y requiere decisión humana.

## Activación

JEV está apagado por defecto. Para una ejecución local, configura ambas variables en el entorno del proceso del Hub:

```bash
export ARIADNE_JEV_ENABLED=true
export TYPESAFE_API_KEY="tu-clave-personal"
npm start
```

Para desactivarlo, elimina `ARIADNE_JEV_ENABLED` o configúralo en `false`; no se requiere clave y Ariadne no hace llamadas a TypeSafe. Cada usuario de una copia descargada desde GitHub decide si habilita el proveedor y utiliza su propia clave. Nunca guardes la clave en Git, en `projects.json` ni en el navegador.

Opcionales:

- `ARIADNE_JEV_MODEL`: modelo, por defecto `jev-latest`.
- `ARIADNE_JEV_TIMEOUT_MS`: timeout en milisegundos, por defecto `12000`.

## Contexto enviado

El endpoint acepta únicamente estos campos de texto o listas cortas de texto: `projectName`, `projectOverview`, `objective`, `intendedUsers`, `successCriteria`, `scope`, `constraints`, `evidence`, `risks` y `dependencies`. Cada campo tiene un límite de 3000 caracteres, las listas tienen hasta 12 elementos y el total hasta 12000 caracteres. Se redactan algunos patrones comunes de credenciales, pero eso no detecta todos los secretos: revisa el contexto y no incluyas datos sensibles.

Si faltan `objective`, `successCriteria` o `evidence`, Ariadne devuelve los campos faltantes y no llama a TypeSafe. Con el contexto completo, envía ese objeto y las preguntas de la rúbrica a la API TypeSafe. No envía el repositorio, archivos ni variables de entorno.

## API local

Consultar la configuración efectiva sin exponer la clave:

```http
GET /api/jev/status
```

Enviar el contexto que la persona autorizó a evaluar:

```http
POST /api/projects/ariadne/jev/dafo
Content-Type: application/json

{
  "state": {
    "projectName": "Ariadne",
    "projectOverview": "Hub local de gobierno de proyectos",
    "objective": "Ayudar a gestionar y evaluar proyectos desde el Hub",
    "successCriteria": ["La evaluación muestra evidencia y condiciones verificables"],
    "evidence": ["README del proyecto; ledger de la iniciativa"]
  }
}
```

Si JEV está apagado, la ruta responde `skipped: true` y no contacta TypeSafe. Si falta contexto, responde `reason: insufficient_context` y `missingContext`. Si está activo y falta la clave, responde un error de configuración sin incluir el valor de la clave.

La respuesta válida contiene `rubricVersion`, `decisionPolicy: signals_only_human_decision_required` y señales para `objective_clarity`, `success_criteria`, `validation_evidence`, `scope_and_constraints` y `risk_and_dependency_readiness`. Conserva probabilidades/confianza del proveedor como señales para revisión humana; no las sumes para producir una decisión automática de viabilidad.

## Elegir la primera tarea de desarrollo

Cuando la persona pregunta con qué tarea iniciar, el LLM conversacional inspecciona el backlog del proyecto activo y puede comparar hasta cinco tareas abiertas. Si no especifica candidatas, el Hub selecciona hasta cinco según prioridad y orden de tablero. Las tareas con dependencias sin resolver o pendientes se excluyen antes de llamar al proveedor.

```http
POST /api/projects/ariadne/jev/start-task
Content-Type: application/json

{}
```

También se puede enviar una selección explícita de dos a cinco IDs:

```json
{"candidateIds":["AH-E-14","AH-E-18"]}
```

El Hub construye el contexto solo con ID, título, estado, prioridad, tipo, descripción breve, criterios de aceptación y dependencias. No envía archivos fuente ni código. La rúbrica `task-start-v1` devuelve señales por candidata para alineación/valor, preparación de implementación, dependencias y riesgos/esfuerzo, además de una elección comparativa con probabilidades y confianza. La respuesta incluye el uso de tokens y duración de la llamada cuando TypeSafe los informa. JEV solo aporta señales: Ariadne explica los tradeoffs con evidencia del backlog y no cambia estado ni encola tareas.

Si falta contexto o no hay al menos dos candidatas elegibles, el Hub devuelve `skipped` con una razón y no contacta a TypeSafe. Si JEV está desactivado, Ariadne mantiene la comparación conversacional normal.

## Límites

- Habilitar JEV envía el contexto permitido a TypeSafe AI. Revisa sus términos de privacidad/retención antes de habilitarlo.
- Un error o timeout del proveedor no se debe tratar como aprobación ni invalida la DAFO base.
- El endpoint de señales es una primera capa de integración. La conexión completa con la auditoría DAFO conversacional y la experiencia de usuario está registrada en `docs/plans/integracion-jev-ariadne.md`.
