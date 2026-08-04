# Plan: Dependencias tipo Project en Gantt Ariadne

## Objetivo
Implementar dependencias con tipo de relacion para distinguir secuencia y paralelismo en el timeline:
- FS (Finish to Start)
- SS (Start to Start)
- FF (Finish to Finish)
- SF (Start to Finish)
- Lag/Lead en dias habiles y horas IA

## Entregables
1. Modelo canónico de dependencia y reglas de validacion.
2. Parser/normalizador compatible con formato legacy.
3. Motor de scheduling con FS/SS/FF/SF + lag.
4. Render de lineas con anclas inicio/fin y convencion visual.
5. Editor UX para crear/editar tipo de relacion y lag.
6. Pruebas, migracion y documentacion operativa.

## Secuencia y paralelismo
- Fase 1 (secuencial): modelo -> parser.
- Fase 2 (paralela):
  - Track A: motor de scheduling.
  - Track B: render de lineas start/end.
- Fase 3 (secuencial): editor UX (requiere parser + render).
- Fase 4 (secuencial): QA/migracion/docs.

## Mapeo en backlog Ariadne Mejoras
- AM-E-8: Modelo de dependencias.
- AM-E-9: Parser y normalizacion.
- AM-E-10: Scheduling con relaciones y solapes.
- AM-E-11: Render de lineas start/end.
- AM-E-12: Editor UX de dependencias.
- AM-E-13: QA, migracion y documentacion.

## Criterios de exito
- El Gantt muestra lineas correctas por tipo de relacion (FS/SS/FF/SF).
- Se distingue visualmente paralelo vs secuencial.
- El calculo de ruta critica respeta el nuevo modelo.
- Proyectos existentes siguen funcionando con dependencias legacy.
