#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const { importImprovements } = require('../server');

const ROOT = path.join(__dirname, '..');

function usage() {
  console.error(`Usage:
  node scripts/import-improvements.js <project-slug> <input.json> [--dry-run]

Input JSON format:
  [
    {
      "title": "Mejora X",
      "priority": "High",
      "estimateIaHours": 16,
      "dependencies": ["AR-E-1"],
      "assignees": ["ana", "juan"],
      "epic": "Onboarding"
    }
  ]
`);
  process.exit(1);
}

function readCatalog() {
  const file = path.join(ROOT, 'projects.json');
  if (!fs.existsSync(file)) throw new Error('projects.json not found');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const args = process.argv.slice(2);
if (args.length < 2) usage();

const projectSlug = String(args[0] || '').trim();
const inputPath = path.resolve(String(args[1] || '').trim());
const dryRun = args.includes('--dry-run');

if (!projectSlug || !inputPath) usage();
if (!fs.existsSync(inputPath)) {
  console.error(`Input file not found: ${inputPath}`);
  process.exit(1);
}

const catalog = readCatalog();
const project = catalog.find((item) => item.slug === projectSlug);
if (!project) {
  console.error(`Project not found: ${projectSlug}`);
  console.error(`Available: ${catalog.map((item) => item.slug).join(', ')}`);
  process.exit(1);
}

let rows;
try {
  rows = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
} catch (error) {
  console.error(`Invalid JSON input: ${error.message}`);
  process.exit(1);
}

try {
  const report = importImprovements(project, { items: rows, dryRun });
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
