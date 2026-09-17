# Digest diario local

Snapshot opcional de **Doing / Queue / riesgos** por proyecto. Solo filesystem local — sin cloud.

## Uso

```bash
npm run ariadne:digest
npm run ariadne:digest -- --project ariadne
npm run ariadne:digest -- --stdout          # imprime Markdown
npm run ariadne:digest -- --json            # metadatos de escritura
```

## Salida

Escritura bajo `.ariadne/digests/` (gitignored, como el resto de `.ariadne/`):

| Archivo | Contenido |
|---------|-----------|
| `YYYY-MM-DD.md` | Digest del día |
| `latest.md` | Copia del último generado |
| `latest.json` | Focus resumido (day, generatedAt) |

Basado en el mismo snapshot que Hub Hoy (`hub-hoy.js` / `GET /api/hoy`).

## Implementación

- `lib/daily-digest.js` — render Markdown
- `scripts/ariadne-digest.js` — CLI
- Tests: `tests/daily-digest.test.js`
