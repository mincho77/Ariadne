# Política operativa y capacidad (Gantt)

Alinea la proyección Gantt con Kanban y el runner de cola.

## Orden operativo

1. **In Progress (Doing)** — consume capacidad al inicio de la proyección
2. **Queued** — orden por `ordinal` ascendente (turno manual)
3. **To Do** — prioridad Ultra High → Low, luego `ordinal`

## Capacidad

`ai-capacity.config.json` soporta:

```json
{
  "capacity": 2,
  "capacityBugs": 1,
  "capacityEnhancements": 2
}
```

O forma anidada:

```json
{
  "capacity": {
    "total": 3,
    "bugs": 1,
    "enhancements": 2
  }
}
```

El motor aplica límites por carril (`bugs` vs `mejoras`) además del total.

Query params Gantt opcionales: `capacity`, `capacityBugs`, `capacityEnhancements`.

La respuesta incluye `parameters.capacityPolicy` y `parameters.operationalPolicy`.
