# Pack policy y modelHint

Política automática (AH-E-45) en `swarm/packs.js`:

| Señal | Pack | modelHint |
|-------|------|-----------|
| bug / label bug | two | cheap |
| mejora/feature **High** | four | strong |
| **Ultra** priority | six | strong |
| título/labels con **MVP** | six | strong |
| resto | two | cheap |

`modelHint` es el puente con `ariadne-route` / launcher:

- route-hint: `modelTier` economy|standard **y** `modelHint` cheap|strong
- launcher env: `ARIADNE_MODEL_HINT`
- CLI: `npm run swarm -- pack --task <id>`
- brief: línea `modelHint` en el markdown

Override: `--pack two|four|six` en brief/pack.
