# DAFO en la auditoría de Ariadne

`npm run ariadne:audit` incluye un informe de viabilidad DAFO para cada ledger reconocido en `docs/plans/`. Es una evaluación explícita basada en el análisis documentado por el equipo; no infiere factores desde el código ni aprueba cambios automáticamente.

## Formato del ledger

Añade una sección como esta al plan:

```markdown
## DAFO

### Fortalezas
- Factor interno favorable, con evidencia o contexto.

### Debilidades
- Factor interno desfavorable, con evidencia o contexto.

### Oportunidades
- Factor externo favorable, con evidencia o contexto.

### Amenazas
- Factor externo desfavorable, con evidencia o contexto.

### Dictamen de viabilidad
- Estado: viable con condiciones
- Razones: la entrega es posible si se resuelven las dependencias señaladas.
- Condiciones: confirmar acceso al servicio requerido.
- Evidencia: validación del acceso en el entorno de destino.
```

El estado aceptado es `viable`, `viable con condiciones`, `no viable` o `evidencia insuficiente`. El campo `Razones` explica el dictamen; `Condiciones` indica qué falta cuando el estado es condicional, y `Evidencia` puede enlazar evidencia concreta. Si falta un cuadrante, el estado o las razones, el informe usa `evidencia_insuficiente` y enumera lo que falta. La auditoría no cambia el estado de las tareas ni el contenido del plan.

## Señales opcionales de JEV

El Hub puede consultar JEV para recibir señales estructuradas sobre preparación del proyecto (claridad del objetivo, criterios de éxito, validación, alcance y riesgos/dependencias). JEV no genera los cuadrantes DAFO ni determina la viabilidad: Ariadne debe relacionar las señales con evidencia y conservar la decisión humana.

La integración está apagada por defecto. Consulta [`docs/jev-opcional.md`](jev-opcional.md) para configuración, límites del contexto y endpoint local.

## Preguntas interactivas

Ejecuta `npm run ariadne:audit -- --interactive` desde un terminal para responder preguntas sobre contexto, cuadrantes vacíos o con placeholders (`pendiente`, `por definir`, `TBD`), y dictamen o razones ausentes. Si el dictamen es condicional, pregunta qué condiciones faltan. Las respuestas se incorporan al informe de esa ejecución, no se escriben en el ledger; copia la información útil al plan si quieres conservarla. En una ejecución no interactiva, la auditoría informa la evidencia faltante sin preguntar. La herramienta detecta campos vacíos y placeholders conocidos; el equipo debe revisar si los factores redactados son realmente concretos.

La salida JSON (`npm run ariadne:audit -- --json`) incluye `dafo`, con factores, dictamen, campos faltantes y el número de respuestas usadas en modo interactivo.
