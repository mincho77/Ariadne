# Ariadne

**A local-first project hub for teams and AI coding agents.** Ariadne brings project Kanban boards, Gantt planning, project audits, and Git-friendly Markdown task tracking into one app on your computer.

Your project files stay on your machine. Ariadne stores its project catalog locally and does not require a hosted account.

## Quick start

Requirements: Node.js 18 or later and Git.

```bash
git clone https://github.com/mincho77/Ariadne.git
cd Ariadne
npm install
npm run setup
npm start
```

The setup guide asks for the path to an existing project and shows you how to open the Hub at <http://127.0.0.1:4177/>. It records the path in a local catalog and does not change the project files.

- [Full installation guide](docs/INSTALLING.md)
- [Guía de instalación en español](docs/instalacion.md)
- [Full Spanish README](README.es.md)

## Useful commands

| Command | What it does |
|---|---|
| `npm run setup` | Check requirements and register a project |
| `npm run doctor` | Diagnose the installation and show repair steps |
| `npm start` | Run the local Hub |
| `npm run autostart -- install` | Start Ariadne automatically for the current user |
| `npm run autostart -- status` | Check automatic startup |
| `npm run autostart -- uninstall` | Remove automatic startup |

Automatic startup is optional and supported through the current user's LaunchAgent on macOS, Startup folder on Windows, or systemd user service on Linux. No administrator access is required.

## Use through npx

The package entry point and executable are prepared as `ariadne-hub`. After the first npm release, the intended commands are:

```bash
npx ariadne-hub setup
npx ariadne-hub start
```

The package is not published yet. The GitHub installation above works now.

## How it works

- Node.js serves the Hub and project Kanban boards on `127.0.0.1`.
- Tasks and plans are Markdown files that can be reviewed and versioned with Git.
- The local `projects.json` catalog is ignored by Git because it contains machine-specific paths.
- AI integrations and JEV are optional; Ariadne does not add provider credentials or make model calls by default.

## License

MIT. See [LICENSE](LICENSE).
