#!/usr/bin/env node
'use strict';

/**
 * Local daily digest (AH-E-44): Doing / Queue / risks → .ariadne/digests/
 * No cloud required.
 */

const fs = require('node:fs');
const path = require('node:path');
const { buildHoySnapshot } = require('../hub-hoy');
const { renderDailyDigest, digestOutputPaths } = require('../lib/daily-digest');

const ROOT = path.join(__dirname, '..');

function usage() {
  console.error(`Usage: node scripts/ariadne-digest.js [--project <slug>] [--stdout] [--json] [--date YYYY-MM-DD]

Writes Markdown digest under .ariadne/digests/ (gitignored).
Docs: docs/daily-digest.md
`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { project: null, stdout: false, json: false, date: null };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') usage();
    if (token === '--stdout') args.stdout = true;
    else if (token === '--json') args.json = true;
    else if (token === '--project' && argv[i + 1]) {
      args.project = argv[++i];
    } else if (token === '--date' && argv[i + 1]) {
      args.date = argv[++i];
    } else if (token.startsWith('--')) {
      console.error(`unknown flag: ${token}`);
      usage();
    }
  }
  return args;
}

function readCatalog() {
  const file = path.join(ROOT, 'projects.json');
  if (!fs.existsSync(file)) throw new Error('projects.json not found');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  // Lazy-load server helpers (heavy); keep digest script usable in tests via lib only.
  const server = require('../server');
  const catalog = readCatalog();
  const snapshot = buildHoySnapshot(catalog, {
    projectTasks: server.projectTasks,
    buildProjectGanttMetrics: server.buildProjectGanttMetrics,
  }, { project: args.project || undefined });

  const day = args.date || snapshot.generatedAt.slice(0, 10);
  const markdown = renderDailyDigest(snapshot, { date: day });
  const paths = digestOutputPaths(ROOT, day);

  if (args.stdout) {
    if (args.json) {
      console.log(JSON.stringify({ day, paths, snapshot, markdown }, null, 2));
    } else {
      process.stdout.write(markdown);
    }
    return;
  }

  fs.mkdirSync(paths.dir, { recursive: true });
  fs.writeFileSync(paths.dated, markdown, 'utf8');
  fs.writeFileSync(paths.latest, markdown, 'utf8');
  fs.writeFileSync(paths.latestJson, `${JSON.stringify({ day, generatedAt: snapshot.generatedAt, focus: snapshot.focus }, null, 2)}\n`, 'utf8');

  if (args.json) {
    console.log(JSON.stringify({
      ok: true,
      day,
      written: [paths.dated, paths.latest, paths.latestJson],
      focus: snapshot.focus,
    }, null, 2));
  } else {
    console.log(`Wrote ${path.relative(ROOT, paths.dated)}`);
    console.log(`Also  ${path.relative(ROOT, paths.latest)}`);
  }
}

main();
