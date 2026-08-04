# Modelo temporal de tareas (Gantt v1)

Campos YAML opcionales en `backlog/tasks/*.md`. El **pronóstico** (`startDate`/`endDate` del planificador) se **calcula** en runtime; no se persiste como verdad manual salvo intención explícita del usuario.

## Precedencia al leer fechas

| Uso | Orden de precedencia |
|-----|----------------------|
| Inicio efectivo | `actual_start` → `started_date` (legacy) → `planned_start` → `created_date` |
| Fecha límite | `deadline` → `due_date` (legacy) → `target_finish` |
| Duración (pronóstico) | `remaining_ia_hours` → `progress` → sugerencia checklist → `estimate_ia_hours` → `estimate_days` × IA/día |

## Campos soportados

| Campo | Tipo | Rol |
|-------|------|-----|
| `planned_start`, `planned_finish` | YYYY-MM-DD | Intención planificada manual |
| `actual_start`, `actual_finish` | YYYY-MM-DD | Hechos (Kanban puede rellenarlos) |
| `target_start`, `target_finish` | YYYY-MM-DD | Objetivo de negocio |
| `deadline` | YYYY-MM-DD | Fecha límite dura (restricciones en AH-E-16) |
| `not_before` | YYYY-MM-DD | No iniciar antes |
| `fixed` | boolean | Fechas fijas (futuro) |
| `progress` | 0–100 | Avance declarado |
| `remaining_ia_hours` | entero ≥ 0 | Trabajo restante; prioridad sobre `progress` en el pronóstico |
| `blocked`, `blocked_reason`, `blocked_by`, `blocked_since`, `expected_unblock_date`, `blocked_until` | bool/text/date | Bloqueo temporal; ver `docs/gantt-blocks.md` |
| `parent_id`, `release`, `workstream` | id/text | Jerarquía y agrupación; ver `docs/gantt-hierarchy.md` |
| `assignee`, `required_skills`, `resource_type` | lista/texto | Recursos y pools; ver `docs/gantt-resources.md` |
| `type: milestone` / `is_milestone` | — | Hito duración cero en el planificador |

Legacy: `started_date`, `due_date`, `estimate_days`, `estimate_ia_hours` siguen válidos.

## Sincronización Kanban → Gantt

| Transición | Efecto en frontmatter |
|------------|------------------------|
| → **In Progress** | `actual_start = hoy` si aún no existe |
| → **Done** | `actual_finish = hoy` si no existe; `progress = 100`; rellena `actual_start` si faltaba |
| Reapertura (Done → otro estado) | **No borra** `actual_start` ni `actual_finish` |

## API PATCH

`PATCH /api/projects/{slug}/tasks/{id}`

Body JSON (parcial, camelCase o snake_case):

```json
{
  "actual_start": "2026-08-04",
  "progress": 50,
  "expectedUpdatedDate": "2026-08-04 17:10"
}
```

Conflictos: header `If-Match: {sourceHash}` o campo `expectedUpdatedDate` / `expectedHash`. Respuesta incluye `sourceHash` para la siguiente edición.
