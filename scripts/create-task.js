#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

function usage() {
  console.error(`Usage:
  node scripts/create-task.js <project> --bug "TITLE" [--priority Ultra High]
  node scripts/create-task.js <project> --enhancement "TITLE" [--priority High]
  node scripts/create-task.js <project> --mejora "TITLE" [--priority High]

Examples:
  node scripts/create-task.js jurismate --bug "BUG producción · Upload congela"
  node scripts/create-task.js ariadne --mejora "HUB · Auditoría multiproyecto"
`);
  process.exit(1);
}

function readCatalog() {
  const file = path.join(ROOT, 'projects.json');
  if (!fs.existsSync(file)) throw new Error('projects.json not found');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) usage();

  const slug = args[0];
  const kindFlag = args[1];
  const title = args[2];
  let priority = 'Medium';

  for (let i = 3; i < args.length; i += 1) {
    if (args[i] === '--priority' && args[i + 1]) {
      priority = args[i + 1];
      i += 1;
    }
  }

  const catalog = readCatalog();
  const project = catalog.find((item) => item.slug === slug);
  if (!project) {
    console.error(`Project not found: ${slug}`);
    console.error(`Available: ${catalog.map((item) => item.slug).join(', ')}`);
    process.exit(1);
  }

  const isBug = kindFlag === '--bug';
  const isEnhancement = kindFlag === '--enhancement' || kindFlag === '--mejora';
  if (!isBug && !isEnhancement) usage();

  const { createBugTask, createTask } = require('../server');
  const payload = {
    title,
    type: isBug ? 'bug' : 'enhancement',
    priority,
    labels: isBug ? ['bug'] : [],
    queue: isBug && !args.includes('--no-queue'),
    start: isBug && !args.includes('--no-start'),
  };
  const created = isBug && payload.queue
    ? await createBugTask(project, payload)
    : createTask(project, payload);
  console.log(created.id);
  console.log(created.file || created.title);
  if (created.queued) console.log('queued: yes');
  if (created.started) console.log('started: yes');
  if (created.instruction) console.log(`\n${created.instruction}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
