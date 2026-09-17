# LaunchAgent único del Hub (`com.ariadne.hub`)

Ariadne debe tener **un solo** agente de Hub en macOS.

## Política

| Label | Estado | Rol |
|-------|--------|-----|
| `com.ariadne.hub` | **activo** | `node server.js` desde este repo (Hub + Gantt + Kanban) |

## Instalación / reparación

Desde la raíz del repo:

```bash
npm run hub:launchagent            # escribe plist, bootout del legado, kickstart
npm run hub:launchagent -- --dry-run
npm run hub:launchagent -- --no-load   # solo escribe archivos
```

El script reinicia el servicio, escribe `~/Library/LaunchAgents/com.ariadne.hub.plist` con las rutas locales de Node.js y este repositorio, y ejecuta `bootstrap` + `kickstart`.

Comprobar el Hub:

```bash
launchctl print gui/$(id -u)/com.ariadne.hub | head
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
