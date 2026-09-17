# Launcher externo — route-hint → skill

Cableado **in-repo** para que un wrapper de Codex/Cursor elija `ariadne-lite` vs `ariadne` antes de cargar contexto.

## CLI

```bash
npm run ariadne:launcher -- "mueve PD-E-3 a la cola"
npm run ariadne:route-hint -- "audita con Pharos"   # solo clasificación
```

Salida JSON (`ariadne-launcher.js`):

| Campo | Uso |
|-------|-----|
| `mode` / `skill` | `lite` → `ariadne-lite`; `full` → `ariadne` |
| `skillFile` | Ruta absoluta a `SKILL.md` a cargar |
| `env` | `ARIADNE_SKILL`, `ARIADNE_MODEL_TIER`, `ARIADNE_ROUTE_MODE` |
| `instructions` | Texto breve para el orquestador |

## Shell (eval exports)

```bash
eval "$(./scripts/ariadne-launcher.sh 'actualiza el ledger y valida')"
echo "$ARIADNE_SKILL $ARIADNE_SKILL_FILE"
# → ariadne-lite …/skills/ariadne-lite/SKILL.md
```

Con mensaje en stdin:

```bash
echo "audita corrige" | eval "$(./scripts/ariadne-launcher.sh)"
```

Verbose:

```bash
ARIADNE_LAUNCHER_VERBOSE=1 eval "$(./scripts/ariadne-launcher.sh 'mueve a cola')"
```

## Ejemplo de uso (AH-E-39)

Pedido del usuario: *«mueve AH-E-41 a la cola»*

```bash
npm run ariadne:route-hint -- "mueve AH-E-41 a la cola"
```

Salida esperada (resumida):

```json
{
  "mode": "lite",
  "skill": "ariadne-lite",
  "modelTier": "economy",
  "reason": "matched lite pattern: ..."
}
```

Luego el agente carga solo `skills/ariadne-lite/SKILL.md`. Pedido *«audita con Pharos y despliega»* → `mode: full` / `skill: ariadne`.

En Cursor la regla siempre activa `.cursor/rules/ariadne-route.mdc` recuerda este preflight.

## Validación (ARIM-004)

Smoke automatizado (sin medición de tokens):

```bash
npm test -- tests/ariadne-launcher.test.js tests/ariadne-sync.test.js
npm run ariadne:sync
```

Post-edicion de ledgers: ver **`docs/ariadne-automation.md`** (`npm run ariadne:sync -- --fix`).

## Referencias

- Decisión: `docs/ariadne-lite.md`
- Ledger: `docs/plans/ariadne-mejoras.md` (ARIM-003, ARIM-004)
- Implementación: `scripts/ariadne-route-hint.js`, `scripts/ariadne-launcher.js`
