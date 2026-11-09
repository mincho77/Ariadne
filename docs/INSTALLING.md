# Install Ariadne

Ariadne runs on macOS, Windows, and Linux. Your projects stay on your computer; registration stores their paths in a local catalog.

## Requirements

- Git
- Node.js 18 or later, including npm
- A project folder you want to register

## Install from GitHub

Open Terminal, PowerShell, or your Linux terminal and run:

```bash
git clone https://github.com/mincho77/Ariadne.git
cd Ariadne
npm install
npm run setup
```

The setup assistant checks Node and Ariadne's dependencies, then asks for the full path to your existing project and its display name. It adds that path to `projects.json` and does not change files inside the project. The catalog is local to your machine and is excluded from Git.

Start Ariadne:

```bash
npm start
```

Open <http://127.0.0.1:4177/> in your browser. Keep the terminal window open while you use the Hub. To stop Ariadne, press `Ctrl+C`.

## Check or repair your installation

```bash
npm run doctor
```

The doctor checks Node, dependencies, the local catalog, registered project folders, and whether the Hub is responding. It prints a repair step for each problem.

## Start Ariadne automatically (optional)

The setup assistant can install a current-user startup service. You can also manage it later:

```bash
npm run autostart -- install
npm run autostart -- status
npm run autostart -- uninstall
```

This uses a LaunchAgent on macOS, a Startup-folder entry on Windows, or a `systemd --user` service on Linux. It does not require administrator access. On Linux systems without a running user systemd manager, use `npm start` instead.

## Use through npx

The executable and package layout are prepared under the candidate name `ariadne-hub`. Once that package is published, the setup and start commands will be:

```bash
npx ariadne-hub setup
npx ariadne-hub start
```

The npm package has not been published. The GitHub installation above is the supported way to use this version. Confirm the npm name and publishing account before the first release.

`npx` uses a temporary package cache, so its setup does not install automatic startup. To keep Ariadne available across sessions, use the GitHub installation above or install the published package globally, then run `ariadne-hub setup` and `ariadne-hub autostart install`.

## Troubleshooting

- **Node.js is missing or too old:** install Node.js 18 or later, close and reopen the terminal, then run `node --version` and `npm run doctor`.
- **The project folder is not found:** rerun `npm run setup` and enter its full path. The wizard accepts paths with spaces.
- **The Hub does not open:** run `npm run doctor`. If another app uses port `4177`, close that app or change the port before starting Ariadne.
- **You previously registered a moved folder:** update or remove that entry in the local `projects.json` catalog after making a backup.
- **The catalog is invalid JSON:** the setup and doctor commands leave it untouched. Make a backup, repair the JSON syntax, then run `npm run doctor` again.

## Privacy

The catalog contains local folder paths and is not committed to Git. Setup only records a project path; it does not copy or edit project files. It does not contact JEV or another model provider.
