# Ariadne Standalone: GitHub Publish Runbook

## Objective
Publish Ariadne as a standalone repository with reproducible local setup and no leaked machine-local configuration.

## Preconditions
- You are in the Ariadne repository root.
- Node.js 18+ installed.
- Git remote points to target GitHub repository.
- Local `projects.json` is configured for your machine but is not tracked.

## 1) Readiness Check
Run:

```bash
npm run release:check:standalone
```

The check validates:
- required project files exist
- `projects.json` is not tracked
- `projects.example.json` is present and usable as template
- repository URL points to GitHub
- no obvious local absolute paths are leaked in tracked files

## 2) Test and Build Verification
Run:

```bash
npm test
```

Optional frontend check (if repoxai UI changes are included in the same release workflow):

```bash
cd ../repoxai/frontend-angular && npm run build
```

## 3) Create Source Bundle
Generate release tarball from current HEAD:

```bash
npm run release:bundle
```

Optional custom git ref:

```bash
node scripts/create-standalone-bundle.js <git-ref>
```

Output example:
- `dist/ariadne-standalone-v0.1.0-YYYYMMDD.tar.gz`

## 4) Publish to GitHub
Suggested flow:

```bash
git add .
git commit -m "release: standalone repo readiness and bundle tooling"
git push origin main
```

Then create GitHub release from tag/commit and attach generated tarball if desired.

## 5) Consumer Setup (from fresh clone)

```bash
npm install
cp projects.example.json projects.json
npm start
```

Update `projects.json` paths for the target machine before first run.

## Operational Notes
- Keep `projects.json` local-only.
- Keep `projects.example.json` as the onboarding template.
- Re-run readiness check before each public release.
