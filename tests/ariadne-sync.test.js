const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('ariadne-sync passes on repository ledgers', () => {
  const result = spawnSync(process.execPath, ['scripts/ariadne-sync.js', '--json'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ok, true);
  assert.equal(body.audit.ok, true);
  assert.ok(body.ledgers.every((row) => row.ok));
});

test('ariadne-sync --ledger targets one file', () => {
  const result = spawnSync(process.execPath, [
    'scripts/ariadne-sync.js',
    '--json',
    '--ledger',
    'docs/plans/ariadne-mejoras.md',
  ], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const body = JSON.parse(result.stdout);
  assert.equal(body.ledgers.length, 1);
  assert.equal(body.ledgers[0].ledger, 'docs/plans/ariadne-mejoras.md');
});
