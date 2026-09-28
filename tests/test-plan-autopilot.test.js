'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const AUTOPILOT = path.join(ROOT, 'scripts', 'ariadne', 'test-plan-autopilot.mjs');

test('test-plan-autopilot syncs T tasks, bugs and correction plan', () => {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-test-plan-'));
  const tasksDir = path.join(sandbox, 'backlog', 'tasks');
  const reportsDir = path.join(sandbox, 'backlog', 'docs', 'reports');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.mkdirSync(reportsDir, { recursive: true });

  const reportPath = path.join(reportsDir, 'parity-audit-fixture.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    summary: { pass: 1, fail: 1, blocked: 0, pending: 0 },
    cases: {
      'T-001': {
        status: 'pass',
        title: 'Arranque',
        priority: 'P0',
        evidence: ['ok'],
        gaps: [],
      },
      'T-002': {
        status: 'fail',
        title: 'Navegacion',
        priority: 'P0',
        evidence: ['screenshot missing'],
        gaps: ['tab not found'],
      },
    },
  }, null, 2));

  const configPath = path.join(sandbox, 'plan.json');
  fs.writeFileSync(configPath, JSON.stringify({
    projectKey: 'KA',
    planName: 'fixture',
    tasksDir: 'backlog/tasks',
    reportGlob: 'backlog/docs/reports/parity-audit-*.json',
    runCommand: 'true',
    preflightUrls: [],
    cases: [
      { id: 'T-001', title: 'Arranque', priority: 'P0', tags: ['smoke'] },
      { id: 'T-002', title: 'Navegacion', priority: 'P0', tags: ['ui'] },
    ],
  }, null, 2));

  const result = spawnSync(process.execPath, [
    AUTOPILOT,
    '--config', configPath,
    '--skip-preflight',
    '--skip-run',
    '--report', reportPath,
  ], {
    cwd: sandbox,
    encoding: 'utf8',
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  const payload = JSON.parse(result.stdout);
  assert.equal(payload.createdTasks.length, 2);
  assert.equal(payload.updatedTasks, 2);
  assert.equal(payload.bugsTouched.length, 1);
  assert.equal(payload.bugsTouched[0].action, 'created');
  assert.match(payload.correctionPlanPath, /ka-corrections-/);
  assert.equal(fs.existsSync(payload.correctionPlanPath), true);

  const t001 = fs.readdirSync(tasksDir).find((name) => name.startsWith('ka-t-001'));
  const t002 = fs.readdirSync(tasksDir).find((name) => name.startsWith('ka-t-002'));
  assert.ok(t001);
  assert.ok(t002);
  assert.match(fs.readFileSync(path.join(tasksDir, t001), 'utf8'), /status: Done/);
  assert.match(fs.readFileSync(path.join(tasksDir, t002), 'utf8'), /status: In Progress/);
});

test('parseTypedTaskId accepts T kind', () => {
  const { parseTypedTaskId } = require('../task-ids');
  assert.deepEqual(parseTypedTaskId('KA-T-12'), { code: 'KA', kind: 'T', number: 12 });
});
