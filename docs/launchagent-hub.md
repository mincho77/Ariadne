# LaunchAgent único del Hub (`com.ariadne.hub`)

Ariadne debe tener **un solo** agente de Hub en macOS. El agente legado de JurisMate (`com.jurismate.ariadne-hub`) compite por los mismos puertos (`4177` / `6421`) y por `/tmp/ariadne-hub.log`.

## Política

| Label | Estado | Rol |
|-------|--------|-----|
| `com.ariadne.hub` | **activo** | `node server.js` desde este repo (Hub + Gantt + Kanban) |
| `com.jurismate.ariadne-hub` | **retirado** | Viejo hub en `JurisMate/tools/ariadne-hub` |
| `com.ariadne.bug-queue.jurismate` | opcional | Runner de cola de bugs (no es el Hub) |

## Instalación / reparación

Desde la raíz del repo:

```bash
npm run hub:launchagent            # escribe plist, bootout del legado, kickstart
npm run hub:launchagent -- --dry-run
npm run hub:launchagent -- --no-load   # solo escribe archivos
```

El script:

1. Hace `launchctl bootout` de `com.jurismate.ariadne-hub` y de `com.ariadne.hub` (reinicio limpio).
2. **Elimina** `~/Library/LaunchAgents/com.jurismate.ariadne-hub.plist` si existe.
3. Escribe `~/Library/LaunchAgents/com.ariadne.hub.plist` con rutas reales de `node` + este repo.
4. `bootstrap` + `kickstart` de `com.ariadne.hub`.

## Bootout manual del legado

```bash
launchctl bootout gui/$(id -u)/com.jurismate.ariadne-hub 2>/dev/null || true
rm -f ~/Library/LaunchAgents/com.jurismate.ariadne-hub.plist
```

Comprobar que solo queda el Hub nuevo:

```bash
launchctl print gui/$(id -u)/com.ariadne.hub | head
launchctl print gui/$(id -u)/com.jurismate.ariadne-hub   # debe fallar / no existir
ls ~/Library/LaunchAgents/com.*ariadne* ~/Library/LaunchAgents/com.jurismate* 2>/dev/null
```

## Gantt en el mismo Hub

Con `com.ariadne.hub` activo, el mismo proceso sirve Gantt:

```bash
curl -sS http://127.0.0.1:4177/api/gantt/portfolio | head
curl -sS "http://127.0.0.1:4177/api/projects/ariadne/gantt" | head
open http://127.0.0.1:4177/portfolio.html
```

Smoke: `npm run gantt:smoke`.

## Logs

- `/tmp/ariadne-hub.log`
- `/tmp/ariadne-hub-error.log`

## Troubleshooting

Si `launchctl` deja `last exit code = 1` y el log muestra `EADDRINUSE … 4177`, otro `node` ya tiene el puerto:

```bash
lsof -iTCP:4177 -sTCP:LISTEN
# liberar el PID viejo, luego:
launchctl kickstart -k gui/$(id -u)/com.ariadne.hub
```
