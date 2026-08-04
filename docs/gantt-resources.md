# Recursos, responsables y capacidad por habilidad (AH-E-25)

El planificador puede condicionar el paralelismo por **pool de recursos** además de la política operativa (`capacity`, carriles bugs/mejoras).

## Campos en tareas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `assignee` | lista | Responsables (`dev1`, `qa-bot`, …) |
| `required_skills` | lista | Habilidades requeridas (`backend`, `ux`, …) |
| `resource_type` | texto | `human` (default), `ai`, `shared` |

## Configuración por proyecto

Archivo: `backlog/docs/gantt/resources.config.json`

```json
{
  "pools": [
    {
      "id": "backend",
      "skills": ["backend", "api"],
      "resourceTypes": ["human", "ai"],
      "maxParallel": 1
    },
    {
      "id": "general",
      "skills": ["*"],
      "resourceTypes": ["human", "ai", "shared"],
      "maxParallel": 2
    }
  ]
}
```

- **`maxParallel`**: cuántas tareas del pool pueden ejecutarse a la vez.
- **`skills`**: `*` acepta cualquier tarea del `resource_type` compatible; si la tarea declara `required_skills`, deben estar cubiertas por el pool.
- Si no existe el archivo, se usa un pool `general` con `maxParallel` igual a la capacidad operativa.

## Reglas de asignación

1. Se resuelve el pool por `resource_type` + `required_skills`.
2. El motor aplica **límites de carril** (bugs/mejoras/total) y luego **límites del pool**.
3. Si hay **un solo** `assignee`, no se programan dos tareas suyas en paralelo.

## API

Activar con query param `resourceAware=1` en `GET /api/projects/{slug}/gantt`.

La respuesta incluye en `parameters.resourceConfig` (solo cuando está activo) y en cada `tasks[]`:

- `assignees`, `requiredSkills`, `resourceType`, `resourcePoolId`

## PATCH tarea

`required_skills` y `resource_type` son editables vía `PATCH /api/projects/{slug}/tasks/{id}` (lista y escalar respectivamente).
