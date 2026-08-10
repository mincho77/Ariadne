# Export SwarmForge opcional (AH-E-50)

Genera `swarmforge.conf` + `roles/*.prompt` desde packs Ariadne. **No instala ni requiere** SwarmForge en runtime.

```bash
npm run swarm -- export-swarmforge --project ariadne
# → .ariadne/swarmforge-export/ (gitignored vía .ariadne/)

npm run swarm -- export-swarmforge --out /tmp/ariadne-sf --project ariadne
```

Archivos:

| Path | Rol |
|------|-----|
| `swarmforge.conf` | packs + bridge hints |
| `roles/<role>.prompt` | texto de `docs/swarm/prompts.md` |
| `README.md` | nota de uso opt-in |

Implementación: `swarm/swarmforge-export.js`.
