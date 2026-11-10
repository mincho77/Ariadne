# Gantt UI integration

The editable Gantt UI is bundled with Ariadne. Run the local Hub and open the project Gantt from its card, or visit `http://127.0.0.1:4177/gantt/?project=<slug>`.

## Architecture

- Hub and Gantt UI: `ARIADNE_HUB_PORT` (default `4177`), same origin under `/gantt/`.
- Kanban board APIs: `ARIADNE_BOARD_PORT` (default `6421`).
- Angular source: `apps/gantt-ui/`.
- Compiled distributable assets: `public/gantt/browser/`.
- Gantt data and task mutations use the existing Ariadne Hub API through `/ariadne-api/`, rewritten internally to `/api/`.

The Hub serves the compiled Gantt UI. No external frontend repository, separate Gantt port, CORS exception, or second user-facing service is required. The project catalog remains local (`projects.json`, ignored by Git), and each entry can point to an existing directory anywhere the local user can access, including synced folders.

## Build the UI

```bash
npm --prefix apps/gantt-ui ci --ignore-scripts
npm run gantt:build
```

The build emits files into `public/gantt/browser/`; those generated assets are included in the npm package so installed Ariadne works without Angular tooling.
