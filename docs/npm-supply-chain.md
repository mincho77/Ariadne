# Seguridad npm en Ariadne (ChainDrop / Shai-Hulud)

Ariadne usa **npm** (no pnpm). Mitigación local y CI:

## Proyecto

`.npmrc` en la raíz:

```ini
ignore-scripts=true
```

Así `npm install` / `npm ci` **no** ejecutan `preinstall`/`postinstall` de dependencias.

Si un paquete nativo legítimo necesita compilarse (hoy Ariadne no depende de addons nativos):

```bash
npm rebuild <paquete>
```

## CI

Workflow `.github/workflows/ci.yml`:

```bash
npm ci --ignore-scripts
npm test
npm run security:npm-audit-worm
```

## Auditoría puntual

```bash
npm run security:npm-audit-worm
# o varios repos vía skill público:
node ~/.cursor/skills/npm-chaindrop-guard/scripts/audit.js . --home
```

Skill: [npm-chaindrop-guard](https://github.com/mincho77/npm-chaindrop-guard).

## Si hay CRITICAL

Aislar, rotar tokens desde máquina limpia, purgar `node_modules` + caché, reinstalar con `--ignore-scripts`. Ver skill `reference.md`.
