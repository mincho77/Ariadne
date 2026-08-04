#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CHECK_PLAN = path.join(ROOT, 'skills', 'ariadne', 'scripts', 'check_plan.py');
const GANTT_AUDIT = path.join(ROOT, 'scripts', 'gantt-backlog-audit.js');
const { auditLedgerFile, fixLedgerFile } = require('../lib/ledger-hygiene');

function usage() {
  console.error(`Usage:
  node scripts/ariadne-audit-all.js [--json] [--fix]

Runs check_plan.py on every docs/plans/*.md ledger.
Detects stale "Próxima acción" cells pointing at hecho/cancelado IDs.
With --fix, rewrites those cells to "—" (dry-run otherwise reports only).
If projects.json exists, also runs gantt-backlog-audit.js --all --json.
Exit code 1 when any ledger errors or gantt issues exist.
`);
  process.exit(1);
}

function listLedgers() {
  const dir = path.join(ROOT, 'docs', 'plans');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(dir, name))
    .filter((filePath) => {
      try {
        const text = fs.readFileSync(filePath, 'utf8');
        return text.includes('## Registro maestro') && text.includes('| ID |');
      } catch {
        return false;
      }
    })
    .sort();
}

function runCheckPlan(ledgerPath) {
  const result = spawnSync('python3', [CHECK_PLAN, ledgerPath], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const match = output.match(/(\d+) error\(s\), (\d+) warning\(s\)/);
  const errors = match ? Number(match[1]) : (result.status === 0 ? 0 : 1);
  const warnings = match ? Number(match[2]) : 0;
  return {
    ledger: path.relative(ROOT, ledgerPath),
    ok: result.status === 0 && errors === 0,
    errors,
    warnings,
    output: output.split('\n').slice(-3).join('\n'),
  };
}

function runGanttAudit() {
  const catalog = process.env.ARIADNE_CATALOG_PATH || path.join(ROOT, 'projects.json');
  if (!fs.existsSync(catalog)) {
    return { skipped: true, reason: 'projects.json not found' };
  }
  const result = spawnSync(process.execPath, [GANTT_AUDIT, '--all', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ARIADNE_CATALOG_PATH: catalog },
  });
  let parsed = null;
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch {
    parsed = { parseError: true, raw: (result.stdout || result.stderr || '').slice(0, 500) };
  }
  return {
    skipped: false,
    exitCode: result.status,
    totalIssues: parsed.totalIssues ?? null,
    reports: parsed.reports ?? null,
  };
}

function summarizeProjects() {
  const catalog = process.env.ARIADNE_CATALOG_PATH || path.join(ROOT, 'projects.json');
  if (!fs.existsSync(catalog)) return [];
  try {
    const projects = JSON.parse(fs.readFileSync(catalog, 'utf8'));
    return (Array.isArray(projects) ? projects : []).map((row) => ({
      slug: row.slug,
      name: row.name,
      pathExists: row.path ? fs.existsSync(row.path) : false,
    }));
  } catch {
    return [];
  }
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) usage();
const jsonOut = args.includes('--json');
const applyFix = args.includes('--fix');

const ledgerPaths = listLedgers();
const hygiene = ledgerPaths.map((ledgerPath) => auditLedgerFile(ledgerPath));
if (applyFix) {
  for (const ledgerPath of ledgerPaths) {
    fixLedgerFile(ledgerPath, { dryRun: false });
  }
}
const ledgers = ledgerPaths.map(runCheckPlan);
const gantt = runGanttAudit();
const projects = summarizeProjects();

const ledgerErrors = ledgers.reduce((sum, row) => sum + row.errors, 0);
const ledgerFailed = ledgers.filter((row) => !row.ok).length;
const hygieneIssues = hygiene.reduce((sum, row) => sum + row.issues.length, 0);
const ganttIssues = gantt.skipped ? 0 : (gantt.totalIssues || 0);
const totalProblems = ledgerErrors + ganttIssues + (applyFix ? 0 : hygieneIssues);

const report = {
  auditedAt: new Date().toISOString(),
  ledgers,
  ledgerSummary: { count: ledgers.length, failed: ledgerFailed, errors: ledgerErrors },
  hygiene: hygiene.map((row) => ({
    ledger: path.relative(ROOT, row.ledger),
    issues: row.issues.map((issue) => ({
      taskId: issue.taskId,
      refId: issue.refId,
      refState: issue.refState,
      suggested: issue.suggested,
    })),
    ok: row.ok,
  })),
  hygieneSummary: { issues: hygieneIssues, fixed: applyFix ? hygieneIssues : 0 },
  projects,
  gantt,
  ok: totalProblems === 0 && ledgerFailed === 0,
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Ariadne audit-all — ${ledgers.length} ledger(s)`);
  for (const row of ledgers) {
    const mark = row.ok ? 'OK' : 'FAIL';
    console.log(`  [${mark}] ${row.ledger} (${row.errors} errors, ${row.warnings} warnings)`);
  }
  const stale = report.hygiene.filter((row) => row.issues.length);
  if (stale.length) {
    console.log(`\nLedger hygiene (${applyFix ? 'fixed' : 'stale next-action refs'}):`);
    for (const row of stale) {
      for (const issue of row.issues) {
        const action = applyFix ? 'fixed' : 'stale';
        console.log(`  [${action.toUpperCase()}] ${row.ledger} ${issue.taskId}: "${issue.refId}" (${issue.refState}) → ${issue.suggested}`);
      }
    }
  }
  if (projects.length) {
    console.log(`\nProjects (${projects.length}):`);
    for (const row of projects) {
      console.log(`  - ${row.slug}: path ${row.pathExists ? 'ok' : 'MISSING'}`);
    }
  }
  if (gantt.skipped) {
    console.log(`\nGantt backlog audit: skipped (${gantt.reason})`);
  } else {
    console.log(`\nGantt backlog audit: ${gantt.totalIssues} issue(s)`);
  }
  console.log(`\nTotal problems: ${totalProblems}`);
}

process.exit(report.ok ? 0 : 1);
