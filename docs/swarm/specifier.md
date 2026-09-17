# Specifier obligatorio (four / six)

En packs **four** y **six** el primer rol es `specifier`. No se implementa hasta tener AC binarios aprobables.

## Reglas (AH-E-46)

1. `four` / `six` incluyen `specifier` como rol #1 (`swarm/packs.js`).
2. `run --role coder` sin handoff `specifier → coder` previo → error `SPECIFIER_REQUIRED`.
3. `handoff --from specifier --to coder` exige:
   - `## Acceptance Criteria` con ≥1 ítem binario (checkbox)
   - `--approved` **o** summary con `approved` / `AC ok`
4. Helper CLI para sembrar AC:

```bash
npm run swarm -- specify --task FX-E-1 \
  --ac "Usuario ve el CTA" \
  --ac "Test smoke verde" \
  --gherkin "Given… When… Then…"

npm run swarm -- handoff --task FX-E-1 \
  --from specifier --to coder \
  --summary "AC ok" --approved
```

## Implementación

- `swarm/specifier-gate.js` — gates + `applySpecifierAcceptance`
- Cableado en `handoffSwarmTask` / `runSwarmTask`
- Prompts: [prompts.md](./prompts.md) · constitution artículo roles
