#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const CHECK_PLAN = path.join(ROOT, 'skills', 'ariadne', 'scripts', 'check_plan.py');

function usage() {
  console.error(`Usage:
  node scripts/ariadne-sync.js [--fix] [--json] [--ledger <path.md> ...]

Post-edit automation for Ariadne governance (agents, CI, local):
  1. Ledger hygiene + optional --fix (stale Próxima acción)
  2. check_plan.py on every docs/plans ledger (or --ledger targets)
  3. Gantt backlog audit when projects.json exists

Exit code 1 when any step fails. Does not edit task Markdown beyond audit --fix.
`);
  process.exit(1);
}

function listDefaultLedgers() {
  const dir = path.join(ROOT, 'docs', 'plans');
  return fs.readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => path.join(dir, name))
    .filter((filePath) => {
      const text = fs.readFileSync(filePath, 'utf8');
      return text.includes('## Registro maestro') && text.includes('| ID |');
    })
    .sort();
}

function resolveLedgers(args) {
  const paths = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === '--ledger') {
      const raw = args[i + 1];
      if (!raw) usage();
      paths.push(path.isAbsolute(raw) ? raw : path.join(ROOT, raw));
      i += 1;
    }
  }
  return paths.length ? paths : listDefaultLedgers();
}

function runAuditAll(fix) {
  const auditArgs = [path.join(ROOT, 'scripts', 'ariadne-audit-all.js')];
  if (fix) auditArgs.push('--fix');
  auditArgs.push('--json');
  const result = spawnSync(process.execPath, auditArgs, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
  });
  let body = null;
  try {
    body = JSON.parse(result.stdout || '{}');
  } catch {
    body = { parseError: true, raw: (result.stdout || result.stderr || '').slice(0, 800) };
  }
  return {
    ok: result.status === 0,
    exitCode: result.status,
    report: body,
    stderr: result.stderr,
  };
}

function runCheckPlan(ledgerPath) {
  const result = spawnSync('python3', [CHECK_PLAN, ledgerPath], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
  const match = output.match(/(\d+) error\(s\), (\d+) warning\(s\)/);
  return {
    ledger: path.relative(ROOT, ledgerPath),
    ok: result.status === 0,
    exitCode: result.status,
    errors: match ? Number(match[1]) : (result.status === 0 ? 0 : 1),
    warnings: match ? Number(match[2]) : 0,
    output: output.split('\n').slice(-4).join('\n'),
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) usage();

  const fix = args.includes('--fix');
  const jsonOut = args.includes('--json');
  const ledgers = resolveLedgers(args);

  const audit = runAuditAll(fix);
  const checks = ledgers.map(runCheckPlan);
  const checkFailed = checks.filter((row) => !row.ok);

  const report = {
    syncedAt: new Date().toISOString(),
    fixApplied: fix,
    audit,
    ledgers: checks,
    ok: audit.ok && checkFailed.length === 0,
    summary: {
      ledgerCount: checks.length,
      ledgerErrors: checks.reduce((sum, row) => sum + row.errors, 0),
      hygieneIssues: audit.report?.hygieneSummary?.issues ?? null,
      hygieneFixed: audit.report?.hygieneSummary?.fixed ?? 0,
      ganttIssues: audit.report?.gantt?.skipped ? null : (audit.report?.gantt?.totalIssues ?? null),
    },
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Ariadne sync${fix ? ' (--fix)' : ''}`);
    console.log(`  audit-all: ${audit.ok ? 'OK' : 'FAIL'}`);
    for (const row of checks) {
      console.log(`  [${row.ok ? 'OK' : 'FAIL'}] ${row.ledger} (${row.errors} errors, ${row.warnings} warnings)`);
    }
    if (!report.ok) console.log('\nSync failed — fix ledgers or run with --fix for hygiene.');
  }

  process.exit(report.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { resolveLedgers, runAuditAll, runCheckPlan };
