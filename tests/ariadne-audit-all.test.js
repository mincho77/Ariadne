const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const ROOT = path.join(__dirname, '..');

function createSandboxCatalog() {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'ariadne-audit-test-'));
  const projectRoot = path.join(sandbox, 'project');
  const tasksDir = path.join(projectRoot, 'backlog', 'tasks');
  fs.mkdirSync(tasksDir, { recursive: true });
  fs.writeFileSync(path.join(tasksDir, 'ah-e-1 - smoke.md'), `---
id: AH-E-1
title: Audit smoke task
status: To Do
priority: Medium
type: task
estimate_days: 1
---
`);
  const catalogPath = path.join(sandbox, 'projects.json');
  fs.writeFileSync(catalogPath, `${JSON.stringify([
    { slug: 'audit-demo', name: 'Audit Demo', path: projectRoot, port: 6524 },
  ], null, 2)}\n`);
  return catalogPath;
}

test('ariadne-audit-all passes without bundled ledgers', () => {
  const catalogPath = createSandboxCatalog();
  const result = spawnSync(process.execPath, ['scripts/ariadne-audit-all.js', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ARIADNE_CATALOG_PATH: catalogPath,
    },
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ledgerSummary.count, 0);
  assert.equal(report.ok, true);
  assert.ok(report.ledgers.every((row) => row.ok));
  assert.ok(Array.isArray(report.hygiene));
});

test('ariadne-route-hint CLI emits JSON', () => {
  const result = spawnSync(process.execPath, ['scripts/ariadne-route-hint.js', 'actualiza el ledger'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0);
  const body = JSON.parse(result.stdout);
  assert.equal(body.skill, 'ariadne-lite');
});
