#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { parseTask } = require('../server');
const { getFrontmatterList, getFrontmatterField } = require('../lib/task-markdown');
const { parseDependencySpec } = require('../lib/gantt/dependencies');
const { CROSS_PROJECT_DEP_RE } = require('../lib/gantt/portfolio');

const ROOT = path.join(__dirname, '..');

function usage() {
  console.error(`Usage:
  node scripts/gantt-backlog-audit.js <project-slug|--all> [--json]

Audita tareas del backlog para readiness Gantt (estimaciones, dependencias, campos temporales).
Siempre dry-run: no modifica archivos. Exit code 1 si hay issues.
`);
  process.exit(1);
}

function readCatalog() {
  const file = process.env.ARIADNE_CATALOG_PATH || path.join(ROOT, 'projects.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function listTaskFiles(projectRoot) {
  const dirs = ['tasks', 'completed', 'archive'].map((part) => path.join(projectRoot, 'backlog', part));
  const files = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.md')) files.push(path.join(dir, name));
    }
  }
  return files;
}

function auditTaskSource(source, taskId, knownSlugs) {
  const issues = [];
  const status = String(getFrontmatterField(source, 'status') || '');
  if (/done|complete/i.test(status)) return issues;

  const hasEstimate = Boolean(
    getFrontmatterField(source, 'estimate_ia_hours')
    || getFrontmatterField(source, 'estimate_days')
    || getFrontmatterField(source, 'remaining_ia_hours'),
  );
  if (!hasEstimate && !/milestone/i.test(String(getFrontmatterField(source, 'type') || ''))) {
    issues.push({ type: 'missing_estimate', id: taskId, message: 'Sin estimate_ia_hours, estimate_days ni remaining_ia_hours' });
  }

  const dependencies = getFrontmatterList(source, 'dependencies');
  for (const dep of dependencies) {
    const cross = String(dep || '').match(CROSS_PROJECT_DEP_RE);
    if (cross) {
      const slug = String(cross[1] || '').toLowerCase();
      if (knownSlugs.size && !knownSlugs.has(slug)) {
        issues.push({ type: 'unknown_cross_project', id: taskId, message: `Dependencia cross-project desconocida: ${dep}` });
      }
      continue;
    }
    const parsed = parseDependencySpec(dep, 8);
    if (!parsed) {
      issues.push({ type: 'invalid_dependency', id: taskId, message: `Token de dependencia inválido: ${dep}` });
    }
  }

  return issues;
}

function auditProject(project, knownSlugs) {
  const files = listTaskFiles(project.path);
  const issues = [];
  for (const file of files) {
    try {
      const source = fs.readFileSync(file, 'utf8');
      const task = parseTask(file, source);
      issues.push(...auditTaskSource(source, task.id, knownSlugs));
    } catch (error) {
      issues.push({ type: 'parse_error', id: path.basename(file), message: error.message });
    }
  }
  return {
    slug: project.slug,
    name: project.name,
    taskFiles: files.length,
    issues,
  };
}

function resolveProjects(args) {
  const catalog = readCatalog();
  const knownSlugs = new Set(catalog.map((row) => String(row.slug || '').toLowerCase()));
  if (args.includes('--all')) return { projects: catalog, knownSlugs };
  const slug = args.find((arg) => !arg.startsWith('--'));
  if (!slug) usage();
  const project = catalog.find((item) => item.slug === slug);
  if (!project) {
    console.error(`Project not found: ${slug}`);
    process.exit(1);
  }
  return { projects: [project], knownSlugs };
}

const args = process.argv.slice(2);
if (!args.length) usage();
const jsonOut = args.includes('--json');
const { projects, knownSlugs } = resolveProjects(args);

const reports = projects.map((project) => auditProject(project, knownSlugs));
const totalIssues = reports.reduce((sum, row) => sum + row.issues.length, 0);

if (jsonOut) {
  console.log(JSON.stringify({ reports, totalIssues }, null, 2));
} else {
  for (const report of reports) {
    console.log(`\n${report.slug} (${report.taskFiles} archivos)`);
    console.log(`Issues: ${report.issues.length}`);
    report.issues.slice(0, 15).forEach((issue) => {
      console.log(`  [${issue.type}] ${issue.id}: ${issue.message}`);
    });
    if (report.issues.length > 15) console.log(`  ... +${report.issues.length - 15} more`);
  }
  console.log(`\nDry-run audit complete. Total issues: ${totalIssues}`);
}

process.exit(totalIssues > 0 ? 1 : 0);
