# Ariadne v0.1.1

Fecha: 2026-07-30

## Resumen

Esta version estabiliza el manejo de cola y normalizacion de IDs entre proyectos con configuraciones heterogeneas de Backlog. El objetivo principal fue evitar errores operativos en cambios de estado a Queued y prevenir colisiones de rutas durante la normalizacion de tareas.

## Cambios incluidos

1. Fallback de estado Queued cuando el backend no soporta ese estado de forma nativa.
2. Persistencia de cola compatible usando etiqueta queued y actualizacion controlada de frontmatter.
3. Protecciones de normalizacion para evitar reemplazos inseguros con IDs vacios.
4. Resolucion segura de casos con oldId duplicado para evitar duplicate target path.
5. Salvaguarda para no reescribir archivos cuando faltan IDs.
6. Ajuste de higiene de repositorio para ignorar artefactos locales en la carpeta projects.

## Commits principales

1. 72f77cd: fix(queue-normalization): fallback queued y colisiones de ids.
2. 54510f5: chore(gitignore): ignorar carpeta projects local.

## Archivos clave

1. server.js
2. task-id-normalize.js
3. task-id-normalize.test.js
4. .gitignore

## Validacion

1. Suite de pruebas en verde despues de publicar cambios: 50/50.
2. Smoke checks de runtime exitosos:
   - Hub en 4177 responde 200.
   - Kanban en 6421 responde 200 para Cumplimiento mejoras.
3. Normalizacion dry-run por proyecto y global sin issues ni cambios pendientes en los proyectos activos validados durante el cierre.

## Impacto operativo

1. Menor riesgo de caidas funcionales por incompatibilidad de estados entre motores Backlog.
2. Menor riesgo de corrupcion o colisiones en renombrado de tareas por normalizacion.
3. Flujo de mantenimiento mas limpio al excluir contenido local no versionable.

## Riesgos residuales

1. Si aparecen nuevos formatos de frontmatter fuera de los patrones soportados, puede requerirse ajuste adicional.
2. Recomendable mantener dry-run como paso obligatorio antes de aplicar normalizaciones masivas.

## Recomendacion de despliegue

Uso recomendado inmediato para entornos locales y de equipo donde se gestionen tareas en multiples proyectos con reglas de estado no uniformes.