#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { parseTask } = require('../server');
const { normalizeProjectTaskIds } = require('../task-id-normalize');

const ROOT = path.join(__dirname, '..');

function usage() {
  console.error(`Usage:
  node scripts/migrate-task-ids.js <project|--all> [--apply]

Normalizes task IDs to {CODE}-B-{n} / {CODE}-E-{n}.
Fixes legacy IDs, wrong lane (B/E), wrong project code, gaps and duplicates.
Default is dry-run; pass --apply to write changes.
`);
  process.exit(1);
}

function readCatalog() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, 'projects.json'), 'utf8'));
}

function reportResult(project, result) {
  console.log(`\nProject: ${project.slug} (${result.code})`);
  console.log(`Tasks: ${result.bugs} bugs, ${result.improvements} mejoras`);
  console.log(`Issues: ${result.analysis.issues.length}`);
  result.analysis.issues.slice(0, 8).forEach((issue) => {
    console.log(`  - ${issue.type}: ${issue.id || `${issue.kind}@${issue.found}`}${issue.want ? ` → want ${issue.want}` : ''}`);
  });
  if (result.analysis.issues.length > 8) {
    console.log(`  ... +${result.analysis.issues.length - 8} more`);
  }
  console.log(`Changes: ${result.changes.length}`);
  result.changes.slice(0, 10).forEach((change) => {
    console.log(`  ${change.oldId} → ${change.newId}`);
  });
  if (result.changes.length > 10) console.log(`  ... +${result.changes.length - 10} more`);
}

function resolveProjects(args) {
  const catalog = readCatalog();
  if (args.includes('--all')) return catalog;
  const slug = args.find((arg) => !arg.startsWith('--'));
  if (!slug) usage();
  const project = catalog.find((item) => item.slug === slug);
  if (!project) {
    console.error(`Project not found: ${slug}`);
    process.exit(1);
  }
  return [project];
}

const args = process.argv.slice(2);
if (!args.length) usage();
const apply = args.includes('--apply');
const projects = resolveProjects(args);

let totalChanges = 0;
for (const project of projects) {
  const result = normalizeProjectTaskIds(project, { parseTask, apply });
  reportResult(project, result);
  if (apply && result.applied) {
    console.log(`Applied ${result.applied} changes. Map: ${result.mapFile}`);
  }
  totalChanges += result.changes.length;
}

if (!apply) {
  console.log(`\nDry run only (${totalChanges} total changes). Re-run with --apply to write files.`);
}
