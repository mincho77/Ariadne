#!/usr/bin/env node
'use strict';

/**
 * Ariadne Swarm CLI (AH-E-2 / AS-E-1)
 *
 *   npm run swarm -- status [--project ariadne]
 *   npm run swarm -- run [--project ariadne] [--task ID] [--role coder]
 *   npm run swarm -- handoff --task ID --from coder --to cleaner --summary "…" [--commit sha]
 *   npm run swarm -- complete --task ID --evidence "npm test → ok" [--notes "…"]
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  computeSwarmStatus,
  runSwarmTask,
  handoffSwarmTask,
  completeSwarmTask,
  createServerDeps,
} = require('../swarm');

const ROOT = path.join(__dirname, '..');
const CATALOG = path.resolve(process.env.ARIADNE_CATALOG_PATH || path.join(ROOT, 'projects.json'));

function usage(exitCode = 1) {
  console.error(`Usage:
  ariadne-swarm status   [--project <slug>]
  ariadne-swarm run      [--project <slug>] [--task <id>] [--role <name>]
  ariadne-swarm handoff  --task <id> --from <role> --to <role> --summary <text> [--commit <sha>] [--project <slug>]
  ariadne-swarm complete --task <id> --evidence <text> [--notes <text>] [--project <slug>]

Rules:
  - Only Queue tasks with FS deps Done may enter (run → In Progress / Doing)
  - complete requires --evidence (tests, commit, acceptance note)

Examples:
  npm run swarm -- status --project ariadne
  npm run swarm -- run --project ariadne
  npm run swarm -- handoff --task AH-E-2 --from coder --to cleaner --summary "CLI + tests verdes"
  npm run swarm -- complete --task AH-E-2 --evidence "npm test → swarm.test.js ok"
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const flags = {};
  while (args.length) {
    const token = args.shift();
    if (token === '--help' || token === '-h') {
      flags.help = true;
      continue;
    }
    if (!token.startsWith('--')) {
      throw new Error(`argumento inesperado: ${token}`);
    }
    const key = token.slice(2);
    const value = args[0] && !args[0].startsWith('--') ? args.shift() : true;
    flags[key] = value;
  }
  return { command, flags };
}

function readCatalog() {
  return JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
}

function resolveProject(slug) {
  const catalog = readCatalog();
  const needle = String(slug || process.env.ARIADNE_PROJECT || 'ariadne').trim();
  const project = catalog.find((item) => item.slug === needle);
  if (!project) throw new Error(`proyecto desconocido: ${needle}`);
  return project;
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) usage(0);

  let command;
  let flags;
  try {
    ({ command, flags } = parseArgs(argv));
  } catch (error) {
    console.error(error.message);
    usage();
  }

  if (flags.help || command === 'help') usage(0);

  const server = require('../server');
  const deps = createServerDeps(server);
  const project = resolveProject(flags.project);

  if (command === 'status') {
    const snapshot = computeSwarmStatus(server.projectTasks(project));
    printJson({ project: project.slug, ...snapshot });
    return;
  }

  if (command === 'run') {
    const result = await runSwarmTask(project, {
      taskId: flags.task || null,
      role: flags.role || null,
    }, deps);
    printJson({ project: project.slug, ...result });
    return;
  }

  if (command === 'handoff') {
    const result = await handoffSwarmTask(project, {
      taskId: flags.task,
      fromRole: flags.from,
      toRole: flags.to,
      summary: flags.summary,
      commit: flags.commit,
    }, deps);
    printJson({ project: project.slug, ...result });
    return;
  }

  if (command === 'complete') {
    const result = await completeSwarmTask(project, {
      taskId: flags.task,
      evidence: flags.evidence,
      notes: flags.notes,
    }, deps);
    printJson({ project: project.slug, ...result });
    return;
  }

  console.error(`comando desconocido: ${command}`);
  usage();
}

main().catch((error) => {
  console.error(error.message);
  if (error.blockers) {
    for (const blocker of error.blockers) {
      console.error(`  - ${blocker.message || blocker.id}`);
    }
  }
  process.exit(1);
});
