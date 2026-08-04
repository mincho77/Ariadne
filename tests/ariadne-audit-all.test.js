const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('ariadne-audit-all passes on repository ledgers', () => {
  const result = spawnSync(process.execPath, ['scripts/ariadne-audit-all.js', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const report = JSON.parse(result.stdout);
  assert.ok(report.ledgerSummary.count >= 1);
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
