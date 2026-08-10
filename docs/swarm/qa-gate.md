# Hardener / QA gate (lint + npm test)

Antes de `complete` en packs con `hardender`/`qa` (six-pack), Ariadne corre:

1. `npm run lint` — `node --check` sobre `swarm/`, `lib/`, `scripts/` (+ entrypoints)
2. `npm test`

Si alguno falla → **no** marca Done (`QA_GATE_FAILED`).

## Uso

```bash
npm run lint
npm run swarm -- qa --project ariadne
npm run swarm -- complete --task ID --evidence "…" --qa      # forzar gate
npm run swarm -- complete --task ID --evidence "…" --skip-qa # omitir (two/four)
```

En six-pack el gate es **obligatorio** salvo `--skip-qa`. Al pasar, se escribe handoff `hardender → qa` con el resumen y se añade a la evidencia de closeout.

## Implementación

- `swarm/qa-gate.js`
- `scripts/ariadne-lint.js`
- Cableado en `completeSwarmTask`
