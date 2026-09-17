#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { checkpointLedgerFile } = require('../lib/ledger-checkpoint');

const ROOT = path.join(__dirname, '..');
const CHECK_PLAN = path.join(ROOT, 'skills', 'ariadne', 'scripts', 'check_plan.py');

function usage() {
  console.error(`Usage: node scripts/ariadne-checkpoint.js [--dry-run] [--json] [ledger.md ...]

Aligns docs/plans Registro estado / Control «Próxima acción» with backlog/ Kanban.
Default ledger: docs/plans/ariadne-e2e.md
`);
  process.exit(1);
}

function listDefaultLedgers() {
  const preferred = path.join(ROOT, 'docs', 'plans', 'ariadne-e2e.md');
  return fs.existsSync(preferred) ? [preferred] : [];
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) usage();
  const dryRun = args.includes('--dry-run');
  const jsonOut = args.includes('--json');
  const ledgers = args.filter((arg) => !arg.startsWith('--')).map((item) => path.resolve(item));
  const targets = ledgers.length ? ledgers : listDefaultLedgers();
  if (!targets.length) {
    console.error('No ledger targets');
    process.exit(1);
  }

  const reports = targets.map((ledgerPath) => checkpointLedgerFile(ledgerPath, {
    backlogRoot: ROOT,
    dryRun,
  }));

  const checks = targets.map((ledgerPath) => {
    const result = spawnSync('python3', [CHECK_PLAN, ledgerPath], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    const output = `${result.stdout || ''}${result.stderr || ''}`.trim();
    const match = output.match(/(\d+) error\(s\)/);
    const errors = match ? Number(match[1]) : (result.status === 0 ? 0 : 1);
    return {
      ledger: path.relative(ROOT, ledgerPath),
      ok: result.status === 0 && errors === 0,
      errors,
      output: output.split('\n').slice(-2).join('\n'),
    };
  });

  const report = {
    dryRun,
    checkpoints: reports.map((row) => ({
      ledger: path.relative(ROOT, row.ledger),
      written: row.written,
      changes: row.changes,
      suggestedNext: row.suggestedNext,
    })),
    checkPlan: checks,
    ok: checks.every((row) => row.ok),
  };

  if (jsonOut) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    for (const row of report.checkpoints) {
      console.log(`[${row.written ? 'WROTE' : 'OK'}] ${row.ledger} → ${row.suggestedNext}`);
      for (const change of row.changes) {
        if (change.programId) {
          console.log(`  - ${change.programId} (${change.taskId}): ${change.from} → ${change.to} [kanban ${change.kanbanStatus}]`);
        } else if (change.controlNextAction) {
          console.log(`  - Control próxima acción: ${change.previous || '∅'} → ${change.controlNextAction}`);
        } else if (change.hygiene) {
          console.log(`  - hygiene fixed ${change.hygiene} stale next-action cell(s)`);
        }
      }
    }
    for (const row of checks) {
      console.log(`[check_plan ${row.ok ? 'OK' : 'FAIL'}] ${row.ledger} (${row.errors} errors)`);
    }
  }

  process.exit(report.ok ? 0 : 1);
}

main();
