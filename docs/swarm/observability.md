# Observabilidad swarm en Hub (AH-E-48)

## API

```bash
GET /api/projects/:slug/swarm/status          # detail=1 por defecto (observabilidad)
GET /api/projects/:slug/swarm/status?detail=0 # snapshot corto Queue/Doing
GET /api/projects/:slug/swarm/observe         # alias explícito
npm run swarm -- observe --project ariadne
```

Respuesta incluye:

- `doingDetail[]` — `activeRole`, `lastHandoff`, `worktrees`, `pack`
- `recentHandoffs` — desde `.ariadne/swarm/handoffs.jsonl` (persistido en cada `handoff`)
- `worktrees` — `.worktrees/`

## UI

Hub Hoy / cards: botón **Handoffs** → resumen de rol activo, último handoff y worktrees.

## Implementación

`swarm/observability.js` · cableado en `handoffSwarmTask` (jsonl) · `public/app.js`
