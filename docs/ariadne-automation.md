# Automatización de actualizaciones Ariadne

Pipeline **determinista** para agentes y CI después de editar ledgers o backlog de gobernanza. No elige modelo; no edita tareas de producto.

## Comando único

```bash
npm run ariadne:sync              # auditar + validar
npm run ariadne:sync -- --fix     # además corrige Próxima acción obsoletas
npm run ariadne:sync -- --json    # salida para hooks
npm run ariadne:sync -- --ledger docs/plans/ariadne-local.md
```

### Pasos (en orden)

| Paso | Herramienta | Qué hace |
|------|-------------|----------|
| 1 | `ariadne-audit-all` | `check_plan` en ledgers + audit Gantt del catálogo |
| 2 | `--fix` opcional | Higiene: refs `hecho` en columna Próxima acción → `—` |
| 3 | `check_plan.py` | Revalida cada ledger (o los pasados con `--ledger`) |

Exit **0** solo si todo pasa.

## Flujo recomendado para agentes

```text
1. Editar ledger / evidencia / estado (ariadne-lite o full)
2. npm run ariadne:sync -- --fix
3. npm test   (si hubo cambios de código)
4. Commit
```

Para clasificar skill antes de cargar contexto (sin modelo barato):

```bash
npm run ariadne:launcher -- "<pedido del usuario>"
```

## CI / Cloud Agent

En `AGENTS.md` o hook post-edición:

```bash
npm run ariadne:sync -- --fix --json
```

## Qué queda fuera (diferido)

| Tema | Estado |
|------|--------|
| Wrapper que **fuerza modelo barato** en Cursor/Codex | `ARIM-DEF-001` en `docs/plans/ariadne-mejoras.md` |
| Medición real de tokens ahorrados | Manual / futuro |
| Auto-cerrar filas `hecho` sin evidencia humana | Prohibido por reglas Ariadne |

## Referencias

- Audit: `scripts/ariadne-audit-all.js`, `lib/ledger-hygiene.js`
- Launcher (skill path): `docs/ariadne-launcher.md`
- Lite: `docs/ariadne-lite.md`
