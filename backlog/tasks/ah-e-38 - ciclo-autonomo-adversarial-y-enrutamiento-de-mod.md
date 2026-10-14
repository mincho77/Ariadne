---
id: AH-E-38
title: Ciclo autónomo adversarial y enrutamiento de modelos para mejoras E
status: In Progress
assignee: []
created_date: '2026-10-14 09:13'
updated_date: '2026-10-14 14:40'
labels: []
dependencies: []
priority: medium
type: enhancement
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Diseñar una capacidad reusable para desarrollar cualquier tarea Enhancement (E), no solo cambios móviles: planificar, construir, validar diseño y funcionalidad cuando aplique, recibir crítica adversarial, corregir y repetir hasta PASS. Incorporar selección económica de modelo por complejidad y escalamiento a un modelo más capaz para tareas difíciles y para arbitraje. El flujo debe funcionar sin JEV y sin requerir APIs no configuradas.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 El flujo se activa desde una solicitud conversacional que identifica una tarea E y carga su contexto, criterios, dependencias y restricciones.
- [ ] #2 Antes de editar, registra plan y pruebas; pregunta por decisiones materiales faltantes y continúa autónomamente cuando el alcance sea suficiente.
- [ ] #3 Implementa y verifica criterios de aceptación; incluye revisión visual/responsive solo cuando la tarea afecte interfaz y revisión funcional para todos los cambios.
- [ ] #4 Un árbitro adversarial separado revisa diff y evidencia con hallazgos accionables; el flujo corrige y repite hasta PASS o un límite configurable, sin afirmar aprobación si queda BLOCK.
- [ ] #5 El enrutador asigna un tier/modelo económico a trabajo acotado y uno más capaz a alta complejidad, riesgo, incertidumbre o arbitraje; permite override y registra modelo y motivo.
- [ ] #6 El enrutamiento usa solo backends/modelos ya autorizados y configurados; sin router disponible, conserva el modelo actual, no llama APIs externas ni depende de JEV.
- [ ] #7 El proceso no despliega, publica ni toma decisiones de producto irreversibles sin autorización explícita; registra cambios, pruebas, ciclos, árbitro y pendientes en el backlog/ledger.
<!-- AC:END -->
